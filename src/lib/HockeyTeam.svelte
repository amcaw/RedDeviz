<script lang="ts">
  import HockeyStats from './HockeyStats.svelte';
  import { comp, flagUrl, teamName, eventTeamCode, cardClass, fmtDateTime, fmtTime, dayKey, todayKey, videoOf, type Gender, type HockeyVideoRef, type Match } from './hockey/data';

  let { gender, code, onclose, onvideo }: { gender: Gender; code: string; onclose: () => void; onvideo?: (video: HockeyVideoRef) => void } = $props();

  const cp = $derived(comp(gender));

  const standing = $derived.by(() => {
    for (const p of Object.values(cp.pools)) {
      const t = p.teams.find((x) => x.code === code);
      if (t) return { pool: p.letter, t };
    }
    return null;
  });

  const teamMatches = $derived(
    cp.matches
      .filter((m) => m.home === code || m.away === code)
      .sort((a, b) => (a.utc ?? '').localeCompare(b.utc ?? ''))
  );

  const today = todayKey();
  let expanded = $state<number | null>(null);

  const opp = (m: Match) => (m.home === code ? m.away : m.home);
  const outcome = (m: Match): 'win' | 'loss' | 'draw' | null => {
    if (!m.played || m.hg == null || m.ag == null) return null;
    const mine = m.home === code ? m.hg : m.ag;
    const his = m.home === code ? m.ag : m.hg;
    if (mine === his) return 'draw';
    return mine > his ? 'win' : 'loss';
  };
  const video = (m: Match) => videoOf(gender, m);
  const canExpand = (m: Match) => m.played && !!(m.stats || m.scorers?.length || m.cards?.length || video(m));
  const typeLabel = (t: string | null) => (t === 'PC' ? 'penalty-corner' : t === 'PS' ? 'stroke' : 'jeu');
  const scorerCode = (m: Match, team: string) => eventTeamCode(gender, m, team);
</script>

