<script lang="ts">
  import CartoChronologie from '$lib/CartoChronologie.svelte';
  import MatchDetail from '$lib/MatchDetail.svelte';
  import FilterBar from '$lib/FilterBar.svelte';
  import RecordsButtons from '$lib/RecordsButtons.svelte';
  import CityDetail from '$lib/CityDetail.svelte';
  import { matches, meta, RESULT_COLORS, RESULT_LABELS, type Match } from '$lib/data';

  let activeFilter = $state<string | null>(null); // compétition
  let activeResult = $state<'W' | 'D' | 'L' | null>(null); // résultat
  let selected = $state<Match | null>(null);
  let hovered = $state<Match | null>(null);
  // ids of a "memorable series" highlighted from the buttons (empty = none)
  let recordHighlight = $state<string[]>([]);
  let recordKey = $state<string | null>(null);
  // city stats panel published by the map when a city dot is clicked
  let cityInfo = $state<{
    city: string;
    country: string;
    cityMatches: Match[];
    countryMatches: Match[];
  } | null>(null);
  // zoom actions exposed by the map for the +/−/reset buttons
  let mapControls = $state<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>(
    null
  );

  // Highlighting a memorable series and filtering are mutually exclusive: a
  // series spans the whole history, so it shouldn't fight the competition/result
  // filters. Activating one side clears the other.
  let prevFilter: string | null = null;
  let prevResult: 'W' | 'D' | 'L' | null = null;
  let prevRecord: string | null = null;
  $effect(() => {
    const filterChangedOn =
      (activeFilter && activeFilter !== prevFilter) ||
      (activeResult && activeResult !== prevResult);
    const recordChangedOn = recordKey && recordKey !== prevRecord;
    if (recordChangedOn) {
      // a series was just picked → drop the filters
      activeFilter = null;
      activeResult = null;
    } else if (filterChangedOn && recordKey) {
      // a filter was just changed → clear the series
      recordKey = null;
      recordHighlight = [];
    }
    prevFilter = activeFilter;
    prevResult = activeResult;
    prevRecord = recordKey;
  });

  const filtered = $derived(
    matches.filter(
      (m) =>
        (!activeFilter || m.category === activeFilter) &&
        (!activeResult || m.result === activeResult)
    )
  );


  // Dynamic counts for the filter buttons. Each group's counts respect the OTHER
  // group's active filter but ignore its own (so the numbers show what picking
  // each option would yield).
  // Competition counts: matches passing the active result filter.
  const competitionCounts = $derived.by(() => {
    const base = matches.filter((m) => !activeResult || m.result === activeResult);
    const out: Record<string, number> = {};
    for (const m of base) out[m.category] = (out[m.category] ?? 0) + 1;
    return { counts: out, total: base.length };
  });
  // Result counts: matches passing the active competition filter.
  const resultCounts = $derived.by(() => {
    const base = matches.filter((m) => !activeFilter || m.category === activeFilter);
    return {
      W: base.filter((m) => m.result === 'W').length,
      D: base.filter((m) => m.result === 'D').length,
      L: base.filter((m) => m.result === 'L').length,
      total: base.length
    };
  });

  const results: Array<'W' | 'D' | 'L'> = ['W', 'D', 'L'];

  // Navigate to the previous / next match within the current (filtered) list.
  function step(dir: -1 | 1) {
    if (!filtered.length) return;
    let i = selected ? filtered.findIndex((m) => m.id === selected!.id) : -1;
    i = i === -1 ? (dir === 1 ? 0 : filtered.length - 1) : i + dir;
    i = (i + filtered.length) % filtered.length; // wrap around
    selected = filtered[i];
    cityInfo = null;
  }

  function resetAll() {
    selected = null;
    cityInfo = null;
  }
</script>

<svelte:head>
  <title>Cartochronologie des Diables Rouges</title>
</svelte:head>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') resetAll();
    else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    }
  }}
/>

