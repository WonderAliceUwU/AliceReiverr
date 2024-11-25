<script>
  import { onMount } from 'svelte';

  export let videoId;
  let apiKey = 'b13763ae15c94019906e4a9540f7bc77';
  let serverUrl = 'https://jellyfin.wonderaliceserver.uk';
  let userId = 'WonderAlice';
  let playerUrl = '';

  onMount(() => {
    // Construct the URL for Jellyfin's built-in web player
    playerUrl = "https://jellyfin.wonderaliceserver.uk/web/#/details?id=" + localStorage.getItem('id');
    
    // If you have the user's API key and want to auto-authenticate:
    playerUrl += `&apiKey=${apiKey}`;

    // You can add additional parameters here, like autoplay
    playerUrl += '&autoplay=true';
  });
</script>

<main>
  {#if playerUrl}
    <iframe
      src={playerUrl}
      width="100%"
      height="600"
      allowfullscreen
      allow="autoplay; encrypted-media"
    ></iframe>
  {:else}
    <p>Loading player...</p>
  {/if}
</main>

<style>
  iframe {
    border: none;
    width: 90vw;
    height: 90vh;
    max-width: 100%;
  }
</style>