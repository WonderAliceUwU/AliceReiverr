<script lang="ts">
	import { getJellyfinEpisodes, type JellyfinItem } from '$lib/apis/jellyfin/jellyfinApi';
	import { addSeriesToSonarr, removeFromSonarr } from '$lib/apis/sonarr/sonarrApi';
	import {
		getTmdbIdFromTvdbId,
		getTmdbSeries,
		getTmdbSeriesRecommendations,
		getTmdbSeriesSeasons,
		getTmdbSeriesSimilar,
		type TmdbSeriesFull2
	} from '$lib/apis/tmdb/tmdbApi';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card/Card.svelte';
	import { fetchCardTmdbProps } from '$lib/components/Card/card';
	import Carousel from '$lib/components/Carousel/Carousel.svelte';
	import CarouselPlaceholderItems from '$lib/components/Carousel/CarouselPlaceholderItems.svelte';
	import UiCarousel from '$lib/components/Carousel/UICarousel.svelte';
	import EpisodeCard from '$lib/components/EpisodeCard/EpisodeCard.svelte';
	import PersonCard from '$lib/components/PersonCard/PersonCard.svelte';
	import SeriesRequestModal from '$lib/components/RequestModal/SeriesRequestModal.svelte';
	import OpenInButton from '$lib/components/TitlePageLayout/OpenInButton.svelte';
	import TitlePageLayout from '$lib/components/TitlePageLayout/TitlePageLayout.svelte';
	import { playerState } from '$lib/components/VideoPlayer/VideoPlayer';
	import { TMDB_BACKDROP_SMALL } from '$lib/constants';
	import {
		createJellyfinItemStore,
		createSonarrDownloadStore,
		createSonarrSeriesStore
	} from '$lib/stores/data.store';
	import { modalStack } from '$lib/stores/modal.store';
	import { settings } from '$lib/stores/settings.store';
	import type { TitleId } from '$lib/types';
	import { capitalize, formatMinutesToTime, formatSize } from '$lib/utils';
	import classNames from 'classnames';
	import { Archive, ChevronLeft, ChevronRight, DotFilled, Plus, Trash } from 'radix-icons-svelte';
	import type { ComponentProps } from 'svelte';
	import { get } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { addSeasonToSonarr } from '$lib/apis/sonarr/sonarrApi';
	import {slide } from 'svelte/transition';
	import Download from 'radix-icons-svelte/Icons/Download.svelte';
	import Notification from '$lib/components/Notification/Notification.svelte';
	export let titleId: TitleId;
	export let isModal = false;
	export let handleCloseModal: () => void = () => {};
	let dropdownOpen = false;

	const data = loadInitialPageData();
	const recommendationData = preloadRecommendationData();

	const jellyfinItemStore = createJellyfinItemStore(data.then((d) => d.tmdbId));
	const sonarrSeriesStore = createSonarrSeriesStore(data.then((d) => d.tmdbSeries?.name || ''));
	const sonarrDownloadStore = createSonarrDownloadStore(sonarrSeriesStore);

	let seasonSelectVisible = false;
	let visibleSeasonNumber = 1;
	let visibleEpisodeIndex: number | undefined = undefined;
	let nextJellyfinEpisode: JellyfinItem | undefined = undefined;

	const jellyfinEpisodeData: {
		[key: string]: {
			jellyfinId: string | undefined;
			progress: number;
			watched: boolean;
		};
	} = {};
	const episodeComponents: HTMLDivElement[] = [];

	// Refresh jellyfin episode data
	jellyfinItemStore.subscribe(async (value) => {
		const item = value.item;
		if (!item?.Id) return;
		const episodes = await getJellyfinEpisodes(item.Id);

		episodes?.forEach((episode) => {
			const key = `S${episode?.ParentIndexNumber}E${episode?.IndexNumber}`;

			if (!nextJellyfinEpisode && episode?.UserData?.Played === false) {
				nextJellyfinEpisode = episode;
			}

			jellyfinEpisodeData[key] = {
				jellyfinId: episode?.Id,
				progress: episode?.UserData?.PlayedPercentage || 0,
				watched: episode?.UserData?.Played || false
			};
		});

		if (!nextJellyfinEpisode) nextJellyfinEpisode = episodes?.[0];
		visibleSeasonNumber = nextJellyfinEpisode?.ParentIndexNumber || visibleSeasonNumber;
	});

	async function loadInitialPageData() {
		const tmdbId = await (titleId.provider === 'tvdb'
			? getTmdbIdFromTvdbId(titleId.id)
			: Promise.resolve(titleId.id));
		const tmdbSeries = await getTmdbSeries(tmdbId);

		return {
			tmdbId,
			tmdbUrl: 'https://www.themoviedb.org/tv/' + tmdbId,
			tmdbSeries,
			seasonsData: preloadAndMapSeasonsData(tmdbSeries)
		};
	}

	async function preloadRecommendationData() {
		const { tmdbId, tmdbSeries } = await data;
		const tmdbRecommendationProps = getTmdbSeriesRecommendations(tmdbId).then((r) =>
			Promise.all(r.map(fetchCardTmdbProps))
		);

		const tmdbSimilarProps = getTmdbSeriesSimilar(tmdbId)
			.then((r) => Promise.all(r.map(fetchCardTmdbProps)))
			.then((r) => r.filter((p) => p.backdropUrl));

		const castProps: ComponentProps<PersonCard>[] =
			tmdbSeries?.aggregate_credits?.cast?.slice(0, 20)?.map((m) => ({
				tmdbId: m.id || 0,
				backdropUri: m.profile_path || '',
				name: m.name || '',
				subtitle: m.roles?.[0]?.character || m.known_for_department || ''
			})) || [];

		return {
			tmdbRecommendationProps: await tmdbRecommendationProps,
			tmdbSimilarProps: await tmdbSimilarProps,
			castProps
		};
	}

	function preloadAndMapSeasonsData(
		tmdbSeries: TmdbSeriesFull2 | undefined
	): Promise<ComponentProps<EpisodeCard>[]>[] {
		const tmdbSeasons = getTmdbSeriesSeasons(
			tmdbSeries?.id || 0,
			tmdbSeries?.number_of_seasons || 0
		);

		return tmdbSeasons.map((season) =>
			season.then(
				(s) =>
					s?.episodes?.map((episode) => ({
						title: episode?.name || '',
						subtitle: `Episode ${episode?.episode_number}`,
						backdropUrl: TMDB_BACKDROP_SMALL + episode?.still_path || '',
						airDate:
							episode.air_date && new Date(episode.air_date) > new Date()
								? new Date(episode.air_date)
								: undefined
					})) || []
			)
		);
	}

	function playNextEpisode() {
		if (nextJellyfinEpisode?.Id){
          localStorage.setItem('id', nextJellyfinEpisode?.Id)
          playerState.streamJellyfinId(nextJellyfinEpisode?.Id || '');
		} 
	}
	
	async function refreshSonarr() {
		await sonarrSeriesStore.refreshIn();
	}

	let addToSonarrLoading = false;
	async function addToSonarr() {
		const tmdbId = await data.then((d) => d.tmdbId);
		addToSonarrLoading = true;
		addSeriesToSonarr(tmdbId)
			.then(refreshSonarr)
			.finally(() => (addToSonarrLoading = false));
	}

	async function openManualModal() {
		const sonarrSeries = get(sonarrSeriesStore).item;

		if (!sonarrSeries?.id || !sonarrSeries?.statistics?.seasonCount) return;

		modalStack.create(SeriesRequestModal, {
			sonarrId: sonarrSeries?.id || 0,
			seasons: sonarrSeries?.statistics?.seasonCount || 0,
			heading: sonarrSeries?.title || 'Series'
		});
	}

	async function addSeason(seasonNumber: number) {
        const sonarrSeries = get(sonarrSeriesStore).item;
        if (!sonarrSeries?.id) return;    
        addSeasonToSonarr(sonarrSeries.id, seasonNumber)
          .then(() => {
            toast.success('Season(s) added successfully', {
                duration: 3000,
                position: 'top-right'
            });
          })
          .catch((error) => {
            toast.error('An unexpected error occurred', {
                duration: 3000,
                position: 'top-right'
            });          })
          .finally(() => {
            dropdownOpen = false;
          });
    }
    
    async function deleteSeries() {
        if (!$sonarrSeriesStore.item?.id) return;
        
        const confirmed = confirm("Are you sure you want to delete this series and all associated downloads from Sonarr?");
        if (!confirmed) return;
    
        let success = true;
    
        const removeSuccess = await removeFromSonarr($sonarrSeriesStore.item.id);
    
        if (!removeSuccess) {
            {new Notification("Hey", "Deleted", 40)}
            success = false;
        }
    
        if (success) {
            await refreshSonarr();
        } else {
            console.error("There were issues deleting the series or its downloads");
        }
    
        // Refresh the stores
        sonarrSeriesStore.refreshIn();
    }

	// Focus next episode on load
	let didFocusNextEpisode = false;
	$: {
		if (episodeComponents && !didFocusNextEpisode) {
			const episodeComponent = nextJellyfinEpisode?.IndexNumber
				? episodeComponents[nextJellyfinEpisode?.IndexNumber - 1]
				: undefined;

			if (episodeComponent && nextJellyfinEpisode?.ParentIndexNumber === visibleSeasonNumber) {
				const parent = episodeComponent.offsetParent;

				if (parent) {
					parent.scrollTo({
						left:
							episodeComponent.offsetLeft -
							document.body.clientWidth / 2 +
							episodeComponent.clientWidth / 2,
						behavior: 'smooth'
					});

					didFocusNextEpisode = true;
				}
			}
		}
	}
