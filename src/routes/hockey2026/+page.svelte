<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import HockeyFunnel from '$lib/HockeyFunnel.svelte';
  import HockeyMatch from '$lib/HockeyMatch.svelte';
  import HockeyTeam from '$lib/HockeyTeam.svelte';
  import HockeyVideo from '$lib/HockeyVideo.svelte';
  import { comp, flagUrl, matchSideName, phaseLabel, fmtDateTime, fmtDay, dayKey, todayKey, videoOf, type Gender, type HockeyVideoRef, type Match } from '$lib/hockey/data';
  import { initPym, sendHeight } from '$lib/pym.js';

  initPym();

  type Drawer = { kind: 'team'; code: string } | { kind: 'match'; match: Match };

  let gender = $state<Gender>('men');
  let ready = $state(false);
  let drawer = $state<Drawer | null>(null);
  let video = $state<HockeyVideoRef | null>(null);

  const today = todayKey();

  onMount(() => {
    ready = true;
  });

  const openMatch = (match: Match) => (drawer = { kind: 'match', match });
  const openTeam = (code: string) => (drawer = { kind: 'team', code });

  const days = $derived.by(() => {
    const ms = [...comp(gender).matches].filter((m) => m.utc || m.played);
    ms.sort((a, b) => (a.utc ?? '').localeCompare(b.utc ?? ''));
    const groups: { key: string; label: string; matches: Match[] }[] = [];
    for (const m of ms) {
      const k = dayKey(m.utc);
      let g = groups.find((x) => x.key === k);
      if (!g) {
        g = { key: k, label: fmtDay(m.utc), matches: [] };
        groups.push(g);
      }
      g.matches.push(m);
    }
    return groups;
  });

  $effect(() => {
    void gender;
    void drawer;
    void video;
    void ready;
    sendHeight();
  });
</script>

<svelte:head>
  <title>Coupe du Monde de Hockey 2026 · Belgique–Pays-Bas</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (video ? (video = null) : (drawer = null))} />

