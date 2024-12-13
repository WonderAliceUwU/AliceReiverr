<script lang="ts">
	import { TMDB_POSTER_SMALL } from '$lib/constants';
	import { formatMinutesToTime } from '$lib/utils';
	import classNames from 'classnames';
	import { DotFilled } from 'radix-icons-svelte';
	import { fly } from 'svelte/transition';
	import Poster from '../Poster/Poster.svelte';
	import type { TitleType } from '$lib/types';
	import { openTitleModal } from '$lib/stores/modal.store';
	import { settings } from '$lib/stores/settings.store';
	import { TMDB_MOVIE_GENRES } from '$lib/apis/tmdb/tmdbApi';

	const ANIMATION_DURATION = $settings.animationDuration;

	export let tmdbId: number;
	export let type: TitleType;
	export let title: string;
	export let genreIds: number[];
	export let lazyRuntime: Promise<number>;
	export let releaseDate: Date;
	export let tmdbRating: number;
	export let posterUri: string;
	export let hideUI = false;

	let runtime = 0;
	let loadingAdditionalDetails = true;
	lazyRuntime.then((rn) => (runtime = rn)).finally(() => (loadingAdditionalDetails = false));
	$: tmdbUrl = `https://www.themoviedb.org/tv/${tmdbId}`;
	$: genres = genreIds
		.map((gId) => TMDB_MOVIE_GENRES.find((g) => g.id === gId)?.name)
		.filter<string>((g): g is string => typeof g === 'string');

	function handleOpenTitle() {
		openTitleModal({ type, id: tmdbId, provider: 'tmdb' });
	}

    let logoUri = '';
	// Fetch the logo when the component is mounted
	async function fetchMovieLogo() {
        const response = await fetch('https://api.themoviedb.org/3/tv/' + tmdbId + '/images?api_key=e6348e9e676f5a9a4bb938308b1b8309');
        const data = await response.json();

        // Filter logos to get only English ones
        const englishLogos = data.logos?.filter(logo => logo.iso_639_1 === 'en');

        // Use the first English logo, if available
        const logo = englishLogos?.[0]?.file_path;
        logoUri = logo ? `https://image.tmdb.org/t/p/original${logo}` : '';
    }

    // Call the fetch function on mount
    fetchMovieLogo();
</script>

<div
	class={classNames(
		'flex gap-6 items-end transition-opacity row-[1/2] col-[1/3] md:row-[1/3] md:col-[1/2]',
		{
			'opacity-0': hideUI
		}
	)}
>
	<div class="flex flex-col col-span-3 gap-4 max-w-screen-md">
		<div class="flex flex-col gap-1">
			<button
				on:click={handleOpenTitle}
				class="text-left font-medium tracking-wider text-stone-200 hover:text-amber-200"
				in:fly={{ y: -10, delay: ANIMATION_DURATION, duration: ANIMATION_DURATION }}
				out:fly={{ y: 10, duration: ANIMATION_DURATION }}
			>
		        {#if logoUri}
                    <img src={logoUri} alt={title} class="max-w-full max-h-52" />
                {:else}
                    <span class={classNames(
                        {
                            'text-5xl sm:text-6xl 2xl:text-7xl': title.length < 15,
                            'text-4xl sm:text-5xl 2xl:text-6xl': title.length >= 15
                        }
                    )}>{title}</span>
                {/if}
			</button>
		</div>
	<div class="flex justify-center">
    <div
        class="flex items-center gap-1 uppercase text-sm text-zinc-300 font-semibold tracking-wider"
        in:fly={{ y: -5, delay: ANIMATION_DURATION, duration: ANIMATION_DURATION }}
        out:fly={{ y: 5, duration: ANIMATION_DURATION }}
    >
        <p class="flex-shrink-0">{releaseDate.getFullYear()}</p>
        <DotFilled />
        <p class="flex-shrink-0"><a href={tmdbUrl}>{tmdbRating.toFixed(1)} TMDB</a></p>
    </div>
    </div>
  </div>
</div>
