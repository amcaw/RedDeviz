<script lang="ts">
  import { onMount } from 'svelte';
  import WcBracket from '$lib/WcBracket.svelte';
  import WcVideo from '$lib/WcVideo.svelte';
  import { fetchBracket, type Bracket, type WcVideoRef } from '$lib/wc/bracket';
  import { initPym, sendHeight } from '$lib/pym.js';
  import videosRaw from '../../data/wc-videos.json';

  initPym();

  const videos = videosRaw as Record<string, WcVideoRef & { published?: string }>;

  let bracket = $state<Bracket | null>(null);
  let error = $state<string | null>(null);
  let video = $state<WcVideoRef | null>(null);

  onMount(async () => {
    try {
      bracket = await fetchBracket();
    } catch (e) {
      error = (e as Error).message;
    }
    sendHeight();
  });

  $effect(() => {
    void video;
    sendHeight();
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (video = null)} />

<svelte:head>
  <title>Coupe du Monde 2026 — Tableau final</title>
</svelte:head>

<main>
  {#if bracket}
    <p class="hint">
      Cliquez sur <span class="mini-play" aria-hidden="true"><svg viewBox="0 0 16 16" width="13" height="13"><circle cx="8" cy="8" r="8" /><path d="M6.2 4.8 11 8l-4.8 3.2z" /></svg></span>
      sous un score pour revoir le résumé du match
    </p>
    <div class="stage">
      <div class="viz">
        <WcBracket {bracket} {videos} onvideo={(v) => (video = v)} />
      </div>

      {#if video}
        <div class="backdrop" role="presentation" onclick={() => (video = null)}></div>
        <div class="panel" role="dialog" aria-modal="true">
          <WcVideo videoId={video.id} title={video.title} onclose={() => (video = null)} />
        </div>
      {/if}
    </div>
  {:else if error}
    <p class="state error">Impossible de charger les résultats en direct ({error}).</p>
  {:else}
    <p class="state">Chargement du tableau…</p>
  {/if}

  <p class="source">
    Idée originale d'<a
      href="https://www.instagram.com/p/DaQnOmhDSP4/?hl=fr"
      target="_blank"
      rel="noreferrer">Emilio Sansolini</a
    >
    — mise en forme interactive par
    <a
      href="https://www.linkedin.com/in/ambroise-c-623703229/"
      target="_blank"
      rel="noreferrer">Ambroise Carton</a
    >
  </p>
</main>

<style>
  main {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0;
    overflow-x: clip;
  }
  :global(body.standalone) main {
    min-height: 100dvh;
    padding: 12px 16px 8px;
  }
  .hint {
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 2px;
  }
  .mini-play {
    display: inline-block;
    vertical-align: -2px;
  }
  .mini-play circle {
    fill: var(--accent);
  }
  .mini-play path {
    fill: var(--accent-contrast);
  }
  .stage {
    position: relative;
  }
  .viz {
    width: 100%;
    max-width: min(100%, calc(100dvh - 66px));
    margin: 0 auto;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--backdrop);
  }
  .panel {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(92%, 640px);
    z-index: 41;
  }
  .panel :global(.video-card) {
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }
  .state {
    text-align: center;
    color: var(--text-muted);
    padding: 40px 0;
  }
  .state.error {
    color: var(--warn-text);
  }
  .source {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 4px 0 0;
  }
  .source a {
    color: var(--text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .source a:hover {
    color: var(--accent);
  }
</style>