</script>

{#await data}
	<TitlePageLayout {isModal} {handleCloseModal}>
		<div slot="episodes-carousel">
			<Carousel
				gradientFromColor="from-stone-950"
				class={classNames('px-2 sm:px-4 lg:px-8', {
					'2xl:px-0': !isModal
				})}
				heading="Episodes"
			>
				<CarouselPlaceholderItems />
			</Carousel>
		</div>
	</TitlePageLayout>
{:then { tmdbId, tmdbUrl, tmdbSeries, seasonsData }}
	<TitlePageLayout
		titleInformation={{
			tmdbId,
			type: 'series',
            logo: tmdbSeries?.images?.logos?.[0]?.file_path || '',
			backdropUriCandidates: tmdbSeries?.images?.backdrops?.map((b) => b.file_path || '') || [],
			posterPath: tmdbSeries?.poster_path || '',
			title: tmdbSeries?.name || '',
			tagline: tmdbSeries?.tagline || tmdbSeries?.name || '',
			overview: tmdbSeries?.overview || ''
		}}
		{isModal}
		{handleCloseModal}
	>
		<svelte:fragment slot="title-info">
    		{#if tmdbSeries?.images?.logos?.[0]?.file_path}
                <img 
                    src={`https://image.tmdb.org/t/p/w500${tmdbSeries.images.logos[0].file_path}`} 
                    alt="{tmdbSeries?.name} logo"
                    class="max-h-24 w-auto"
                />
            {:else}
                {tmdbSeries?.name || 'Series'}
            {/if}
		</svelte:fragment>

		<svelte:fragment slot="title-right">
			<div
				class="flex gap-2 items-center flex-row-reverse justify-end lg:flex-row lg:justify-start"
			>
				{#if $jellyfinItemStore.loading || $sonarrSeriesStore.loading}
					<div class="placeholder h-10 w-48 rounded-xl" />
				{:else}
					<OpenInButton
						title={tmdbSeries?.name}
						jellyfinItem={$jellyfinItemStore.item}
						sonarrSeries={$sonarrSeriesStore.item}
						type="series"
						{tmdbId}
					/>
					{#if !!nextJellyfinEpisode}
						<Button type="primary" on:click={playNextEpisode}>
							<span>
								{$_('library.content.play')}
								{`S${nextJellyfinEpisode?.ParentIndexNumber}E${nextJellyfinEpisode?.IndexNumber}`}
							</span>
							<ChevronRight size={20} />
						</Button>
					{:else if !$sonarrSeriesStore.item && $settings.sonarr.apiKey && $settings.sonarr.baseUrl}
						<Button type="primary" disabled={addToSonarrLoading} on:click={addToSonarr}>
							<span>{$_('library.content.addSonarr')}</span><Plus size={20} />
						</Button>
					{:else if $sonarrSeriesStore.item}
					    <Button slim on:click={deleteSeries}>
    						<Trash size={25} />
    					</Button>
						<Button slim on:click={openManualModal}>
							<span class="mr-2">Manual search...</span>
						</Button>
						{#if !$sonarrDownloadStore.downloads?.length}
    						<Button type="primary" on:click={() => dropdownOpen = !dropdownOpen}>
                                <span class="mr-2">Add to server</span><Plus size={20} />
                                {#if dropdownOpen}
                                    <div class="absolute left-0 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none" style="width: 100%; bottom: 105%;"
                                        transition:slide="{{ duration: 300, axis: 'y' }}">
                                        <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                            {#each Array.from({ length: tmdbSeries?.number_of_seasons || 0 }, (_, i) => i + 1) as seasonNumber}
                                            <button
                                                class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-xl flex justify-between"
                                                role="menuitem"
                                                on:click={() => addSeason(seasonNumber)}
                                            >
                                                Add Season {seasonNumber}
                                                <Download  size={20}/>
                                            </button>
                                            {/each}
                                        </div>
                                    </div>
                                    {/if}
                            </Button>
						{/if}
						{#if $sonarrDownloadStore.downloads?.length}
							{@const download = $sonarrDownloadStore.downloads[0]}
							<Button type="primary">
    							<h2 class="font-medium">
    								{download?.estimatedCompletionTime
    									? formatMinutesToTime(
    											(new Date(download.estimatedCompletionTime).getTime() - Date.now()) / 1000 / 60
    									  )
    									: 'Stalled'}
    							</h2>
                                <Download  size={20}/>
    						</Button>
						{/if}
					{/if}
				{/if}
			</div>
		</svelte:fragment>

		<div slot="episodes-carousel">
			<Carousel
				gradientFromColor="from-stone-950"
				class={classNames('px-2 sm:px-4 lg:px-8', {
					'2xl:px-0': !isModal
				})}
			>
				<UiCarousel slot="title" class="flex gap-6">
					{#each [...Array(tmdbSeries?.number_of_seasons || 0).keys()].map((i) => i + 1) as seasonNumber}
						{@const season = tmdbSeries?.seasons?.find((s) => s.season_number === seasonNumber)}
						{@const isSelected = season?.season_number === visibleSeasonNumber}
						<button
							class={classNames(
								'font-medium tracking-wide transition-colors flex-shrink-0 flex items-center gap-1',
								{
									'text-zinc-200': isSelected && seasonSelectVisible,
									'text-zinc-500 hover:text-zinc-200 cursor-pointer':
										(!isSelected || seasonSelectVisible === false) &&
										tmdbSeries?.number_of_seasons !== 1,
									'text-zinc-500 cursor-default': tmdbSeries?.number_of_seasons === 1,
									hidden:
										!seasonSelectVisible && visibleSeasonNumber !== (season?.season_number || 1)
								}
							)}
							on:click={() => {
								if (tmdbSeries?.number_of_seasons === 1) return;

								if (seasonSelectVisible) {
									visibleSeasonNumber = season?.season_number || 1;
									seasonSelectVisible = false;
								} else {
									seasonSelectVisible = true;
								}
							}}
						>
							<ChevronLeft
								size={20}
								class={(seasonSelectVisible || tmdbSeries?.number_of_seasons === 1) && 'hidden'}
							/>
							Season {season?.season_number}
						</button>
					{/each}
				</UiCarousel>
				{#key visibleSeasonNumber}
					{#await seasonsData[visibleSeasonNumber - 1]}
						<CarouselPlaceholderItems />
					{:then seasonEpisodes}
						{#each seasonEpisodes || [] as props, i}
							{@const jellyfinData = jellyfinEpisodeData[`S${visibleSeasonNumber}E${i + 1}`]}
							<div bind:this={episodeComponents[i]}>
								<EpisodeCard
									{...props}
									{...jellyfinData
										? {
												watched: jellyfinData.watched,
												progress: jellyfinData.progress,
												jellyfinId: jellyfinData.jellyfinId
										  }
										: {}}
									on:click={() => (visibleEpisodeIndex = i)}
								/>
							</div>
						{:else}
							<CarouselPlaceholderItems />
						{/each}
					{/await}
				{/key}
			</Carousel>
		</div>

		<svelte:fragment slot="info-components">
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.directedBy')}</p>
				<h2 class="font-medium">{tmdbSeries?.created_by?.map((c) => c.name).join(', ')}</h2>
			</div>
			{#if tmdbSeries?.first_air_date}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.firstAirDate')}</p>
					<h2 class="font-medium">
						{new Date(tmdbSeries?.first_air_date).toLocaleDateString($settings.language, {
							year: 'numeric',
							month: 'short',
							day: 'numeric'
						})}
					</h2>
				</div>
			{/if}
			{#if tmdbSeries?.next_episode_to_air}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.nextAirDate')}</p>
					<h2 class="font-medium">
						{new Date(tmdbSeries.next_episode_to_air?.air_date).toLocaleDateString(
							$settings.language,
							{
								year: 'numeric',
								month: 'short',
								day: 'numeric'
							}
						)}
					</h2>
				</div>
			{:else if tmdbSeries?.last_air_date}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.lastAirDate')}</p>
					<h2 class="font-medium">
						{new Date(tmdbSeries.last_air_date).toLocaleDateString($settings.language, {
							year: 'numeric',
							month: 'short',
							day: 'numeric'
						})}
					</h2>
				</div>
			{/if}
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.networks')}</p>
				<h2 class="font-medium">{tmdbSeries?.networks?.map((n) => n.name).join(', ')}</h2>
			</div>
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.episodeRunTime')}</p>
				<h2 class="font-medium">{tmdbSeries?.episode_run_time} Minutes</h2>
			</div>
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.spokenLanguages')}</p>
				<h2 class="font-medium">
					{tmdbSeries?.spoken_languages?.map((l) => capitalize(l.english_name || '')).join(', ')}
				</h2>
			</div>
		</svelte:fragment>

		<svelte:fragment slot="servarr-components">
			{@const sonarrSeries = $sonarrSeriesStore.item}
			{#if sonarrSeries}
				{#if sonarrSeries?.statistics?.episodeFileCount}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.available')}</p>
						<h2 class="font-medium">
							{sonarrSeries?.statistics?.episodeFileCount || 0} Episodes
						</h2>
					</div>
				{/if}
				{#if sonarrSeries?.statistics?.sizeOnDisk}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.sizeDisk')}</p>
						<h2 class="font-medium">
							{formatSize(sonarrSeries?.statistics?.sizeOnDisk || 0)}
						</h2>
					</div>
				{/if}
				{#if $sonarrDownloadStore.downloads?.length}
					{@const download = $sonarrDownloadStore.downloads?.[0]}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.downloadCompletedIn')}</p>
						<h2 class="font-medium">
							{download?.estimatedCompletionTime
								? formatMinutesToTime(
										(new Date(download?.estimatedCompletionTime).getTime() - Date.now()) / 1000 / 60
								  )
								: 'Stalled'}
						</h2>
					</div>
				{/if}

				<div class="flex gap-4 flex-wrap col-span-4 sm:col-span-6 mt-4">
					{#if !!nextJellyfinEpisode}
					<Button slim on:click={deleteSeries}>
    						<Trash size={25} />
    				</Button>
					<Button on:click={openManualModal}>
						<span class="mr-2">Manual search...
					</Button>
					<Button type="primary" on:click={() => dropdownOpen = !dropdownOpen}>
                            <span class="mr-2">Add to server</span><Plus size={20} />
                            {#if dropdownOpen}
                                <div class="absolute left-0 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none" style="width: 100%; max-height: 10.5rem; bottom: 105%; overflow-y: scroll;"
                                    transition:slide="{{ duration: 300, axis: 'y' }}">
                                    <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                        {#each Array.from({ length: tmdbSeries?.number_of_seasons || 0 }, (_, i) => i + 1) as seasonNumber}
                                            <button
                                                class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-xl flex justify-between"
                                                role="menuitem"
                                                on:click={() => addSeason(seasonNumber)}
                                            >
                                                Add Season {seasonNumber}
                                                <Download  size={20}/>
                                            </button>
                                        {/each}
                                    </div>
                                </div>
                                {/if}
                        </Button>
					{/if}
				</div>
			{:else if $sonarrSeriesStore.loading}
				<div class="flex gap-4 flex-wrap col-span-4 sm:col-span-6 mt-4">
					<div class="placeholder h-10 w-40 rounded-xl" />
					<div class="placeholder h-10 w-40 rounded-xl" />
				</div>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="carousels">
			{#await recommendationData}
				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">{$_('library.content.castAndCrew')}</div>
					<CarouselPlaceholderItems />
				</Carousel>

				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">
						{$_('library.content.recommendations')}
					</div>
					<CarouselPlaceholderItems />
				</Carousel>

				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">{$_('library.content.similarSeries')}</div>
					<CarouselPlaceholderItems />
				</Carousel>
			{:then { castProps, tmdbRecommendationProps, tmdbSimilarProps }}
				{#if castProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">{$_('library.content.castAndCrew')}</div>
						{#each castProps as prop}
							<PersonCard {...prop} />
						{/each}
					</Carousel>
				{/if}

				{#if tmdbRecommendationProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">
							{$_('library.content.recommendations')}
						</div>
						{#each tmdbRecommendationProps as prop}
							<Card {...prop} openInModal={isModal} />
						{/each}
					</Carousel>
				{/if}

				{#if tmdbSimilarProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">
							{$_('library.content.similarSeries')}
						</div>
						{#each tmdbSimilarProps as prop}
							<Card {...prop} openInModal={isModal} />
						{/each}
					</Carousel>
				{/if}
			{/await}
		</svelte:fragment>
	</TitlePageLayout>
{/await}
