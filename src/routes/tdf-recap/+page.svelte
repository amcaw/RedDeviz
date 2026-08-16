<script lang="ts">
  import { onMount } from 'svelte';
  import TdfSwarm from '$lib/TdfSwarm.svelte';
  import TdfSpiral from '$lib/TdfSpiral.svelte';
  import TdfWaterfall from '$lib/TdfWaterfall.svelte';
  import TdfRoadGap from '$lib/TdfRoadGap.svelte';
  import { LIVE, riderName, fmtGap } from '$lib/tdf/live';
  import { winnerBib, runnerBib, finalGc, isComplete, doneNs, totalKmDone, finishers } from '$lib/tdf/recap';
  import { initPym, sendHeight } from '$lib/pym.js';

  initPym();

  let ready = $state(false);

  onMount(() => {
    ready = true;
  });

  $effect(() => {
    void ready;
    sendHeight();
  });

  const podium = finalGc.slice(0, 3);
</script>

<svelte:head>
  <title>Tour de France 2026 · Le récap en trois regards</title>
</svelte:head>

<main class="tdf-noir">
  <p class="kicker">Tour de France 2026 · le récap</p>
  <h1 class="title">Trois façons de relire la Grande Boucle</h1>

  {#if ready && winnerBib != null}
    {#if !isComplete}
      <p class="warn">Données partielles : {doneNs.length} étapes sur 21. Le récap se complétera au prochain rafraîchissement.</p>
    {/if}

    <section class="viz-block">
      <header>
        <span class="num">1</span>
        <div>
          <h2>Dans son sillage</h2>
          <p>Les {finishers} coureurs qui ont rejoint Paris, chacun un point, positionné par son écart au maillot jaune. Pressez lecture : les 21 étapes défilent et le peloton se délite vers la droite pendant que {riderName(winnerBib)}, en or, reste ancré à gauche — 6 minutes sur le 2ᵉ, plus de six heures sur le dernier.</p>
        </div>
      </header>
      <div class="frame"><TdfSwarm /></div>
    </section>

    <section class="viz-block">
      <header>
        <span class="num">2</span>
        <div>
          <h2>La spirale du général</h2>
          <p>Chaque rayon est une étape, du Grand Départ à Paris. Plus une ligne s'éloigne du centre, plus le coureur a perdu de temps sur le maillot jaune. Survolez une étape pour voir le top&nbsp;5 du jour.</p>
        </div>
      </header>
      <div class="frame"><TdfSpiral /></div>
    </section>

    <section class="viz-block">
      <header>
        <span class="num">3</span>
        <div>
          <h2>Où le Tour s'est joué</h2>
          <p>Le Tour se gagne sur quelques jours. Ce graphique décompose, étape par étape, comment {riderName(winnerBib)} a bâti son avance finale de {fmtGap(finalGc[1]?.[1] ?? 0).replace('+ ', '')} sur son dauphin.</p>
        </div>
      </header>
      <div class="frame"><TdfWaterfall /></div>
    </section>

    <section class="viz-block">
      <header>
        <span class="num">4</span>
        <div>
          <h2>La route qui respire</h2>
          <p>Les {Math.round(totalKmDone).toLocaleString('fr-FR')}&nbsp;km déroulés d'un trait. La vague suit l'écart entre le premier et le deuxième au général : elle enfle dans les cols, se resserre sur le plat.</p>
        </div>
      </header>
      <div class="frame"><TdfRoadGap /></div>
    </section>

    <section class="podium">
      <h2>Le podium final</h2>
      <ol>
        {#each podium as [bib, gap], i}
          <li class="p{i + 1}">
            <span class="medal">{['🥇', '🥈', '🥉'][i]}</span>
            <span class="pn">{riderName(bib)}</span>
            <span class="pt">{LIVE.riders[String(bib)]?.[1] ?? ''}</span>
            <span class="pg">{gap === 0 ? 'vainqueur' : fmtGap(gap)}</span>
          </li>
        {/each}
      </ol>
    </section>
  {:else if ready}
    <p class="state">Le classement final n'est pas encore disponible.</p>
  {:else}
    <p class="state">Chargement du récap…</p>
  {/if}

  <p class="source">
    Visualisation
    <a href="https://www.linkedin.com/in/ambroise-c-623703229/" target="_blank" rel="noreferrer">Ambroise Carton</a>
    · classements officiels
    <a href="https://www.letour.fr" target="_blank" rel="noreferrer">letour.fr</a>
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
    max-width: 860px;
    margin: 0 auto;
    padding: 0;
    overflow-x: clip;
    background: #000000;
    color: var(--text);
  }
  :global(body.standalone) main {
    min-height: 100dvh;
    padding: 16px 16px 8px;
  }
  .kicker {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--tdf-jaune);
    margin: 0 0 6px;
  }
  .title {
    text-align: center;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.01em;
    margin: 0 0 22px;
  }
  .warn {
    width: fit-content;
    margin: 0 auto 18px;
    padding: 5px 13px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 11px;
  }
  .viz-block {
    margin: 0 0 40px;
  }
  .viz-block header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 0 0 14px;
  }
  .num {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1.5px solid var(--tdf-jaune);
    color: var(--tdf-jaune);
    font-size: 13px;
    font-weight: 800;
    display: grid;
    place-items: center;
  }
  .viz-block h2 {
    font-size: 17px;
    font-weight: 800;
    margin: 2px 0 4px;
  }
  .viz-block header p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-secondary);
    max-width: 60ch;
  }
  .frame {
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: 14px;
    padding: 16px 16px 12px;
  }
  .podium {
    margin: 8px 0 0;
  }
  .podium h2 {
    text-align: center;
    font-size: 15px;
    font-weight: 800;
    margin: 0 0 12px;
  }
  .podium ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 460px;
    margin: 0 auto;
  }
  .podium li {
    display: grid;
    grid-template-columns: 30px 1fr auto;
    align-items: baseline;
    gap: 4px 10px;
    padding: 9px 14px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--divider);
  }
  .podium li.p1 {
    border-color: var(--tdf-jaune);
  }
  .medal {
    font-size: 17px;
    grid-row: span 2;
    align-self: center;
  }
  .pn {
    font-weight: 700;
    font-size: 14px;
  }
  .pg {
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    color: var(--text-secondary);
    text-align: right;
    align-self: center;
    grid-row: span 2;
  }
  .pt {
    grid-column: 2;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-muted);
  }
  .state {
    text-align: center;
    color: var(--text-muted);
    padding: 40px 0;
  }
  .source {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 34px 0 0;
  }
  .source a {
    color: var(--text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .source a:hover {
    color: var(--tdf-jaune);
  }
  @media (max-width: 560px) {
    .frame {
      padding: 12px 8px 10px;
    }
  }
</style>
