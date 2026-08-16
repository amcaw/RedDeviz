<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
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
  let previousGender = $state<Gender | null>(null);
  let genderCrossfading = $state(false);
  let calendarVisible = $state(false);
  const showCalendarCue = $derived(!calendarVisible);
  let calendarEl = $state<HTMLElement>();
  let drawerEl = $state<HTMLElement>();
  let drawerTrigger: HTMLElement | SVGElement | null = null;

  const today = todayKey();

  onMount(() => {
    ready = true;
  });

  const rememberDrawerTrigger = () => {
    if (document.activeElement instanceof HTMLElement || document.activeElement instanceof SVGElement) drawerTrigger = document.activeElement;
  };
  const openMatch = (match: Match) => {
    rememberDrawerTrigger();
    drawer = { kind: 'match', match };
  };
  const openTeam = (code: string) => {
    rememberDrawerTrigger();
    drawer = { kind: 'team', code };
  };
  const closeDrawer = () => {
    const trigger = drawerTrigger;
    drawer = null;
    drawerTrigger = null;
    window.requestAnimationFrame(() => trigger?.focus());
  };
  const drawerFly = (node: Element) => {
    const mobile = window.matchMedia('(max-width: 560px)').matches;
    return fly(node, { x: mobile ? 0 : 420, y: mobile ? 80 : 0, duration: 220 });
  };
  const trapDrawerFocus = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !drawerEl) return;
    const items = [...drawerEl.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter(
      (item) => item.offsetParent !== null
    );
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const switchGender = (next: Gender) => {
    if (next === gender || genderCrossfading) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gender = next;
      return;
    }
    previousGender = gender;
    gender = next;
    genderCrossfading = true;
    window.setTimeout(() => {
      genderCrossfading = false;
      previousGender = null;
    }, 240);
  };
  const goToCalendar = () => {
    calendarEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $effect(() => {
    const el = calendarEl;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => (calendarVisible = entry.isIntersecting), {
      rootMargin: '0px 0px -25% 0px'
    });
    io.observe(el);
    return () => io.disconnect();
  });

  const groupDays = (forGender: Gender) => {
    const ms = [...comp(forGender).matches].filter((m) => m.utc || m.played);
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
  };
  const days = $derived(groupDays(gender));
  const previousDays = $derived(previousGender ? groupDays(previousGender) : []);

  $effect(() => {
    void gender;
    void drawer;
    void video;
    void ready;
    sendHeight();
  });

  $effect(() => {
    if (!drawer && !video) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });

  $effect(() => {
    if (!drawer || !drawerEl) return;
    window.requestAnimationFrame(() => {
      const close = [...(drawerEl?.querySelectorAll<HTMLElement>('.drawer-mobile-close, .close') ?? [])].find((item) => item.offsetParent !== null);
      close?.focus();
    });
  });
</script>

<svelte:head>
  <title>Coupe du Monde de Hockey 2026 · Belgique–Pays-Bas</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (video ? (video = null) : closeDrawer())} />

