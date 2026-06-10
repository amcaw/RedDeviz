<script lang="ts">
  import CartoChronologie from '$lib/CartoChronologie.svelte';
  import MatchDetail from '$lib/MatchDetail.svelte';
  import FilterBar from '$lib/FilterBar.svelte';
  import RecordsButtons from '$lib/RecordsButtons.svelte';
  import CityDetail from '$lib/CityDetail.svelte';
  import {
    getTeam,
    TEAM_LIST,
    RESULT_VARS,
    RESULT_LABELS,
    type Match,
    type TeamKey
  } from '$lib/data';
  import { initPym, sendHeight } from '$lib/pym.js';
  import { base } from '$app/paths';

  // pym.js: auto-resize the embedding iframe to fit the widget's content.
  initPym();

  // Which Belgian team is shown (toggle at the top). Switching reloads the whole viz.
  let team = $state<TeamKey>('devils');
  const teamData = $derived(getTeam(team));
  const matches = $derived(teamData.matches);
  const meta = $derived(teamData.meta);
  const categories = $derived(teamData.categories);
  const teamName = $derived(TEAM_LIST.find((t) => t.key === team)!.name);

  // How many matches link to an Auvio video / RTBF Actus article (Red Devils only).
  const videoCount = $derived(matches.filter((m) => m.video).length);
  const articleCount = $derived(matches.filter((m) => m.article).length);

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

  // Re-report the height to the embedding iframe whenever something that can change
  // the document height toggles (team, popups, filters, highlighted series).
  $effect(() => {
    // touch the reactive deps so the effect re-runs on any of them
    void team;
    void selected;
    void cityInfo;
    void activeFilter;
    void activeResult;
    void recordKey;
    sendHeight();
  });


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
    mapControls?.reset(); // also zoom the map back out
  }

  // Switching team clears every selection/filter so the new dataset starts fresh
  // (the viz itself is remounted via {#key team}, replaying the reveal animation).
  function switchTeam(t: TeamKey) {
    if (t === team) return;
    team = t;
    activeFilter = null;
    activeResult = null;
    recordHighlight = [];
    recordKey = null;
    selected = null;
    hovered = null;
    cityInfo = null;
  }
</script>

