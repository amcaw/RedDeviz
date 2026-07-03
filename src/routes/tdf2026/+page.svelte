<script lang="ts">
  import TdfLoop from '$lib/TdfLoop.svelte';
  import TdfGapChart from '$lib/TdfGapChart.svelte';
  import TdfStats from '$lib/TdfStats.svelte';
  import { LIVE } from '$lib/tdf/live';
  import { initPym, sendHeight } from '$lib/pym.js';

  initPym();

  $effect(() => {
    sendHeight();
  });
</script>

<svelte:head>
  <title>Tour de France 2026 — La Grande Boucle, jour après jour</title>
</svelte:head>

<main>
  <h1 class="title">La Grande Boucle, jour après jour</h1>
  <p class="hint">
    Les 21 étapes du Tour 2026 forment la boucle ci-dessous — survolez (ou touchez) une étape pour
    son profil et ses résultats. La ligne jaune avance avec le maillot jaune, jour après jour.
  </p>

  <div class="stage">
    <div class="viz">
      <TdfLoop />
    </div>
  </div>

  {#if LIVE.stagesDone >= 1}
    <h2 class="shead">La bataille pour le maillot jaune</h2>
    <p class="ssub">
      Écart cumulé sur le leader après chaque étape, pour les huit premiers du classement général.
    </p>
    <TdfGapChart />
  {/if}

  <h2 class="shead">{LIVE.stagesDone >= 1 ? 'Les classements' : 'Le parcours en chiffres'}</h2>
  <TdfStats />

  <p class="source">
    Visualisation
    <a href="https://www.linkedin.com/in/ambroise-c-623703229/" target="_blank" rel="noreferrer"
      >Ambroise Carton</a
    >
    — parcours, profils et classements officiels
    <a href="https://www.letour.fr" target="_blank" rel="noreferrer">letour.fr</a>
  </p>
</main>

<style>
  main {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0;
    overflow-x: clip;
  }
  :global(body.standalone) main {
    min-height: 100dvh;
    padding: 12px 16px 8px;
  }
  .title {
    text-align: center;
    font-size: 20px;
    font-weight: 800;
    margin: 0 0 4px;
    letter-spacing: 0.01em;
  }
  .hint {
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 auto 10px;
    max-width: 560px;
  }
  .stage {
    position: relative;
    min-width: 0;
  }
  .viz {
    width: 100%;
    max-width: 700px;
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
