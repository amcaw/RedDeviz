<script lang="ts">
  import { onMount } from 'svelte';
  import TdfLoop from '$lib/TdfLoop.svelte';
  import TdfGapChart from '$lib/TdfGapChart.svelte';
  import TdfStats from '$lib/TdfStats.svelte';
  import { LIVE } from '$lib/tdf/live';
  import { initPym, sendHeight } from '$lib/pym.js';

  initPym();

  let ready = $state(false);
  let demo = $state(false);
  let tab = $state<'tour' | 'jaune' | 'classements'>('tour');

  onMount(async () => {
    if (new URLSearchParams(location.search).has('demo')) {
      const sim = (await import('../../data/tdf-live-sim.json')).default;
      Object.assign(LIVE, sim);
      demo = true;
    }
    ready = true;
  });

  $effect(() => {
    void ready;
    void tab;
    sendHeight();
  });
</script>

<svelte:head>
  <title>Tour de France 2026 — La Grande Boucle, jour après jour</title>
</svelte:head>

<main class="tdf-noir">
  <h1 class="title">La Grande Boucle, jour après jour</h1>

  {#if demo}
    <p class="demo-pill">Mode démo — données simulées après 9 étapes, pour prévisualiser la course</p>
  {/if}

  {#if ready}
    <div class="tabs">
      <button class:active={tab === 'tour'} aria-pressed={tab === 'tour'} onclick={() => (tab = 'tour')}>Le Tour</button>
      <button
        class:active={tab === 'jaune'}
        aria-pressed={tab === 'jaune'}
        disabled={LIVE.stagesDone < 1}
        onclick={() => (tab = 'jaune')}>Maillot jaune</button
      >
      <button class:active={tab === 'classements'} aria-pressed={tab === 'classements'} onclick={() => (tab = 'classements')}
        >{LIVE.stagesDone >= 1 ? 'Classements' : 'Le parcours'}</button
      >
    </div>

    {#if tab === 'tour'}
      <div class="stage">
        <div class="viz">
          <TdfLoop />
        </div>
      </div>
    {:else if tab === 'jaune'}
      <h2 class="shead">La bataille pour le maillot jaune</h2>
      <p class="ssub">
        Écart cumulé sur le leader après chaque étape, pour les huit premiers du classement général.
      </p>
      <TdfGapChart />
    {:else}
      <h2 class="shead">{LIVE.stagesDone >= 1 ? 'Les classements' : 'Le parcours en chiffres'}</h2>
      <TdfStats />
    {/if}
  {/if}

  <p class="source">
    Visualisation
    <a href="https://www.linkedin.com/in/ambroise-c-623703229/" target="_blank" rel="noreferrer"
      >Ambroise Carton</a
    >
    — parcours, tracés GPX et classements officiels
    <a href="https://www.letour.fr" target="_blank" rel="noreferrer">letour.fr</a>
    — carte
    <a href="https://maplibre.org" target="_blank" rel="noreferrer">MapLibre GL JS</a>
    (contours
    <a href="https://github.com/gregoiredavid/france-geojson" target="_blank" rel="noreferrer"
      >france-geojson</a
    >
    ODbL, relief
    <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer"
      >Terrain Tiles</a
    > Mapzen/AWS)
  </p>
</main>

<style>
  :global(body:has(main.tdf-noir)) {
    background: #000000;
  }
  main {
    --bg: #000000;
    --surface: #101010;
    --surface-2: rgba(255, 255, 255, 0.04);
    --surface-hover: rgba(255, 255, 255, 0.09);
    --text: #f5f5f0;
    --text-secondary: rgba(245, 245, 240, 0.72);
    --text-muted: rgba(245, 245, 240, 0.52);
    --border: rgba(255, 255, 255, 0.16);
    --border-strong: rgba(255, 255, 255, 0.28);
    --divider: rgba(255, 255, 255, 0.09);
    --backdrop: rgba(0, 0, 0, 0.6);
    --result-loss: #6f6f6f;
    --tdf-jaune: #ffff00;
    --tdf-gold: #ffff00;
    --tdf-fill: #ffff00;
    --tdf-plat: #fff9b0;
    --tdf-acc: #e6cd2e;
    --tdf-mont: #9c8500;
    --tdf-clm: #f2f2f2;
    --tdf-c2: #f2f2f2;
    --tdf-c3: #b0b0b0;
    --tdf-c4: #6f6f6f;
    max-width: 1240px;
    margin: 0 auto;
    padding: 0;
    overflow-x: clip;
    background: #000000;
    color: var(--text);
  }
  :global(body.standalone) main {
    min-height: 100dvh;
    padding: 12px 16px 8px;
  }
  .title {
    text-align: center;
    font-size: 20px;
    font-weight: 800;
    margin: 0 0 10px;
    letter-spacing: 0.01em;
  }
  .tabs {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin: 0 auto 16px;
    border-bottom: 1px solid var(--divider);
    max-width: 520px;
  }
  .tabs button {
    appearance: none;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    padding: 9px 16px;
    color: var(--text-muted);
    font: 700 13px var(--font);
    letter-spacing: 0.01em;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .tabs button:hover:not(:disabled) {
    color: var(--text-secondary);
  }
  .tabs button.active {
    color: var(--tdf-jaune);
    border-bottom-color: var(--tdf-jaune);
  }
  .tabs button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .demo-pill {
    width: fit-content;
    margin: 0 auto 10px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--warn-border);
    background: var(--warn-bg);
    color: var(--warn-text);
    font-size: 11px;
    font-weight: 600;
  }
  .stage {
    position: relative;
    min-width: 0;
  }
  .viz {
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
  }
  .shead {
    margin: 30px 0 4px;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }
  .ssub {
    margin: 0 0 12px;
    color: var(--text-muted);
    font-size: 12px;
  }
  .shead + :global(.stats) {
    margin-top: 12px;
  }
  .source {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 22px 0 0;
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
