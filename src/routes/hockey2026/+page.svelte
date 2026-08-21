<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import HockeyFunnel from '$lib/HockeyFunnel.svelte';
  import HockeyMatch from '$lib/HockeyMatch.svelte';
  import HockeyTeam from '$lib/HockeyTeam.svelte';
  import HockeyVideo from '$lib/HockeyVideo.svelte';
  import { comp, flagUrl, matchSideName, matchSideCode, phaseLabel, frPeriod, fmtDateTime, fmtTime, fmtDay, dayKey, todayKey, videoOf, type Gender, type HockeyVideoRef, type Match } from '$lib/hockey/data';
  import { initPym, sendHeight } from '$lib/pym.js';
  import { startLive, liveScore, isLiveStatus, isFinishedStatus } from '$lib/hockey/live.svelte';

  const LIVE_WORKER = 'https://hockey.ambc.workers.dev';

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

  let now = $state(Date.now());

  const matchState = (m: Match): 'live' | 'done' | 'upcoming' => {
    const s = m.status ?? '';
    if (isLiveStatus(s) && s !== 'Official') return 'live';
    if (m.played) return 'done';
    return 'upcoming';
  };

  const countdown = (utc: string | null): string => {
    if (!utc) return '';
    const start = new Date(utc.replace(' ', 'T') + 'Z').getTime();
    const diff = start - now;
    if (diff <= 0) return 'imminent';
    const h = Math.floor(diff / 3600000);
    const mn = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `dans ${h}h${String(mn).padStart(2, '0')}` : `dans ${mn} min`;
  };

  const liveOf = (m: Match): Match => {
    const ls = liveScore(m.id);
    if (!ls) return m;
    const live = isLiveStatus(ls.status);
    const done = isFinishedStatus(ls.status);
    if (!live && !done) return m;
    const so: [number, number] | null =
      ls.hps != null && ls.aps != null && (ls.hps || ls.aps) ? [ls.hps, ls.aps] : m.so;
    return { ...m, hg: ls.hg, ag: ls.ag, status: ls.status, played: true, so };
  };

  onMount(() => {
    ready = true;
    const t = setInterval(() => (now = Date.now()), 30000);
    return () => clearInterval(t);
  });

  $effect(() => {
    if (!LIVE_WORKER) return;
    return startLive(LIVE_WORKER, () => {
      const ids: number[] = [];
      for (const g of ['men', 'women'] as Gender[]) {
        for (const m of comp(g).matches) {
          if (dayKey(m.utc) === today && !isFinishedStatus(liveScore(m.id)?.status ?? m.status ?? '')) {
            ids.push(m.id);
          }
        }
      }
      return ids;
    });
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
    window.requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
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

  const bandMatches = $derived.by(() => {
    const list = (days.find((d) => d.key === today)?.matches ?? [])
      .map(liveOf)
      .filter((m) => matchState(m) !== 'done');
    return [...list].sort(
      (a, b) =>
        (matchState(a) === 'live' ? 0 : 1) - (matchState(b) === 'live' ? 0 : 1) ||
        (a.utc ?? '').localeCompare(b.utc ?? '')
    );
  });
  const liveCount = $derived(bandMatches.filter((m) => matchState(m) === 'live').length);

  let funnelDay = $state<string | null>(null);
  const activeDay = $derived(
    (funnelDay && days.some((d) => d.key === funnelDay) ? funnelDay : null) ??
      (days.some((d) => d.key === today) ? today : days[0]?.key) ??
      null
  );
  const selectDay = (key: string) => {
    funnelDay = key;
  };
  let dayNavReady = false;
  $effect(() => {
    const key = activeDay;
    if (!dayNavReady) {
      dayNavReady = true;
      return;
    }
    if (!key) return;
    if (!window.matchMedia('(min-width: 940px)').matches) return;
    calendarEl?.querySelector(`[data-day="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  let calScrollTop = $state(0);
  const onCalScroll = () => {
    if (calendarEl) calScrollTop = calendarEl.scrollTop;
  };
  const scrollCalTop = () => calendarEl?.scrollTo({ top: 0, behavior: 'smooth' });
  let calInit = false;
  $effect(() => {
    const el = calendarEl;
    const list = days;
    if (!el || calInit || !list.length) return;
    calInit = true;
    if (!window.matchMedia('(min-width: 940px)').matches) return;
    requestAnimationFrame(() => {
      const todayEl = el.querySelector(`[data-day="${today}"]`);
      if (todayEl instanceof HTMLElement) {
        el.scrollTop = Math.max(0, todayEl.offsetTop - 44);
        calScrollTop = el.scrollTop;
      }
    });
  });

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
      close?.focus({ preventScroll: true });
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
      {#if bandMatches.length}
        <section class="livebar" class:hasLive={liveCount > 0} aria-label="Matchs du jour">
          <div class="livebar-head">
            <span class="livebar-title">
              {#if liveCount}<span class="live-dot" aria-hidden="true"></span>En direct{:else}Matchs en cours ou à venir aujourd'hui{/if}
            </span>
            <span class="livebar-date">{fmtDay(`${today} 12:00:00`)}</span>
          </div>
          <div class="livebar-track">
            {#each bandMatches as m (m.id)}
              {@const st = matchState(m)}
              {@const hc = matchSideCode(gender, m, 'home')}
              {@const ac = matchSideCode(gender, m, 'away')}
              <button
                class="livecard"
                class:islive={st === 'live'}
                class:done={st === 'done'}
                onclick={() => openMatch(m)}
                aria-label="{matchSideName(gender, m, 'home')} contre {matchSideName(gender, m, 'away')}"
              >
                <span class="lc-state">
                  {#if st === 'live'}<span class="live-dot" aria-hidden="true"></span>{frPeriod(liveScore(m.id)?.period)}
                  {:else if st === 'upcoming'}<span class="lc-time">{fmtTime(m.utc)}</span> · {countdown(m.utc)}
                  {:else}Terminé{/if}
                </span>
                <span class="lc-row" class:lose={st !== 'upcoming' && m.hg != null && m.ag != null && m.hg < m.ag}>
                  {#if hc}<img src={flagUrl(hc)} alt="" />{:else}<span class="lc-seed" aria-hidden="true">?</span>{/if}
                  <span class="lc-nm">{matchSideName(gender, m, 'home')}</span>
                  {#if st !== 'upcoming'}<span class="lc-sc">{m.hg}</span>{/if}
                </span>
                <span class="lc-row" class:lose={st !== 'upcoming' && m.hg != null && m.ag != null && m.ag < m.hg}>
                  {#if ac}<img src={flagUrl(ac)} alt="" />{:else}<span class="lc-seed" aria-hidden="true">?</span>{/if}
                  <span class="lc-nm">{matchSideName(gender, m, 'away')}</span>
                  {#if st !== 'upcoming'}<span class="lc-sc">{m.ag}</span>{/if}
                </span>
                {#if m.venue}
                  <span class="lc-venue">
                    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M8 1.6a4.4 4.4 0 0 0-4.4 4.4c0 3.1 4.4 8 4.4 8s4.4-4.9 4.4-8A4.4 4.4 0 0 0 8 1.6Z" /><circle cx="8" cy="6" r="1.7" /></svg>
                    <span class="lc-venue-txt">{m.venue}</span>
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </section>
      {/if}
      <div class="visual-shell">
      <div class="stage">
        <HockeyFunnel
          {gender}
          {previousGender}
          crossfading={genderCrossfading}
          bind:selectedDay={funnelDay}
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

      <section class="matches" bind:this={calendarEl} onscroll={onCalScroll}>
      <h2>Le calendrier</h2>
      <button class="cal-up" class:show={calScrollTop > 8} onclick={scrollCalTop} tabindex={calScrollTop > 8 ? 0 : -1} aria-hidden={calScrollTop <= 8}>
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m5 12 5-5 5 5" /></svg>
        Jours précédents
      </button>
      {#each days as day}
        <div class="day" class:istoday={day.key === today} class:isactive={day.key === activeDay} data-day={day.key}>
          <button class="day-lbl" onclick={() => selectDay(day.key)} aria-pressed={day.key === activeDay}>
            <span class="day-lbl-txt">{day.label}</span>
            {#if day.key === today}<span class="today-badge">aujourd'hui</span>{/if}
          </button>
          <ul>
            {#each day.matches as m0, mi}
              {@const m = liveOf(m0)}
              {@const live = isLiveStatus(m.status) && m.status !== 'Official'}
              {@const win = m.played && m.hg != null && m.ag != null ? (m.hg > m.ag || (m.hg === m.ag && m.so && m.so[0] > m.so[1]) ? 'h' : 'a') : null}
              {@const clip = videoOf(gender, m)}
              {@const hc = matchSideCode(gender, m, 'home')}
              {@const ac = matchSideCode(gender, m, 'away')}
              {@const oldMatch = previousDays.find((oldDay) => oldDay.key === day.key)?.matches[mi]}
              <li class="match-wrap">
                <button class="match" class:has-video={!!clip} class:istoday={day.key === today} onclick={() => openMatch(m)}>
                  <span class="teams-stack">
                    <span class="teams" class:incoming={genderCrossfading}>
                      <span class="trow" class:lose={win === 'a'}>
                        {#if hc}<img src={flagUrl(hc)} alt="" />{:else}<span class="seed" aria-hidden="true">?</span>{/if}
                        <span class="nm">{matchSideName(gender, m, 'home')}</span>
                        {#if m.played}<span class="sc">{m.hg}</span>{/if}
                      </span>
                      <span class="trow" class:lose={win === 'h'}>
                        {#if ac}<img src={flagUrl(ac)} alt="" />{:else}<span class="seed" aria-hidden="true">?</span>{/if}
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
                    <span class="p" class:islive={live}>
                      {#if live}<span class="live-dot" aria-hidden="true"></span>{frPeriod(liveScore(m0.id)?.period)}{:else}{m.played ? 'Terminé' : phaseLabel(m.phase)}{/if}
                    </span>
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
          <HockeyMatch match={liveOf(drawer.match)} {gender} onclose={closeDrawer} onvideo={(clip) => (video = clip)} />
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
    · horaires
    <a href="https://hockeyworldcup2026.be/programme/" target="_blank" rel="noreferrer">World Cup 2026</a>
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
    margin: 0 auto 8px;
    position: sticky;
    top: 0;
    z-index: 30;
    padding: 8px 0;
    background: var(--bg);
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
  .livebar {
    position: sticky;
    top: 50px;
    z-index: 25;
    margin: 0 0 16px;
    padding: 9px 0 11px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  .livebar-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 0 2px 8px;
  }
  .livebar-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-secondary);
  }
  .livebar.hasLive .livebar-title {
    color: var(--hk-accent);
  }
  .livebar-date {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: capitalize;
  }
  .livebar-track {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    padding: 2px 2px 4px;
    margin: 0 -2px;
    scrollbar-width: none;
  }
  .livebar-track::-webkit-scrollbar {
    display: none;
  }
  .livecard {
    flex: 0 0 220px;
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    gap: 5px;
    appearance: none;
    text-align: left;
    cursor: pointer;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 9px 11px;
    transition: border-color 0.14s, transform 0.14s;
  }
  .livecard:hover {
    border-color: var(--hk-accent);
    transform: translateY(-1px);
  }
  .livecard.islive {
    border-color: color-mix(in srgb, var(--hk-accent) 55%, var(--border));
    background: color-mix(in srgb, var(--hk-accent-soft) 70%, var(--surface));
  }
  .lc-state {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .livecard.islive .lc-state {
    color: var(--hk-accent);
  }
  .lc-state .lc-time {
    color: var(--text-secondary);
  }
  .lc-row {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .lc-row img {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .lc-seed {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px dashed var(--border-strong);
    display: grid;
    place-items: center;
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 700;
    flex: none;
  }
  .lc-nm {
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lc-sc {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    font-size: 14px;
    color: var(--text);
  }
  .lc-row.lose .lc-nm,
  .lc-row.lose .lc-sc {
    color: var(--text-muted);
    font-weight: 600;
  }
  .lc-venue {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    margin-top: 2px;
    padding-top: 6px;
    border-top: 1px solid var(--divider);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .lc-venue-txt {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lc-venue svg {
    flex: none;
    fill: currentColor;
    opacity: 0.75;
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
  .cal-up {
    display: none;
    position: sticky;
    top: 0;
    z-index: 6;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin: -4px 0 8px;
    padding: 7px 10px;
    appearance: none;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(8px);
    color: var(--text-secondary);
    font: 700 10.5px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition: opacity 0.16s ease, transform 0.16s ease, color 0.14s;
  }
  .cal-up.show {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
  .cal-up:hover {
    color: var(--hk-accent);
    border-color: var(--hk-accent);
  }
  .cal-up svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
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
    width: 100%;
    appearance: none;
    background: none;
    border: none;
    border-bottom: 1px solid var(--divider);
    font: 700 11px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0 0 7px;
    padding: 0 0 4px;
    cursor: pointer;
    text-align: left;
    transition: color 0.14s, border-color 0.14s;
  }
  .day-lbl:hover {
    color: var(--text-secondary);
  }
  .day.istoday .day-lbl {
    color: var(--hk-accent);
    border-bottom-color: var(--hk-accent);
  }
  .day.isactive .day-lbl {
    color: var(--hk-accent);
    border-bottom-color: var(--hk-accent);
  }
  .day.isactive {
    scroll-margin-top: 14px;
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
  .meta .p.islive {
    color: var(--hk-accent);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--hk-accent);
    animation: live-pulse 1.4s ease-in-out infinite;
  }
  @keyframes live-pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
    }
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
  @media (min-width: 940px) {
    main {
      max-width: 1280px;
    }
    .tabs {
      position: static;
      padding: 0;
      margin: 0 auto 14px;
    }
    .gender-view {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      grid-template-areas:
        'band band'
        'viz cal';
      column-gap: 34px;
      align-items: start;
    }
    .livebar {
      grid-area: band;
      position: static;
      backdrop-filter: none;
      background: transparent;
      border-bottom: none;
      padding: 0 0 4px;
    }
    .visual-shell {
      grid-area: viz;
      position: sticky;
      top: 12px;
    }
    :global(body.standalone) .visual-shell {
      min-height: 0;
    }
    .stage {
      max-width: none;
    }
    .calendar-cue-reserve {
      display: none;
    }
    .matches {
      grid-area: cal;
      margin-top: 4px;
      position: sticky;
      top: 16px;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      overscroll-behavior: contain;
      scroll-padding-top: 46px;
      padding-right: 8px;
      scrollbar-width: thin;
    }
    .matches h2 {
      text-align: left;
    }
    .cal-up {
      display: inline-flex;
    }
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