<main class="hockey">
  <p class="kicker">Coupe du Monde de Hockey · Belgique–Pays-Bas 2026</p>

  <div class="tabs">
    <button class:active={gender === 'men'} onclick={() => switchGender('men')}>Hommes</button>
    <button class:active={gender === 'women'} onclick={() => switchGender('women')}>Femmes</button>
  </div>

  {#if ready}
    <div class="gender-view">
      <div class="visual-shell">
      <div class="stage">
        <HockeyFunnel
          {gender}
          {previousGender}
          crossfading={genderCrossfading}
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
            <p><strong>Nations atténuées :</strong> elles ne sont plus en course pour le titre, mais restent visibles car leur tournoi continue dans les poules ou les matchs de classement. Une nation n'est donc jamais retirée de la visualisation.</p>
          </div>
        </details>
      </div>
      <div class="calendar-cue-reserve">
        {#if showCalendarCue && !drawer && !video}
          <button class="calendar-cue" onclick={goToCalendar} aria-label="Aller au calendrier">
            <span>Voir le calendrier</span>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
          </button>
        {/if}
      </div>
      </div>

      <section class="matches" bind:this={calendarEl}>
      <h2>Le calendrier</h2>
      {#each days as day}
        <div class="day" class:istoday={day.key === today}>
          <p class="day-lbl">
            {day.label}
            {#if day.key === today}<span class="today-badge">aujourd'hui</span>{/if}
          </p>
          <ul>
            {#each day.matches as m, mi}
              {@const win = m.played && m.hg != null && m.ag != null ? (m.hg > m.ag || (m.hg === m.ag && m.so && m.so[0] > m.so[1]) ? 'h' : 'a') : null}
              {@const clip = videoOf(gender, m)}
              {@const oldMatch = previousDays.find((oldDay) => oldDay.key === day.key)?.matches[mi]}
              <li class="match-wrap">
                <button class="match" class:has-video={!!clip} class:istoday={day.key === today} onclick={() => openMatch(m)}>
                  <span class="teams-stack">
                    <span class="teams" class:incoming={genderCrossfading}>
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
                    {#if genderCrossfading && previousGender && oldMatch}
                      {@const oldWin = oldMatch.played && oldMatch.hg != null && oldMatch.ag != null ? (oldMatch.hg > oldMatch.ag || (oldMatch.hg === oldMatch.ag && oldMatch.so && oldMatch.so[0] > oldMatch.so[1]) ? 'h' : 'a') : null}
                      <span class="teams outgoing" aria-hidden="true">
                        <span class="trow" class:lose={oldWin === 'a'}>
                          {#if oldMatch.home}<img src={flagUrl(oldMatch.home)} alt="" />{:else}<span class="seed">?</span>{/if}
                          <span class="nm">{matchSideName(previousGender, oldMatch, 'home')}</span>
                          {#if oldMatch.played}<span class="sc">{oldMatch.hg}</span>{/if}
                        </span>
                        <span class="trow" class:lose={oldWin === 'h'}>
                          {#if oldMatch.away}<img src={flagUrl(oldMatch.away)} alt="" />{:else}<span class="seed">?</span>{/if}
                          <span class="nm">{matchSideName(previousGender, oldMatch, 'away')}</span>
                          {#if oldMatch.played}<span class="sc">{oldMatch.ag}</span>{/if}
                        </span>
                      </span>
                    {/if}
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
    </div>
  {:else}
    <p class="state">Chargement…</p>
  {/if}

  {#if drawer}
    <div class="backdrop" role="presentation" transition:fade={{ duration: 180 }} onclick={closeDrawer}></div>
    <div
      class="drawer"
      bind:this={drawerEl}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label={drawer.kind === 'match' ? 'Détail du match' : 'Détail de l’équipe'}
      transition:drawerFly
      onkeydown={trapDrawerFocus}
    >
      <div class="drawer-mobile-head">
        <span class="drawer-handle" aria-hidden="true"></span>
        <button class="drawer-mobile-close" onclick={closeDrawer} aria-label="Fermer">✕</button>
      </div>
      <div class="drawer-content">
        {#if drawer.kind === 'match'}
          <HockeyMatch match={drawer.match} {gender} onclose={closeDrawer} onvideo={(clip) => (video = clip)} />
        {:else}
          <HockeyTeam {gender} code={drawer.code} onclose={closeDrawer} onvideo={(clip) => (video = clip)} />
        {/if}
      </div>
    </div>
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
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }
  .gender-view {
    opacity: 1;
  }
  .visual-shell {
    width: 100%;
  }
  :global(body.standalone) .visual-shell {
    display: flex;
    min-height: calc(100svh - 96px);
    flex-direction: column;
  }
  .calendar-cue-reserve {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: 100%;
    height: 58px;
  }
  :global(body.standalone) .calendar-cue-reserve {
    flex: none;
    margin-top: auto;
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
    scroll-margin-top: 16px;
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
  .calendar-cue {
    position: relative;
    z-index: 20;
    box-sizing: border-box;
    max-width: calc(100vw - 32px);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px 9px 16px;
    border: 1px solid color-mix(in srgb, var(--hk-accent) 34%, var(--border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    box-shadow: 0 8px 28px rgba(20, 20, 25, 0.16);
    color: var(--text);
    font: 750 11.5px var(--font);
    backdrop-filter: blur(10px);
    cursor: pointer;
    white-space: nowrap;
    animation: cue-in 0.35s cubic-bezier(0.2, 0.75, 0.25, 1) both;
  }
  :global(body.standalone) .calendar-cue {
    position: fixed;
    left: 50%;
    bottom: max(14px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
  }
  .calendar-cue:hover {
    border-color: var(--hk-accent);
    color: var(--hk-accent);
    box-shadow: 0 10px 32px rgba(226, 35, 26, 0.16);
  }
  .calendar-cue svg {
    fill: none;
    stroke: var(--hk-accent);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: cue-arrow 1.4s ease-in-out infinite;
  }
  @keyframes cue-in {
    from {
      opacity: 0;
    }
  }
  @keyframes cue-arrow {
    50% {
      transform: translateY(2px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .calendar-cue,
    .calendar-cue svg,
    .teams {
      animation: none;
      transition: none;
    }
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
  .teams-stack {
    position: relative;
    min-width: 0;
  }
  .teams {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .teams.incoming {
    animation: nations-in 0.24s ease both;
  }
  .teams.outgoing {
    position: absolute;
    inset: 0;
    pointer-events: none;
    animation: nations-out 0.24s ease both;
  }
  @keyframes nations-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes nations-out {
    from { opacity: 1; }
    to { opacity: 0; }
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
    overscroll-behavior: contain;
  }
  .drawer-content {
    padding: 22px 22px 30px;
  }
  .drawer-mobile-head {
    display: none;
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
  @media (max-width: 560px) {
    .drawer {
      top: auto;
      right: 0;
      bottom: 0;
      width: 100%;
      height: min(84dvh, 760px);
      max-height: 90dvh;
      border: 1px solid var(--border);
      border-bottom: 0;
      border-radius: 18px 18px 0 0;
      box-shadow: 0 -12px 42px var(--backdrop);
    }
    .drawer-mobile-head {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      height: 42px;
      padding: 6px 12px 4px;
      background: var(--surface);
      border-radius: 18px 18px 0 0;
    }
    .drawer-handle {
      position: absolute;
      top: 9px;
      left: 50%;
      width: 38px;
      height: 4px;
      border-radius: 999px;
      background: var(--border-strong);
      transform: translateX(-50%);
    }
    .drawer-mobile-close {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: var(--surface-2, rgba(0, 0, 0, 0.05));
      color: var(--text-muted);
      font: 600 13px var(--font);
      cursor: pointer;
    }
    .drawer-content {
      padding: 0 16px calc(22px + env(safe-area-inset-bottom));
    }
    .drawer-content :global(.close) {
      display: none;
    }
    .day ul {
      grid-template-columns: 1fr;
      gap: 7px;
    }
    .match {
      min-height: 62px;
      grid-template-columns: minmax(0, 1fr) minmax(94px, 35%);
      padding: 9px 12px;
    }
    .match.has-video {
      padding-right: 45px;
    }
    .trow .nm {
      white-space: normal;
      overflow: visible;
      line-height: 1.18;
      text-overflow: clip;
      overflow-wrap: anywhere;
    }
    .meta {
      min-width: 0;
    }
    .meta .t {
      max-width: none;
    }
    .meta .p {
      max-width: 100%;
      white-space: normal;
      line-height: 1.2;
    }
  }
</style>
