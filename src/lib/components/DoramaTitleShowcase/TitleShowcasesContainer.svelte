<script lang="ts">
import createClient from 'openapi-fetch';
import type {paths } from '../../apis/tmdb/tmdb.generated';
import { TMDB_API_KEY } from '$lib/constants';

	import { getTmdbSeries, getTmdbPopularSeries } from '$lib/apis/tmdb/tmdbApi';
	import classNames from 'classnames';
	import TitleShowcase from './TitleShowcaseBackground.svelte';
	import TitleShowcaseVisuals from './TitleShowcaseVisuals.svelte';
	import PageDots from '../PageDots.svelte';
	import IconButton from '../IconButton.svelte';
	import { ChevronRight } from 'radix-icons-svelte';
	export let openInModal = true;
	let hideUI = false;
	let popularMovies: (
		| {
				movie: Awaited<ReturnType<typeof getTmdbPopularSeries>>[0];
				lazyRuntime: Promise<number>;
				lazyTrailerId: Promise<string | undefined>;
		  }
	)[] = [];

	/**
	 * Here we load a list of popular movies:
	 *   * runtime & video data is not available as part of the initial request
	 *   * If an additional detail request fails, we unload the movie from the showcase
	 */
export const TmdbApiOpen = createClient<paths>({
	baseUrl: 'https://api.themoviedb.org',
	headers: {
		Authorization: `Bearer ${TMDB_API_KEY}`
	}
});

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
			'&with_watch_providers=344|337|8|9|464', {
		        params: {
		            query: {
		                sort_by: 'popularity.desc',
		                language: 'en',
		                with_original_language: 'ko',
		            }
		        }
		    })
		    .then((res) => res.data?.results || [])
		};
	const tmdbPopularMoviesPromise = fetchTrendingSeries().then(
		(movies) =>
			(popularMovies = movies.map((movie) => {
				const movieDetails = getTmdbSeries(movie.id || 0);
				const movieDetailsPromise = movieDetails.then((fullMovie) => ({
					runtime: fullMovie?.runtime || 0,
					trailerId: fullMovie?.videos?.results?.find(
						(v) => v.site === 'YouTube' && v.type === 'Trailer'
					)?.key
				}));

				movieDetails.catch(() => unloadMovie());
				movieDetails.then((md) => !md && unloadMovie());
				const unloadMovie = () => {
					const idx = popularMovies.findIndex((m) => m.movie === movie);
					popularMovies.splice(idx, 1);
					popularMovies = popularMovies;
				};

				return {
					movie,
					lazyRuntime: movieDetailsPromise.then((fm) => fm.runtime),
					lazyTrailerId: movieDetailsPromise.then((fm) => fm.trailerId)
				};
			}))
	);

	let showcaseIndex = 0;
	$: clampedPopularMovies = popularMovies.slice(0, 10);
	$: visibleShowcaseMovie = clampedPopularMovies[showcaseIndex];

	async function onNext() {
		showcaseIndex = (showcaseIndex + 1) % (await tmdbPopularMoviesPromise).length;
	}

	async function onPrevious() {
		showcaseIndex =
			(showcaseIndex - 1 + (await tmdbPopularMoviesPromise).length) %
			(await tmdbPopularMoviesPromise).length;
	}

	async function onJump(index: number) {
		showcaseIndex = index;
		console.log(showcaseIndex);
	}

	// Cycle movies every 5 seconds
	// onMount(() => {
	// 	const interval = setInterval(() => {
	// 		onNext();
	// 	}, 2000);

	// 	return () => clearInterval(interval);
	// });

	const PADDING = 'px-4 lg:px-8 2xl:px-16';
</script>

<div class="h-screen flex flex-col relative pb-6 gap-6 xl:gap-8 overflow-hidden" style="height: 75vh">
	<div
		class={classNames(
			'flex-1 grid grid-cols-[1fr_max-content] grid-rows-[1fr_max-content] items-end gap-6',
			PADDING
		)}
	>
	{#if visibleShowcaseMovie}
    {@const { movie, lazyRuntime, lazyTrailerId } = visibleShowcaseMovie}
    {#key movie?.id}
        <TitleShowcaseVisuals
            tmdbId={movie?.id || 0}
            type="tv"
            title={movie?.title || ''}
            genreIds={movie.genre_ids || []}
            {lazyRuntime}
            releaseDate={new Date(movie?.release_date || Date.now())}
            tmdbRating={movie?.vote_average || 0}
            posterUri={movie?.poster_path || ''}
            {hideUI}
        />
    {/key}
			<div
				class="md:relative self-stretch flex justify-center items-end row-start-2 row-span-1 col-start-1 col-span-2 md:row-start-1 md:row-span-2 md:col-start-2 md:col-span-2"
			>
				<PageDots
					index={showcaseIndex}
					length={clampedPopularMovies.length}
					{onJump}
					{onPrevious}
					{onNext}
				/>
				{#if !hideUI}
					<div class="absolute top-1/2 right-0 z-10">
						<IconButton on:click={onNext}>
							<ChevronRight size={38} />
						</IconButton>
					</div>
				{/if}
			</div>

			{#key movie?.id}
				<TitleShowcase
					tmdbId={movie?.id || 0}
					{lazyTrailerId}
					backdropUri={movie?.backdrop_path || ''}
				/>
			{/key}
		{/if}
	</div>
	<div
    class={classNames('z-[1] transition-opacity', {
        'opacity-0': hideUI
    })}
>
	</div>
</div>
