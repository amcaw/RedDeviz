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

  const stats = $derived.by(() => {
    const w = filtered.filter((m) => m.result === 'W').length;
    const d = filtered.filter((m) => m.result === 'D').length;
    const l = filtered.filter((m) => m.result === 'L').length;
    const years = filtered.map((m) => m.year);
    return {
      total: filtered.length,
      w,
      d,
      l,
      first: years.length ? Math.min(...years) : meta.firstYear,
      last: years.length ? Math.max(...years) : meta.lastYear
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
    <h1>Les matchs des Diables Rouges de {meta.firstYear} à {meta.lastYear}</h1>

    <!-- bilan: left-aligned, stacked below the title -->
    <div class="bilan">
      <h2>Bilan {activeFilter ?? 'global'}</h2>
      <p class="big">{stats.total} matchs joués entre {stats.first} et {stats.last}</p>
      <p class="counts">
        {stats.w} victoires&nbsp;/&nbsp;{stats.d} nuls&nbsp;/&nbsp;{stats.l} défaites
      </p>
      <p class="hint">
        Survolez ou cliquez sur un match pour obtenir plus d'informations et explorer les données.
      </p>
    </div>
  </header>

  <!-- controls: three filter categories -->
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
  </div>

  <section class="stage">
    <!-- the viz -->
    <div class="viz">
      <CartoChronologie
        {filtered}
        {recordHighlight}
        bind:selected
        bind:hovered
        bind:cityInfo
        bind:controls={mapControls}
      />
    </div>

    <!-- legend bottom-left -->
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

      <!-- zoom controls, under the legend -->
      <div class="zoom-buttons">
        <button aria-label="Zoom avant" onclick={() => mapControls?.zoomIn()}>+</button>
        <button aria-label="Zoom arrière" onclick={() => mapControls?.zoomOut()}>−</button>
        <button class="reset" aria-label="Réinitialiser le zoom" onclick={() => mapControls?.reset()}
          >⟲</button
        >
      </div>
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
  </section>

  <footer>
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
      >.
    </p>
  </footer>
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
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 20px 40px;
    overflow-x: clip; /* never let the viz/legend cause horizontal scroll */
  }
  header h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .stage {
    position: relative;
  }
  .viz {
    position: relative;
    z-index: 5;
    width: 100%;
    max-width: 980px;
    margin: 0 auto;
  }
  /* bilan: left-aligned, stacked below the title */
  .bilan {
    margin: 6px 0 0;
    text-align: left;
  }
  .bilan h2 {
    font-size: 16px;
    margin: 0 0 6px;
    text-transform: capitalize;
  }
  .bilan .big {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px;
  }
  .bilan .counts {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
    color: #475569;
  }
  .bilan .hint {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.45;
    margin: 0;
  }
  .legend {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 13px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 8px; /* even spacing between every legend row */
  }
  /* zoom controls: three equal square buttons, under the legend */
  .zoom-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
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
  /* the detail popup is always a bottom sheet spanning the stage width
     (same max-width + side padding as main) — never a floating card */
  .panel {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 100%;
    max-width: 1100px;
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
  /* controls above the viz: three labelled filter categories, full stage width */
  .controls {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    margin: 18px 0 8px;
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
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #334155;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.12s;
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
  }
  .result-filter .chip.on .count {
    color: inherit;
    opacity: 0.7;
  }
  footer {
    margin-top: 28px;
  }
  .source {
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
    margin-top: 16px;
  }
  .source a {
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
  @media (max-width: 720px) {
    main {
      padding: 16px 10px 32px; /* tighter gutters → more room for the viz */
    }
    .legend {
      position: static;
      margin: 16px 0 0;
      font-size: 12px;
      /* stays a left-aligned column (never centred); only the zoom buttons
         move beside the rows */
      align-items: flex-start;
      gap: 8px;
    }
    .zoom-buttons {
      flex-direction: row;
    }
    .zoom-buttons button {
      width: 30px;
      height: 30px;
      font-size: 16px;
    }
  }
</style>