<div class="team-card">
  <button class="close" onclick={onclose} aria-label="Fermer">✕</button>

  <div class="head">
    <img class="fl" src={flagUrl(code)} alt="" />
    <div>
      <h3>{teamName(gender, code)}</h3>
      {#if standing}
        <p class="sub">
          Poule {standing.pool}
          {#if standing.t.gp > 0}· {standing.t.rank}ᵉ · {standing.t.pts} pt{standing.t.pts > 1 ? 's' : ''} · {standing.t.w}V {standing.t.d}N {standing.t.l}D{/if}
        </p>
      {/if}
    </div>
  </div>

  <h4>Son parcours</h4>
  {#if teamMatches.some(canExpand)}
    <p class="expand-hint"><span aria-hidden="true">↘</span> Cliquez ou touchez un match joué pour dérouler son détail.</p>
  {/if}
  <ul class="matches">
    {#each teamMatches as m}
      {@const o = outcome(m)}
      {@const exp = canExpand(m)}
      {@const open = expanded === m.id}
      <li class:today={dayKey(m.utc) === today}>
        <button class="row" class:plain={!exp} onclick={() => exp && (expanded = open ? null : m.id)} aria-expanded={exp ? open : undefined}>
          {#if o}<span class="badge {o}">{o === 'win' ? 'V' : o === 'loss' ? 'D' : 'N'}</span>{:else}<span class="when">{fmtTime(m.utc)}</span>{/if}
          <span class="opp"><img src={flagUrl(opp(m))} alt="" />{teamName(gender, opp(m))}</span>
          <span class="sc">
            {#if m.played}<b>{m.home === code ? `${m.hg}–${m.ag}` : `${m.ag}–${m.hg}`}</b>{:else}<span class="d">{fmtDateTime(m.utc).split(',')[0]}</span>{/if}
          </span>
          {#if exp}<span class="chev" class:open>›</span>{:else}<span class="chev-sp"></span>{/if}
        </button>

        {#if open}
          {@const clip = video(m)}
          <div class="detail">
            <p class="venue">{fmtDateTime(m.utc)}{m.venue ? ` · ${m.venue}` : ''}</p>
            <HockeyStats match={m} {gender} />
            {#if clip}
              <button class="video-btn" onclick={() => onvideo?.(clip)}>
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="8" cy="8" r="8" /><path d="M6.2 4.8 11 8l-4.8 3.2z" /></svg>
                {clip.kind === 'replay' ? 'Revoir le match' : 'Voir le résumé vidéo'}
              </button>
            {/if}
            {#if m.scorers?.length}
              <ul class="ev">
                {#each m.scorers as g}
                  <li><span class="min">{g.minute}′</span><img class="gf" src={flagUrl(scorerCode(m, g.team))} alt="" /><span class="pl">{g.player}</span><span class="ty">{typeLabel(g.type)}</span><span class="run">{g.score}</span></li>
                {/each}
              </ul>
            {/if}
            {#if m.cards?.length}
              <ul class="ev cards">
                {#each m.cards as c}
                  <li><span class="min">{c.minute}′</span><span class="cd {cardClass(c.card)}"></span><span class="pl">{c.player}</span></li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .team-card {
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
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 0 16px;
  }
  .fl {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border);
    flex: none;
  }
  h3 {
    margin: 0;
    font-size: 19px;
    font-weight: 800;
    color: var(--text);
  }
  .sub {
    margin: 2px 0 0;
    font-size: 11.5px;
    color: var(--text-muted);
  }
  h4 {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .expand-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: -2px 0 9px;
    color: var(--text-muted);
    font-size: 10.5px;
    line-height: 1.35;
  }
  .expand-hint span {
    color: var(--hk-accent);
    font-weight: 800;
  }
  .matches {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .matches > li {
    border: 1px solid var(--divider);
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface-2, rgba(0, 0, 0, 0.03));
  }
  .matches > li.today {
    border-color: var(--hk-accent);
  }
  .row {
    width: 100%;
    display: grid;
    grid-template-columns: 26px 1fr auto 16px;
    align-items: center;
    gap: 9px;
    background: none;
    border: none;
    padding: 9px 11px;
    cursor: pointer;
    font: 400 12.5px var(--font);
    text-align: left;
  }
  .row.plain {
    cursor: default;
  }
  .when {
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .badge {
    width: 22px;
    height: 20px;
    border-radius: 5px;
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 800;
    color: #fff;
  }
  .badge.win {
    background: #2e9e5b;
  }
  .badge.loss {
    background: #d63b3b;
  }
  .badge.draw {
    background: #8a8a8a;
  }
  .opp {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .opp img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .sc b {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    color: var(--text);
  }
  .sc .d {
    font-size: 10.5px;
    color: var(--text-muted);
  }
  .chev {
    color: var(--text-muted);
    font-size: 15px;
    font-weight: 700;
    text-align: center;
    transition: transform 0.16s ease;
    display: inline-block;
  }
  .chev.open {
    transform: rotate(90deg);
    color: var(--hk-accent);
  }
  .chev-sp {
    width: 16px;
  }
  .detail {
    padding: 2px 12px 10px;
    border-top: 1px solid var(--divider);
  }
  .venue {
    margin: 8px 0 6px;
    font-size: 10.5px;
    color: var(--text-muted);
  }
  .video-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 7px 0 9px;
    padding: 5px 9px;
    border: 1px solid var(--hk-accent);
    border-radius: 999px;
    background: var(--surface);
    color: var(--hk-accent);
    font: 700 11px var(--font);
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
  .ev {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ev li {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
  }
  .ev .min {
    width: 26px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .ev .gf {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .ev .pl {
    flex: 1;
    color: var(--text);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ev .ty {
    color: var(--text-muted);
    font-size: 10.5px;
  }
  .ev .run {
    color: var(--text-secondary);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .cards {
    margin-top: 6px;
  }
  .cd {
    width: 11px;
    height: 14px;
    border-radius: 2px;
    flex: none;
  }
  .cd.green {
    background: #2e9e5b;
  }
  .cd.yellow {
    background: #e6b800;
  }
  .cd.red {
    background: #d63b3b;
  }
</style>