<svelte:head>
  <title>Cartochronologie des Diables Rouges & Red Flames</title>
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
    <div class="team-toggle" role="group" aria-label="Choisir l'équipe">
      {#each TEAM_LIST as t (t.key)}
        <button
          class="team-btn"
          class:on={team === t.key}
          aria-pressed={team === t.key}
          onclick={() => switchTeam(t.key)}
        >
          {t.short}
        </button>
      {/each}
    </div>
    <h1>
      Les {meta.total} matchs des {teamName} de {meta.firstYear} à {meta.lastYear}
    </h1>
    <p class="hint">
      Survolez ou cliquez sur un match pour obtenir plus d'informations et explorer les données.
    </p>
    {#if videoCount || articleCount}
      <p class="hint media-hint">
        Cliquez sur les points pour retrouver
        {#if videoCount}
          {videoCount} résumés de matchs en vidéo sur
          <span class="brand-chip"><img src="{base}/logos/auvio.svg" alt="Auvio" /></span>
        {/if}
        {#if videoCount && articleCount}et{/if}
        {#if articleCount}
          {articleCount} articles sur
          <span class="brand-chip"
            ><img class="actus" src="{base}/logos/rtbf-actus.svg" alt="RTBF Actus" /></span
          >
        {/if}
      </p>
    {/if}
  </header>

  <div class="layout">
    <!-- filters column (left on desktop, below the viz on mobile) -->
    <div class="controls">
      <div class="filter-group">
        <h4>Filtrer par compétition</h4>
        <FilterBar
          bind:active={activeFilter}
          {categories}
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
              style:--c={RESULT_VARS[code as 'W' | 'D' | 'L']}
              onclick={() => (activeResult = activeResult === code ? null : (code as 'W' | 'D' | 'L'))}
            >
              <span class="swatch" style:background={RESULT_VARS[code as 'W' | 'D' | 'L']}></span>
              {label}
              <span class="count">({resultCounts[code as 'W' | 'D' | 'L']})</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="filter-group">
        <h4>Mettre en évidence une série</h4>
        <RecordsButtons {meta} bind:highlight={recordHighlight} bind:activeKey={recordKey} />
      </div>

      <!-- legend + map zoom controls -->
      <div class="filter-group legend-group">
        <h4>Légende</h4>
        <div class="legend">
          <div class="results-row">
            {#each results as r}
              <div class="legend-row">
                <span class="dot" style:background={RESULT_VARS[r]}></span>
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
      <!-- the viz — remounted on team switch so the reveal animation replays -->
      <div class="viz">
        {#key team}
          <CartoChronologie
            allMatches={matches}
            {filtered}
            {recordHighlight}
            filterActive={!!activeFilter || !!activeResult}
            bind:selected
            bind:hovered
            bind:cityInfo
            bind:controls={mapControls}
          />
        {/key}
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
        <MatchDetail match={selected} {team} onclose={() => (selected = null)} />
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
  main {
    max-width: 1320px;
    margin: 0 auto;
    /* Embedded (pym): no outer padding/margin — the host page provides spacing and
       pym sizes the iframe to the content, so any gutter here is wasted height. */
    padding: 0;
    overflow-x: clip; /* never let the viz/legend cause horizontal scroll */
  }
  /* standalone (not embedded in an iframe): add comfortable gutters + fill height */
  :global(body.standalone) main {
    min-height: 100dvh;
    padding: 24px 20px 40px;
  }
  header {
    margin-bottom: 22px; /* breathing room before the filters / viz */
  }
  header h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 8px;
  }
  /* team toggle: two pill buttons (Diables Rouges / Red Flames) above the title */
  .team-toggle {
    display: inline-flex;
    gap: 0;
    margin: 0 0 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px;
    background: var(--surface-2);
  }
  .team-btn {
    border: none;
    background: none;
    padding: 6px 18px;
    border-radius: 999px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .team-btn:hover {
    color: var(--text);
  }
  .team-btn.on {
    background: var(--accent);
    color: var(--accent-contrast);
    box-shadow: 0 1px 3px var(--accent-shadow);
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
    color: var(--text-muted);
    line-height: 1.45;
    margin: 6px 0 0;
  }
  /* media availability hint, with inline brand logos on small dark chips so both
     the yellow Auvio mark and the (inverted) RTBF Actus mark read in either theme.
     Kept as flowing text (not flex) so the sentence wraps naturally and never
     overflows its box or the column. */
  .media-hint {
    margin-top: 4px;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .brand-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 5px;
    background: #15191f;
    vertical-align: middle;
    margin: 0 1px;
  }
  .brand-chip img {
    height: 13px;
    width: auto;
    display: block;
  }
  .brand-chip img.actus {
    filter: brightness(0) invert(1); /* RTBF Actus ships black → white on the dark chip */
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
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    border-radius: 7px;
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.12s;
  }
  .zoom-buttons button:hover {
    border-color: var(--border-strong);
    background: var(--surface-hover);
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
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
    background: var(--map-host);
  }
  /* year-ring colour scale: empty (no match) → light → deep */
  .year-scale-row {
    align-items: center;
    flex-wrap: wrap;
  }
  .year-scale {
    width: 88px;
    height: 11px;
    border-radius: 3px;
    display: inline-block;
    background: linear-gradient(
      to right,
      var(--year-empty) 0%,
      var(--year-low) 18%,
      var(--year-high) 100%
    );
  }
  .scale-labels {
    font-size: 11px;
    color: var(--text-muted);
  }
  .scale-labels .arrow {
    color: var(--text-muted);
  }
  /* backdrop sits above everything (incl. the viz) so any click/tap outside the
     panel closes it — on desktop and on touch alike */
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--backdrop);
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
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.28);
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
    color: var(--text-muted);
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
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    border-radius: 8px;
    padding: 4px 14px;
    font-size: 13px;
    font-weight: 600; /* constant weight active/inactive → no reflow on toggle */
    line-height: 1.2;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .result-filter .chip:hover {
    border-color: var(--border-strong);
  }
  /* « Tous les résultats » (sans pastille) : actif neutre */
  .result-filter .chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }
  /* résultats colorés : actif teinté de leur couleur */
  .result-filter .chip.on:has(.swatch) {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, var(--surface));
    color: var(--text);
  }
  .result-filter .swatch {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    display: inline-block;
  }
  .result-filter .count {
    color: var(--text-muted);
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
    z-index: 7; /* above the viz (z-5) so its links are clickable */
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
    pointer-events: none; /* let clicks fall through to the wheel… */
  }
  .source a {
    pointer-events: auto; /* …except on the links */
    color: var(--text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .source a:hover {
    color: var(--accent);
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
  /* tighter gutters on small standalone screens (embedded stays flush) */
  @media (max-width: 720px) {
    :global(body.standalone) main {
      padding: 16px 10px 32px;
    }
  }
</style>