<main class="hockey">
  <p class="kicker">Coupe du Monde de Hockey · Belgique–Pays-Bas 2026</p>

  <div class="tabs">
    <button class:active={gender === 'men'} onclick={() => (gender = 'men')}>Hommes</button>
    <button class:active={gender === 'women'} onclick={() => (gender = 'women')}>Femmes</button>
  </div>

  {#if ready}
    <div class="stage">
      <HockeyFunnel
        {gender}
        onteam={openTeam}
        onmatch={openMatch}
      />

      <details class="read-viz" ontoggle={sendHeight}>
        <summary>
          <span>Comment lire cette visualisation ?</span>
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
        </summary>
        <div class="read-body">
          <p><strong>Du 15 au 20 août, première phase :</strong> le grand anneau représente les quatre poules A à D. Chaque équipe joue trois matchs, un contre chacun de ses adversaires. Les traits rouges relient les équipes qui s’affrontent à la date sélectionnée ; cliquez sur une équipe ou une liaison pour ouvrir son détail.</p>
          <p><strong>Deuxième phase, deux parcours :</strong> les 1ers et 2es de A et D forment la poule E, ceux de B et C la poule F, pour poursuivre la course au titre. Les 3es et 4es suivent la même logique dans les poules de classement G et H, pour les places 9 à 16.</p>
          <p><strong>Seulement deux nouveaux matchs :</strong> dans E, F, G ou H, une équipe affronte uniquement les deux adversaires venus de l’autre poule initiale. Le résultat déjà obtenu contre l’équipe issue de sa propre poule est conservé et compte dans le nouveau classement.</p>
          <p><strong>Pour le titre :</strong> les deux premiers de E et F jouent les demi-finales croisées, 1er E–2e F et 1er F–2e E. Les vainqueurs disputent la finale et les perdants la petite finale.</p>
          <p><strong>Pour toutes les autres places :</strong> le 3e de E affronte le 3e de F pour les places 5–6, et les 4es jouent pour les places 7–8. Les équipes de même rang dans G et H se rencontrent pour déterminer successivement les places 9–10, 11–12, 13–14 et 15–16.</p>
        </div>
      </details>
    </div>

    <section class="matches">
      <h2>Le calendrier</h2>
      {#each days as day}
        <div class="day" class:istoday={day.key === today}>
          <p class="day-lbl">
            {day.label}
            {#if day.key === today}<span class="today-badge">aujourd'hui</span>{/if}
          </p>
          <ul>
            {#each day.matches as m}
              {@const win = m.played && m.hg != null && m.ag != null ? (m.hg > m.ag || (m.hg === m.ag && m.so && m.so[0] > m.so[1]) ? 'h' : 'a') : null}
              {@const clip = videoOf(gender, m)}
              <li class="match-wrap">
                <button class="match" class:has-video={!!clip} class:istoday={day.key === today} onclick={() => openMatch(m)}>
                  <span class="teams">
                    <span class="trow" class:lose={win === 'a'}>
                      {#if m.home}<img src={flagUrl(m.home)} alt="" />{:else}<span class="seed" aria-hidden="true">?</span>{/if}
                      <span class="nm">{matchSideName(gender, m, 'home')}</span>
                      {#if m.played}<span class="sc">{m.hg}</span>{/if}
                    </span>
                    <span class="trow" class:lose={win === 'h'}>
                      {#if m.away}<img src={flagUrl(m.away)} alt="" />{:else}<span class="seed" aria-hidden="true">?</span>{/if}
                      <span class="nm">{matchSideName(gender, m, 'away')}</span>
                      {#if m.played}<span class="sc">{m.ag}</span>{/if}
                    </span>
                  </span>
                  <span class="meta">
                    <span class="t">{fmtDateTime(m.utc)}</span>
                    <span class="p">{m.played ? (m.status && m.status !== 'Official' ? 'En direct' : 'Terminé') : phaseLabel(m.phase)}</span>
                    {#if m.played}<span class="p">{phaseLabel(m.phase)}</span>{/if}
                  </span>
                </button>
                {#if clip}
                  <button class="calendar-video" onclick={() => (video = clip)} aria-label="Voir le résumé vidéo de {matchSideName(gender, m, 'home')} contre {matchSideName(gender, m, 'away')}">
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="8" /><path d="M6.2 4.8 11 8l-4.8 3.2z" /></svg>
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
      <p class="match-hint">
        <span aria-hidden="true">↗</span>
        Cliquez ou touchez un match joué pour afficher son détail.
      </p>
    </section>
  {:else}
    <p class="state">Chargement…</p>
  {/if}

  {#if drawer}
    <div class="backdrop" role="presentation" onclick={() => (drawer = null)}></div>
    <aside class="drawer" transition:fly={{ x: 420, duration: 220 }}>
      {#if drawer.kind === 'match'}
        <HockeyMatch match={drawer.match} {gender} onclose={() => (drawer = null)} onvideo={(clip) => (video = clip)} />
      {:else}
        <HockeyTeam {gender} code={drawer.code} onclose={() => (drawer = null)} onvideo={(clip) => (video = clip)} />
      {/if}
    </aside>
  {/if}

  {#if video}
    <div class="video-backdrop" role="presentation" onclick={() => (video = null)}></div>
    <div class="video-panel" role="dialog" aria-modal="true" aria-label="Résumé vidéo">
      <HockeyVideo videoId={video.id} title={video.title} kind={video.kind} onclose={() => (video = null)} />
    </div>
  {/if}

  <p class="source">
    Données officielles
    <a href="https://tms.fih.ch" target="_blank" rel="noreferrer">FIH TMS</a>
    · visualisation
    <a href="https://www.linkedin.com/in/ambroise-c-623703229/" target="_blank" rel="noreferrer">Ambroise Carton</a>
  </p>
</main>

<style>
  main {
    --hk-accent: #e2231a;
    --hk-accent-soft: rgba(226, 35, 26, 0.1);
    max-width: 880px;
    margin: 0 auto;
    padding: 0;
    overflow-x: clip;
  }
  :global(body.standalone) main {
    min-height: 100dvh;
    padding: 14px 16px 8px;
  }
  .kicker {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--hk-accent);
    margin: 0 0 12px;
  }
  .tabs {
    display: flex;
    width: 100%;
    max-width: 600px;
    gap: 8px;
    margin: 0 auto 14px;
  }
  .tabs button {
    flex: 1;
    appearance: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 7px 22px;
    color: var(--text-secondary);
    font: 700 13px var(--font);
    cursor: pointer;
    transition: all 0.14s;
  }
  .tabs button.active {
    background: var(--hk-accent);
    border-color: var(--hk-accent);
    color: #fff;
  }
  .stage {
    max-width: 600px;
    margin: 0 auto;
  }
  .read-viz {
    margin: 4px 0 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    overflow: hidden;
  }
  .read-viz summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 13px;
    color: var(--text);
    font: 700 12.5px var(--font);
    cursor: pointer;
    list-style: none;
  }
  .read-viz summary::-webkit-details-marker {
    display: none;
  }
  .read-viz summary:hover {
    color: var(--hk-accent);
  }
  .read-viz summary svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.18s ease;
  }
  .read-viz[open] summary svg {
    transform: rotate(180deg);
  }
  .read-body {
    padding: 11px 13px 13px;
    border-top: 1px solid var(--divider);
  }
  .read-body p {
    margin: 0 0 9px;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.45;
  }
  .read-body p:last-child {
    margin-bottom: 0;
  }
  .read-body strong {
    color: var(--text);
  }
  .matches {
    margin: 20px 0 0;
  }
  .matches h2 {
    text-align: center;
    font-size: 15px;
    font-weight: 800;
    margin: 0 0 14px;
  }
  .match-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 4px 0 0;
    color: var(--text-muted);
    font-size: 11px;
    text-align: center;
  }
  .match-hint span {
    color: var(--hk-accent);
    font-weight: 800;
  }
  .day {
    margin: 0 0 16px;
  }
  .day-lbl {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0 0 7px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--divider);
  }
  .day.istoday .day-lbl {
    color: var(--hk-accent);
    border-bottom-color: var(--hk-accent);
  }
  .today-badge {
    background: var(--hk-accent);
    color: #fff;
    font-size: 9px;
    padding: 1px 7px;
    border-radius: 20px;
    letter-spacing: 0.04em;
  }
  .day ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .match {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: 9px;
    padding: 9px 11px;
    cursor: pointer;
    font-family: var(--font);
    transition: border-color 0.14s;
  }
  .match-wrap {
    position: relative;
  }
  .match.has-video {
    padding-right: 43px;
  }
  .calendar-video {
    position: absolute;
    top: 50%;
    right: 10px;
    width: 25px;
    height: 25px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    transform: translateY(-50%);
    cursor: pointer;
  }
  .calendar-video svg {
    display: block;
  }
  .calendar-video circle {
    fill: var(--hk-accent);
  }
  .calendar-video path {
    fill: #fff;
  }
  .calendar-video:hover {
    transform: translateY(-50%) scale(1.08);
  }
  .match:hover,
  .match.istoday {
    border-color: var(--hk-accent);
  }
  .teams {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .trow img {
    width: 19px;
    height: 19px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .seed {
    width: 19px;
    height: 19px;
    border-radius: 50%;
    border: 1px dashed var(--border-strong);
    display: grid;
    place-items: center;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
    flex: none;
  }
  .trow .nm {
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .trow.lose .nm {
    color: var(--text-muted);
    font-weight: 500;
  }
  .trow .sc {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    font-size: 13px;
    color: var(--text);
  }
  .trow.lose .sc {
    color: var(--text-muted);
    font-weight: 600;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex: none;
    text-align: right;
  }
  .meta .t {
    max-width: 92px;
    font-size: 9.5px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    line-height: 1.25;
  }
  .meta .p {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--backdrop);
  }
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    height: 100dvh;
    width: min(430px, 92vw);
    background: var(--surface);
    border-left: 1px solid var(--border);
    box-shadow: -10px 0 40px var(--backdrop);
    z-index: 41;
    overflow-y: auto;
    padding: 22px 22px 30px;
  }
  .video-backdrop {
    position: fixed;
    inset: 0;
    z-index: 42;
    background: var(--backdrop);
  }
  .video-panel {
    position: fixed;
    z-index: 43;
    top: 50%;
    left: 50%;
    width: min(680px, calc(100vw - 28px));
    transform: translate(-50%, -50%);
    box-shadow: 0 18px 60px var(--backdrop);
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
    margin: 24px 0 0;
  }
  .source a {
    color: var(--text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .source a:hover {
    color: var(--hk-accent);
  }
</style>
