<script lang="ts">
	import {
		getJellyfinBackdrop,
		getJellyfinContinueWatching,
		getJellyfinNextUp,
		type JellyfinItem
	} from '$lib/apis/jellyfin/jellyfinApi';
	import {
		getPosterProps,
		getTmdbMovie,
		getTmdbPopularMovies,
		TmdbApiOpen
	} from '$lib/apis/tmdb/tmdbApi';
	import Carousel from '$lib/components/Carousel/Carousel.svelte';
	import CarouselPlaceholderItems from '$lib/components/Carousel/CarouselPlaceholderItems.svelte';
	import GenreCard from '$lib/components/GenreCard.svelte';
	import NetworkCard from '$lib/components/NetworkCard.svelte';
	import PersonCard from '$lib/components/PersonCard/PersonCard.svelte';
	import Poster from '$lib/components/Poster/Poster.svelte';
	import TitleShowcases from '$lib/components/DoramaTitleShowcase/TitleShowcasesContainer.svelte';
	import { genres, networks } from '$lib/discover';
	import { jellyfinItemsStore } from '$lib/stores/data.store';
	import { settings } from '$lib/stores/settings.store';
	import type { TitleType } from '$lib/types';
	import { formatDateToYearMonthDay } from '$lib/utils';
	import type { ComponentProps } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { fade } from 'svelte/transition';

	let continueWatchingVisible = false;

	const tmdbPopularMoviesPromise = getTmdbPopularMovies()
		.then((movies) => Promise.all(movies.map((movie) => getTmdbMovie(movie.id || 0))))
		.then((movies) => movies.filter((m) => !!m).slice(0, 10));

	let nextUpP = getJellyfinNextUp();
	let continueWatchingP = getJellyfinContinueWatching();


	let showcaseIndex = 0;

	async function onNext() {
		showcaseIndex = (showcaseIndex + 1) % (await tmdbPopularMoviesPromise).length;
	}

	async function onPrevious() {
		showcaseIndex =
			(showcaseIndex - 1 + (await tmdbPopularMoviesPromise).length) %
			(await tmdbPopularMoviesPromise).length;
	}

	const jellyfinItemsPromise = new Promise<JellyfinItem[]>((resolve) => {
		jellyfinItemsStore.subscribe((data) => {
			if (data.loading) return;
			resolve(data.data || []);
		});
	});

	const fetchCardProps = async (
		items: {
			name?: string;
			title?: string;
			id?: number;
			vote_average?: number;
			number_of_seasons?: number;
			first_air_date?: string;
			poster_path?: string;
		}[],
		type: TitleType | undefined = undefined
	): Promise<ComponentProps<Poster>[]> => {
		const filtered = $settings.discover.excludeLibraryItems
			? items.filter(
					async (item) =>
						!(await jellyfinItemsPromise).find((i) => i.ProviderIds?.Tmdb === String(item.id))
			  )
			: items;

		return Promise.all(filtered.map(async (item) => getPosterProps(item, type))).then((props) =>
			props.filter((p) => p.backdropUrl)
		);
	};

	const trendingItemsPromise = TmdbApiOpen.get('/3/trending/all/{time_window}', {
		params: {
			path: {
				time_window: 'day'
			},
			query: {
				language: $settings.language,
				watch_providers: 344,
			}
		}
	}).then((res) => res.data?.results || []);

	const fetchTrendingProps = () => trendingItemsPromise.then(fetchCardProps);

	const fetchUpcomingMovies = () =>
		TmdbApiOpen.get('/3/discover/movie', {
			params: {
				query: {
					'primary_release_date.gte': formatDateToYearMonthDay(new Date()),
					sort_by: 'popularity.desc',
					language: $settings.language,
					region: $settings.discover.region,
					with_original_language: 'ko',
				}
			}
		})
			.then((res) => res.data?.results || [])
			.then(fetchCardProps);

	const fetchUpcomingSeries = () =>
		TmdbApiOpen.get('/3/discover/tv?first_air_date.gte=' + formatDateToYearMonthDay(new Date()) +
		'&with_watch_providers=344|337|8', {
			params: {
				query: {
					sort_by: 'popularity.desc',
					language: $settings.language,
					with_original_language: 'ko'
				}
			}
		})
			.then((res) => res.data?.results || [])
			.then((i) => fetchCardProps(i, 'series'));

	const fetchPopularMovies = () =>
			TmdbApiOpen.get('/3/discover/movie?include_adult=false' +
			'&include_null_first_air_dates=false' +
			'&language=en-US' +
			'&page=1' +
			'&sort_by=popularity.desc' +
			'&watch_region=US' +
			'&with_original_language=ko' +
			'&with_watch_providers=344|337|8', {
				params: {
					query: {
						sort_by: 'popularity.desc',
						language: $settings.language,
						with_original_language: 'ko',
					}
				}
			})
				.then((res) => res.data?.results || [])
				.then((i) => fetchCardProps(i, 'movie'));

	const fetchPopularSeries = () =>
		TmdbApiOpen.get('/3/discover/tv?include_adult=false' +
		'&include_null_first_air_dates=false' +
		'&language=en-US' +
		'&page=1' +
		'&sort_by=popularity.desc' +
		'&watch_region=US' +
		'&with_original_language=ko' +
		'&with_watch_providers=344|337|8', {
			params: {
				query: {
					sort_by: 'popularity.desc',
					language: $settings.language,
					with_original_language: 'ko',
				}
			}
		})
			.then((res) => res.data?.results || [])
			.then((i) => fetchCardProps(i, 'series'));

	const fetchTrendingSeries = () => {
	    const today = new Date();
	    const fortyDaysAgo = new Date(today);
	    fortyDaysAgo.setDate(today.getDate() - 40);

	    return TmdbApiOpen.get('/3/discover/tv?first_air_date.gte=' + fortyDaysAgo +
		'&include_adult=false' +
		'&include_null_first_air_dates=false' +
		'&language=en-US' +
		'&page=1' +
		'&watch_region=US' +
		'&with_watch_providers=344%20%7C%20337%20%7C%208', {
	        params: {
	            query: {
	                sort_by: 'popularity.desc',
	                language: $settings.language,
	                with_original_language: 'ko',
	            }
	        }
	    })
	    .then((res) => res.data?.results || [])
	    .then((i) => fetchCardProps(i, 'series'));
	};

	function parseIncludedLanguages(includedLanguages: string) {
		return includedLanguages.replace(' ', '').split(',').join('|');
	}

	const PADDING = 'px-4 lg:px-8 2xl:px-16';
