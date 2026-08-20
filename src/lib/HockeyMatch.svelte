<script lang="ts">
  import HockeyStats from './HockeyStats.svelte';
  import { flagUrl, matchSideName, matchSideCode, phaseLabel, eventTeamCode, eventTeamName, cardClass, fmtDateTime, videoOf, type Gender, type HockeyVideoRef, type Match } from './hockey/data';

  let { match, gender, onclose, onvideo }: { match: Match; gender: Gender; onclose: () => void; onvideo?: (video: HockeyVideoRef) => void } = $props();

  const video = $derived(videoOf(gender, match));

  const winner = $derived.by(() => {
    if (!match.played || match.hg == null || match.ag == null) return null;
    if (match.hg === match.ag && match.so) return match.so[0] > match.so[1] ? 'home' : 'away';
    return match.hg > match.ag ? 'home' : 'away';
  });

  const typeLabel = (t: string | null, action: string) => {
    if (t === 'PC') return 'penalty-corner';
    if (t === 'FG') return 'jeu';
    if (t === 'PS') return 'stroke';
    return action?.toLowerCase() ?? '';
  };

</script>

<div class="card">
  <button class="close" onclick={onclose} aria-label="Fermer">✕</button>

  <div class="scoreline">
    <div class="side" class:win={winner === 'home'}>
      {#if matchSideCode(gender, match, 'home')}<img class="fl" src={flagUrl(matchSideCode(gender, match, 'home'))} alt="" />{:else}<span class="seed">?</span>{/if}
      <span class="nm">{matchSideName(gender, match, 'home')}</span>
    </div>
    <div class="score">
      {#if match.played}
        <span class="sc">{match.hg}<span class="dash">–</span>{match.ag}</span>
        {#if match.so}<span class="so">t.a.b. {match.so[0]}–{match.so[1]}</span>{/if}
      {:else}
        <span class="vs">à venir</span>
      {/if}
    </div>
    <div class="side" class:win={winner === 'away'}>
      {#if matchSideCode(gender, match, 'away')}<img class="fl" src={flagUrl(matchSideCode(gender, match, 'away'))} alt="" />{:else}<span class="seed">?</span>{/if}
      <span class="nm">{matchSideName(gender, match, 'away')}</span>
    </div>
  </div>

  <p class="meta">
    {#if match.phase}<span class="chip">{phaseLabel(match.phase)}</span>{/if}
    {fmtDateTime(match.utc)}
  </p>

  {#if match.venue}
    <p class="venue">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.6a4.4 4.4 0 0 0-4.4 4.4c0 3.1 4.4 8 4.4 8s4.4-4.9 4.4-8A4.4 4.4 0 0 0 8 1.6Z" /><circle cx="8" cy="6" r="1.7" /></svg>
      {match.venue}
    </p>
  {/if}

  {#if video}
    <button class="video-btn" onclick={() => onvideo?.(video)}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="8" /><path d="M6.2 4.8 11 8l-4.8 3.2z" /></svg>
      {video.kind === 'replay' ? 'Revoir le match' : 'Voir le résumé vidéo'}
    </button>
  {/if}

  {#if match.played}<HockeyStats {match} {gender} />{/if}

  {#if match.scorers && match.scorers.length}
    <h4>Buteurs</h4>
    <ul class="goals">
      {#each match.scorers as g}
        <li>
          <span class="min">{g.minute}′</span>
          <img class="gfl" src={flagUrl(eventTeamCode(gender, match, g.team))} alt="" />
          <span class="pl">{g.player}</span>
          <span class="ty">{typeLabel(g.type, g.action)}</span>
          <span class="run">{g.score}</span>
        </li>
      {/each}
    </ul>
  {:else if match.played}
    <p class="empty">Aucun détail de buteur disponible.</p>
  {/if}

  {#if match.cards && match.cards.length}
    <h4>Cartons</h4>
    <ul class="cards">
      {#each match.cards as c}
        <li>
          <span class="min">{c.minute}′</span>
          <span class="dot {cardClass(c.card)}"></span>
          <span class="pl">{c.player}</span>
          <span class="ty">{eventTeamName(gender, match, c.team)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .card {
    position: relative;
    font-family: var(--font);
  }
  .close {
    position: absolute;
    top: 0;
    right: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--surface-2, rgba(0, 0, 0, 0.05));
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13px;
  }
  .close:hover {
    color: var(--text);
  }
  .scoreline {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 14px;
    margin: 4px 0 10px;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }
  .fl {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border);
  }
  .seed {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px dashed var(--border-strong);
    display: grid;
    place-items: center;
    color: var(--text-muted);
    font-size: 17px;
    font-weight: 700;
  }
  .nm {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
  }
  .side.win .nm {
    color: var(--hk-accent);
  }
  .score {
    text-align: center;
    min-width: 84px;
  }
  .sc {
    font-size: 34px;
    font-weight: 800;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    display: block;
  }
  .dash {
    margin: 0 4px;
    color: var(--text-muted);
  }
  .so {
    font-size: 11px;
    color: var(--text-muted);
  }
  .vs {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-muted);
  }
  .meta {
    text-align: center;
    font-size: 11.5px;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .venue {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 14px;
  }
  .venue svg {
    flex: none;
    fill: var(--hk-accent, var(--accent));
  }
  .chip {
    display: inline-block;
    background: var(--hk-accent-soft, rgba(0, 0, 0, 0.06));
    color: var(--hk-accent);
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 20px;
    margin-right: 6px;
  }
  .video-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin: 0 auto 14px;
    padding: 7px 12px;
    border: 1px solid var(--hk-accent);
    border-radius: 999px;
    background: var(--surface);
    color: var(--hk-accent);
    font: 700 12px var(--font);
    cursor: pointer;
  }
  .video-btn:hover {
    background: var(--hk-accent-soft);
  }
  .video-btn svg circle {
    fill: var(--hk-accent);
  }
  .video-btn svg path {
    fill: #fff;
  }
  h4 {
    margin: 12px 0 6px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    padding: 4px 6px;
    border-radius: 6px;
  }
  li:nth-child(odd) {
    background: var(--surface-2, rgba(0, 0, 0, 0.03));
  }
  .min {
    width: 30px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .gfl {
    width: 17px;
    height: 17px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .pl {
    flex: 1;
    color: var(--text);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ty {
    color: var(--text-muted);
    font-size: 11px;
  }
  .run {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .dot {
    width: 11px;
    height: 14px;
    border-radius: 2px;
    flex: none;
  }
  .dot.green {
    background: #2e9e5b;
  }
  .dot.yellow {
    background: #e6b800;
  }
  .dot.red {
    background: #d63b3b;
  }
  .empty {
    font-size: 12px;
    color: var(--text-muted);
    margin: 4px 0 0;
  }
</style>
