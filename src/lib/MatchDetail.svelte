<script lang="ts">
  import {
    RESULT_COLORS,
    RESULT_LABELS,
    loadDetail,
    fr,
    cityFr,
    competitionFr,
    type Match
  } from './data';

  let { match, onclose }: { match: Match; onclose: () => void } = $props();

  const dateFmt = $derived(
    new Date(match.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  );

  // Compact per-match detail (logos, scorers, referee, venue) from the bundle.
  const detail = $derived(loadDetail(match.id));

  function goalSuffix(kind: string): string {
    if (/penalty/i.test(kind)) return ' (pen.)';
    if (/own/i.test(kind)) return ' (csc)';
    return '';
  }

  const homeGoals = $derived(detail?.goals.filter((g) => g.side === 'home') ?? []);
  const awayGoals = $derived(detail?.goals.filter((g) => g.side === 'away') ?? []);
  const referee = $derived(detail?.referee ?? '');

  // Lieu (toujours en français) : ville du CSV, sinon ville du détail, sinon pays.
  const placeLabel = $derived(
    match.city ? cityFr(match.city) : detail?.city ? cityFr(detail.city) : fr(match.hostCountry)
  );
</script>

<div class="detail">
  <button class="close" onclick={onclose} aria-label="Fermer">×</button>

  <!-- header: competition · date -->
  <div class="head">
    <span class="head-left">{competitionFr(match.competition)} · {dateFmt}</span>
  </div>

  <!-- meta info, up top: ville · stade · arbitre (labels in full) -->
  <div class="meta">
    <span><span class="meta-label">Ville</span> {placeLabel}</span>
    {#if match.stadium || detail?.stadium}
      <span class="sep">·</span>
      <span><span class="meta-label">Stade</span> {match.stadium || detail?.stadium}</span>
    {/if}
    {#if match.coach}
      <span class="sep">·</span>
      <span><span class="meta-label">Sélectionneur</span> {match.coach}</span>
    {/if}
    {#if referee}
      <span class="sep">·</span>
      <span><span class="meta-label">Arbitre</span> {referee}</span>
    {/if}
  </div>

  <!-- scoreline: logo + name flanking a big "h - a" score -->
  <div class="scoreline">
    <div class="team" class:bel={match.home === 'Belgium'}>
      {#if detail?.homeLogo}
        <img
          src={detail.homeLogo}
          alt=""
          class="logo"
          onerror={(e) => (e.currentTarget.style.display = 'none')}
        />
      {/if}
      <span class="name">{fr(match.home)}</span>
    </div>

    <div class="score-col">
      <span
        class="result-pill"
        class:dark-text={match.result === 'D'}
        style:background={RESULT_COLORS[match.result]}
      >
        {RESULT_LABELS[match.result]}
      </span>
      <div class="score">
        <span class="n">{match.score.split('-')[0]}</span>
        <span class="dash">–</span>
        <span class="n">{match.score.split('-')[1]}</span>
      </div>
    </div>

    <div class="team" class:bel={match.away === 'Belgium'}>
      {#if detail?.awayLogo}
        <img
          src={detail.awayLogo}
          alt=""
          class="logo"
          onerror={(e) => (e.currentTarget.style.display = 'none')}
        />
      {/if}
      <span class="name">{fr(match.away)}</span>
    </div>
  </div>

  <!-- goal scorers: home left, away right, ball icon centred -->
  {#if homeGoals.length || awayGoals.length}
    <div class="scorers">
      <ul class="side left">
        {#each homeGoals as g}
          <li>{g.firstName} {g.lastName} <span class="min">{g.minute}'{goalSuffix(g.kind)}</span></li>
        {/each}
      </ul>
      <span class="ball" aria-hidden="true">⚽</span>
      <ul class="side right">
        {#each awayGoals as g}
          <li><span class="min">{g.minute}'{goalSuffix(g.kind)}</span> {g.firstName} {g.lastName}</li>
        {/each}
      </ul>
    </div>
  {/if}

</div>

<style>
  .detail {
    position: relative;
    background: #fff;
    border: 1px solid #e2e8f0;
    padding: 22px 32px 26px;
    font-family: var(--font, system-ui, sans-serif);
    overflow-y: auto;
  }
  .close {
    position: absolute;
    top: 14px;
    right: 18px;
    border: none;
    background: none;
    font-size: 26px;
    line-height: 1;
    color: #cbd5e1;
    cursor: pointer;
  }
  .close:hover {
    color: #1f2933;
  }

  /* header line: competition · date  …  status */
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    font-size: 15px;
    color: #64748b;
    padding-right: 36px; /* keep clear of the close button */
  }
  .head-left {
    font-weight: 500;
  }

  /* meta info up top */
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 12.5px;
    color: #94a3b8;
    padding-right: 36px; /* keep clear of the close button */
  }
  .meta .sep {
    color: #cbd5e1;
  }
  .meta .meta-label {
    font-weight: 700;
    color: #64748b;
  }

  /* scoreline */
  .scoreline {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: start;
    gap: 24px;
    margin: 26px 0 4px;
  }
  .team {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    font-size: 22px;
    color: #1f2933;
  }
  .team .name {
    font-weight: 500;
  }
  .team.bel .name {
    font-weight: 700;
  }
  .logo {
    width: 60px;
    height: 60px;
    object-fit: contain;
    border-radius: 8px;
  }
  .score-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .result-pill {
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 4px 14px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .result-pill.dark-text {
    color: #1f2933; /* readable on the yellow "Nul" pill */
  }
  .score {
    display: flex;
    align-items: center;
    gap: 22px;
  }
  .score .n {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #1f2933;
    line-height: 1;
  }
  .score .dash {
    font-size: 36px;
    color: #cbd5e1;
    line-height: 1;
  }

  /* scorers: home left, away right, ball centred */
  .scorers {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 4px 16px;
    align-items: start;
    font-size: 14px;
    color: #64748b;
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid #eef2f6;
  }
  .scorers ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .scorers .left {
    text-align: right;
  }
  .scorers .right {
    text-align: left;
  }
  .scorers li {
    margin-bottom: 3px;
  }
  .scorers .min {
    color: #b3bcc7;
    font-variant-numeric: tabular-nums;
  }
  .scorers .ball {
    font-size: 15px;
    line-height: 1.4;
  }
</style>