</script>

<TitleShowcases />

<div
	class="flex flex-col gap-12 py-6 bg-stone-950"
	in:fade|global={{
		duration: $settings.animationDuration,
		delay: $settings.animationDuration
	}}
	out:fade|global={{ duration: $settings.animationDuration }}
>
    <Carousel scrollClass={PADDING}
			gradientFromColor="from-stone-950"
			heading={'New & Trending Series'}
			class="mx-2 sm:mx-8 2xl:mx-0"
		>
			{#await fetchTrendingSeries()}
				<CarouselPlaceholderItems size="lg" />
			{:then props}
				{#each props as prop (prop.tmdbId)}
					<Poster {...prop} size="lg" />
				{/each}
			{/await}
	</Carousel>

 <Carousel scrollClass={PADDING}
			gradientFromColor="from-stone-950"
			heading={'Popular Movies'}
			class="mx-2 sm:mx-8 2xl:mx-0"
		>
			{#await fetchPopularMovies()}
				<CarouselPlaceholderItems size="lg" />
			{:then props}
				{#each props as prop (prop.tmdbId)}
					<Poster {...prop} size="lg" />
				{/each}
			{/await}
	</Carousel>

	<Carousel scrollClass={PADDING}>
			<div slot="title" class="text-lg font-semibold text-zinc-300">
				Popular Series
			</div>
			{#await fetchPopularSeries()}
				<CarouselPlaceholderItems />
			{:then props}
				{#each props as prop (prop.tmdbId)}
					<Poster {...prop} />
				{/each}
			{/await}
		</Carousel>

	<Carousel scrollClass={PADDING}>
		<div slot="title" class="text-lg font-semibold text-zinc-300">
			{$_('discover.upcomingMovies')}
		</div>
		{#await fetchUpcomingMovies()}
			<CarouselPlaceholderItems />
		{:then props}
			{#each props as prop (prop.tmdbId)}
				<Poster {...prop} />
			{/each}
		{/await}
	</Carousel>
	<Carousel scrollClass={PADDING}>
		<div slot="title" class="text-lg font-semibold text-zinc-300">
			{$_('discover.upcomingSeries')}
		</div>
		{#await fetchUpcomingSeries()}
			<CarouselPlaceholderItems />
		{:then props}
			{#each props as prop (prop.tmdbId)}
				<Poster {...prop} />
			{/each}
		{/await}
	</Carousel>
	<!--<Carousel scrollClass={PADDING}>-->
	<!--	<div slot="title" class="text-lg font-semibold text-zinc-300">-->
	<!--		{$_('discover.genres')}-->
	<!--	</div>-->
	<!--	{#each Object.values(genres) as genre (genre.tmdbGenreId)}-->
	<!--		<GenreCard {genre} />-->
	<!--	{/each}-->
	<!--</Carousel>-->
	<!--<Carousel scrollClass={PADDING}>-->
	<!--	<div slot="title" class="text-lg font-semibold text-zinc-300">-->
	<!--		{$_('discover.TVNetworks')}-->
	<!--	</div>-->
	<!--	{#each Object.values(networks) as network (network.tmdbNetworkId)}-->
	<!--		<NetworkCard {network} />-->
	<!--	{/each}-->
	<!--</Carousel>-->
</div>