<main>
  <header>
    <h1>
      Les {meta.total} matchs des Diables Rouges de {meta.firstYear} à {meta.lastYear}
    </h1>
    <p class="hint">
      Survolez ou cliquez sur un match pour obtenir plus d'informations et explorer les données.
    </p>
  </header>

  <div class="layout">
    <!-- filters column (left on desktop, below the viz on mobile) -->
    <div class="controls">
      <div class="filter-group">
        <h4>Filtrer par compétition</h4>
        <FilterBar
          bind:active={activeFilter}
          counts={competitionCounts.counts}
          total={competitionCounts.total}
        />
      </div>

      <div class="filter-group">
        <h4>Filtrer par résultat</h4>
        <div class="result-filter">
          <button class="chip" class:on={activeResult === null} onclick={() => (activeResult = null)}>
            Tous les résultats <span class="count">({resultCounts.total})</span>
          </button>
          {#each [['W', 'Victoire'], ['D', 'Nul'], ['L', 'Défaite']] as [code, label]}
            <button
              class="chip"
              class:on={activeResult === code}
              style:--c={RESULT_COLORS[code as 'W' | 'D' | 'L']}
              onclick={() => (activeResult = activeResult === code ? null : (code as 'W' | 'D' | 'L'))}
            >
              <span class="swatch" style:background={RESULT_COLORS[code as 'W' | 'D' | 'L']}></span>
              {label}
              <span class="count">({resultCounts[code as 'W' | 'D' | 'L']})</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="filter-group">
        <h4>Mettre en évidence une série</h4>
        <RecordsButtons bind:highlight={recordHighlight} bind:activeKey={recordKey} />
      </div>

      <!-- legend + map zoom controls -->
      <div class="filter-group legend-group">
        <h4>Légende</h4>
        <div class="legend">
          <div class="results-row">
            {#each results as r}
              <div class="legend-row">
                <span class="dot" style:background={RESULT_COLORS[r]}></span>
                {RESULT_LABELS[r]}
              </div>
            {/each}
          </div>
          <div class="legend-row map-legend">
            <span class="swatch host"></span> Pays d'accueil des matchs
          </div>
          <div class="legend-row year-scale-row">
            <span class="year-scale"></span>
            <span class="scale-labels">− de matchs/an <span class="arrow">→</span> + de matchs/an</span>
          </div>
        </div>
      </div>
    </div>

    <section class="stage">
      <!-- map zoom controls, overlaid top-left of the wheel, stacked -->
      <div class="zoom-buttons">
        <button aria-label="Zoom avant" onclick={() => mapControls?.zoomIn()}>+</button>
        <button aria-label="Zoom arrière" onclick={() => mapControls?.zoomOut()}>−</button>
        <button class="reset" aria-label="Réinitialiser le zoom" onclick={() => mapControls?.reset()}
          >⟲</button
        >
      </div>
      <!-- the viz -->
      <div class="viz">
        <CartoChronologie
          {filtered}
          {recordHighlight}
          filterActive={!!activeFilter || !!activeResult}
          bind:selected
          bind:hovered
          bind:cityInfo
          bind:controls={mapControls}
        />
      </div>

    <!-- detail panel: appears when a match is selected -->
    {#if selected}
      <!-- backdrop: a click anywhere outside the panel closes the popup -->
      <div
        class="backdrop"
        role="presentation"
        onclick={() => (selected = null)}
      ></div>
      <div class="panel" role="dialog" aria-modal="true">
        <MatchDetail match={selected} onclose={() => (selected = null)} />
      </div>
    {/if}

    <!-- city stats panel: appears when a city dot on the map is clicked.
         Same close behaviour as the match panel (backdrop + × + Escape). -->
    {#if cityInfo}
      <div class="backdrop" role="presentation" onclick={() => (cityInfo = null)}></div>
      <div class="panel city-panel" role="dialog" aria-modal="true">
        <CityDetail
          city={cityInfo.city}
          country={cityInfo.country}
          cityMatches={cityInfo.cityMatches}
          countryMatches={cityInfo.countryMatches}
          onclose={() => (cityInfo = null)}
        />
      </div>
    {/if}

      <!-- source credit pinned to the bottom of the wheel's square (the empty
           corner area), so it doesn't add height to the page -->
      <p class="source">
        Source des données :
        <a
          href="https://www.rbfa.be/en/national-teams/belgian-red-devils/all-belgian-red-devils-matches"
          target="_blank"
          rel="noreferrer">RBFA</a
        >
        — visualisation inspirée de
        <a
          href="https://www.chroniquesbleues.fr/cartographie-chronologique-des-matchs-des-Bleus"
          target="_blank"
          rel="noreferrer">Chroniques Bleues</a
        >, via
        <a
          href="https://www.linkedin.com/posts/danielbreton_bleus-football-fff-ugcPost-7467863100411674624--hIG/"
          target="_blank"
          rel="noreferrer">Daniel Breton (Visual Data Flow)</a
        >.
      </p>
    </section>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #fbfcfe;
    --font: 'Inter', system-ui, -apple-system, sans-serif;
    font-family: var(--font);
    color: #1f2933;
  }
  main {
    max-width: 1320px;
    margin: 0 auto;
    padding: 24px 20px 40px;
    overflow-x: clip; /* never let the viz/legend cause horizontal scroll */
  }
  header h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 8px;
  }
  /* desktop: filters column on the left, viz on the right, all within the
     viewport height. --chrome ≈ header + paddings. */
  .layout {
    --chrome: 120px;
    display: flex;
    align-items: flex-start;
    gap: 28px;
  }
  .layout .controls {
    flex: 0 0 300px;
    margin: 0;
  }
  .stage {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }
  .viz {
    position: relative;
    z-index: 5;
    width: 100%;
    /* the viz is square; cap its width by the height left under the header so
       everything fits the viewport on desktop. */
    max-width: min(100%, calc(100vh - var(--chrome)));
    margin: 0 auto;
  }
  header .hint {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.45;
    margin: 6px 0 0;
  }
  /* legend now lives in the filters column (no overlay on the viz) */
  .legend {
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .legend-group {
    margin-top: 4px;
  }
  /* zoom controls: stacked, overlaid in the top-left of the wheel */
  .zoom-buttons {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .zoom-buttons button {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #334155;
    border-radius: 7px;
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.12s;
  }
  .zoom-buttons button:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #334155;
  }
  /* Victoire / Nul / Défaite always on one horizontal row, never stacked */
  .results-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 16px;
  }
  .legend .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    display: inline-block;
  }
  .legend .swatch {
    width: 14px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }
  .legend .swatch.host {
    background: #7e9bb8;
  }
  /* year-ring colour scale: grey (no match) → light red → deep red */
  .year-scale-row {
    align-items: center;
    flex-wrap: wrap;
  }
  .year-scale {
    width: 88px;
    height: 11px;
    border-radius: 3px;
    display: inline-block;
    background: linear-gradient(to right, #eceff3 0%, #f7d4d1 18%, #c0241b 100%);
  }
  .scale-labels {
    font-size: 11px;
    color: #94a3b8;
  }
  .scale-labels .arrow {
    color: #cbd5e1;
  }
  /* backdrop sits above everything (incl. the viz) so any click/tap outside the
     panel closes it — on desktop and on touch alike */
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(15, 23, 42, 0.12);
    cursor: default;
    touch-action: manipulation;
  }
  /* the detail popup is a bottom sheet spanning the STAGE width (the viz column),
     anchored to the bottom of the stage — never a floating card */
  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    box-sizing: border-box;
    z-index: 41;
  }
  .panel :global(.detail) {
    width: 100%;
    box-sizing: border-box;
    border-radius: 14px 14px 0 0;
    max-height: 70vh;
    box-shadow: 0 -6px 24px rgba(15, 23, 42, 0.12);
  }
  /* filter groups, placed below the viz */
  .controls {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    margin: 20px 0 8px;
    width: 100%;
  }
  .filter-group h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .result-filter {
    display: flex;
    gap: 8px;
    justify-content: flex-start;
  }
  .result-filter .chip {
    flex: 0 1 auto;
    max-width: 100%;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #334155;
    border-radius: 8px;
    padding: 4px 14px;
    font-size: 13px;
    line-height: 1.2;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .result-filter .chip:hover {
    border-color: #94a3b8;
  }
  /* « Tous les résultats » (sans pastille) : actif neutre, comme le groupe compétition */
  .result-filter .chip.on {
    background: #1f2933;
    border-color: #1f2933;
    color: #fff;
    font-weight: 600;
  }
  /* résultats colorés : actif teinté de leur couleur */
  .result-filter .chip.on:has(.swatch) {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, #fff);
    color: #1f2933;
  }
  .result-filter .swatch {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    display: inline-block;
  }
  .result-filter .count {
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
    display: inline-block;
    min-width: 2.9em;
    text-align: left;
  }
  .result-filter .chip.on .count {
    color: inherit;
    opacity: 0.7;
  }
  /* source credit pinned to the bottom of the stage (over the wheel's empty
     bottom corner) so it costs no extra page height */
  .source {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
    margin: 0;
    pointer-events: none; /* let clicks fall through to the wheel… */
  }
  .source a {
    pointer-events: auto; /* …except on the links */
    color: #64748b;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .source a:hover {
    color: #1f2933;
  }
  /* Legend + zoom controls stay overlaid on the viz at all sizes, but shrink a
     touch on narrow screens so they don't crowd the disc. */
  /* On mobile the top-left ring is dense, so the overlaid legend collides with
     the dots. Drop it (and the zoom controls) into normal flow below the viz. */
  /* below this width the two columns don't both fit comfortably → stack:
     viz first, filters (incl. legend) below, no viewport-height cap */
  @media (max-width: 1200px) {
    .layout {
      flex-direction: column;
      align-items: center; /* centre the stacked viz + filters */
      /* keep the wheel at a sensible size and match the filters to its width */
      --stack-w: min(100%, 78vh, 760px);
    }
    .stage {
      order: 1;
      width: var(--stack-w);
    }
    .viz {
      max-width: 100%;
    }
    .layout .controls {
      flex: none;
      width: var(--stack-w);
      order: 2;
      margin-top: 24px;
    }
  }
  @media (max-width: 720px) {
    main {
      padding: 16px 10px 32px; /* tighter gutters */
    }
  }
</style>
