<script lang="ts">
  import { base } from '$app/paths';
  import {
    comp,
    flagUrl,
    teamName,
    matchSideCode,
    rankClinched,
    abbr,
    poolOf,
    dayKey,
    todayKey,
    fmtDay,
    FIRST_POOLS,
    SUPER_POOLS,
    SUPER_FEED,
    isFinal,
    type Gender,
    type Match
  } from './hockey/data';
  import { liveScore, isLiveStatus } from './hockey/live.svelte';

  const isLiveMatch = (id: number): boolean => {
    const ls = liveScore(id);
    return !!ls && isLiveStatus(ls.status) && ls.status !== 'Official';
  };

  let {
    gender,
    previousGender = null,
    crossfading = false,
    selectedDay = $bindable(null),
    onteam,
    onmatch
  }: { gender: Gender; previousGender?: Gender | null; crossfading?: boolean; selectedDay?: string | null; onteam?: (code: string) => void; onmatch?: (m: Match) => void } = $props();

  const S = 760;
  const C = S / 2;
  const NR = 19;
  const R = { poolLabel: 361, pool: 278, arc: 326, chord: 308, superLabel: 178, super: 178, semi: 132, finalist: 96, center: 74 };

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const px = (r: number, deg: number) => C + r * Math.cos(rad(deg));
  const py = (r: number, deg: number) => C + r * Math.sin(rad(deg));

  const POOL_ANGLE: Record<string, number> = { A: 225, D: 135, B: 315, C: 45 };
  const SUPER_ANGLE: Record<string, number> = { E: 180, F: 0 };
  const TEAM_OFFSETS = [-33, -11, 11, 33];

  const cp = $derived(comp(gender));
  const today = todayKey();

  const days = $derived([...new Set(cp.matches.map((m) => dayKey(m.utc)).filter(Boolean))].sort());
  const curDay = $derived(selectedDay ?? (days.includes(today) ? today : days[0]) ?? null);
  const dayIdx = $derived(curDay ? days.indexOf(curDay) : -1);
  const isToday = $derived(curDay === today);
  let previousDay = $state<string | null>(null);
  let dayCrossfading = $state(false);
  const step = (d: number) => {
    const i = dayIdx + d;
    if (i < 0 || i >= days.length || dayCrossfading) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      selectedDay = days[i];
      return;
    }
    previousDay = curDay;
    selectedDay = days[i];
    dayCrossfading = true;
    window.setTimeout(() => {
      dayCrossfading = false;
      previousDay = null;
    }, 240);
  };

  const poolDataFor = (forGender: Gender) =>
    FIRST_POOLS.map((letter) => {
      const p = poolOf(forGender, letter);
      return { letter, angle: POOL_ANGLE[letter], teams: (p?.teams ?? []).slice(0, 4) };
    });
  const poolData = $derived(poolDataFor(gender));
  const previousPoolData = $derived(previousGender ? poolDataFor(previousGender) : []);

  const nodePos = $derived.by(() => {
    const m: Record<string, { x: number; y: number }> = {};
    for (const pool of poolData) {
      pool.teams.forEach((t, i) => {
        if (t.code) {
          const ta = pool.angle + TEAM_OFFSETS[i];
          m[t.code] = { x: px(R.pool, ta), y: py(R.pool, ta) };
        }
      });
    }
    return m;
  });

  const chordsForDay = (day: string | null) => {
    const list = cp.matches
      .filter((mt) => dayKey(mt.utc) === day)
      .map((mt) => {
        const hc = matchSideCode(gender, mt, 'home');
        const ac = matchSideCode(gender, mt, 'away');
        return hc && ac && nodePos[hc] && nodePos[ac] ? { mt, hc, ac } : null;
      })
      .filter((x): x is { mt: Match; hc: string; ac: string } => x !== null);
    const items = list.map(({ mt, hc, ac }) => {
      const a = nodePos[hc];
      const b = nodePos[ac];
      const degA = (Math.atan2(a.y - C, a.x - C) * 180) / Math.PI;
      const degB = (Math.atan2(b.y - C, b.x - C) * 180) / Math.PI;
      return { mt, hc, ac, a, b, lo: Math.min(degA, degB), hi: Math.max(degA, degB), rr: R.chord };
    });
    items.sort((x, y) => x.lo - y.lo);
    const levelHi: number[] = [];
    for (const c of items) {
      let lvl = 0;
      while (lvl < levelHi.length && levelHi[lvl] > c.lo) lvl++;
      levelHi[lvl] = c.hi;
      c.rr = R.chord + lvl * 11;
    }
    return items;
  };
  const dayChords = $derived(chordsForDay(curDay));
  const previousDayChords = $derived(previousDay ? chordsForDay(previousDay) : []);
  const dayTeams = $derived(new Set(dayChords.flatMap((c) => [c.hc, c.ac])));
  const liveTeams = $derived(
    new Set(dayChords.filter((c) => isLiveMatch(c.mt.id)).flatMap((c) => [c.hc, c.ac]))
  );
  const dayMatchCount = $derived(cp.matches.filter((mt) => dayKey(mt.utc) === curDay).length);

  let hoverCode = $state<string | null>(null);
  const linkedCodes = $derived.by(() => {
    const s = new Set<string>();
    if (!hoverCode) return s;
    for (const c of dayChords) {
      if (c.hc === hoverCode) s.add(c.ac);
      else if (c.ac === hoverCode) s.add(c.hc);
    }
    return s;
  });

  const superDataFor = (forGender: Gender) =>
    SUPER_POOLS.map((letter) => {
      const SA = SUPER_ANGLE[letter];
      const p = poolOf(forGender, letter);
      const real = (p?.teams ?? []).filter((t) => t.code).slice(0, 4);
      if (real.length) {
        return { letter, angle: SA, slots: real.map((t, i) => ({ code: t.code, label: t.code ?? '', real: true, off: TEAM_OFFSETS[i] })) };
      }
      const slots: { code: string | null; label: string; real: boolean; off: number }[] = [];
      for (const src of SUPER_FEED[letter]) {
        const rel = ((POOL_ANGLE[src] - SA + 540) % 360) - 180;
        const s = rel >= 0 ? 1 : -1;
        const c1 = rankClinched(forGender, src, 1);
        const c2 = rankClinched(forGender, src, 2);
        slots.push({ code: c1, label: c1 ?? `1er ${src}`, real: !!c1, off: s * 16 });
        slots.push({ code: c2, label: c2 ?? `2e ${src}`, real: !!c2, off: s * 48 });
      }
      return { letter, angle: SA, slots };
    });
  const superData = $derived(superDataFor(gender));
  const previousSuperData = $derived(previousGender ? superDataFor(previousGender) : []);

  const matchWinner = (match: Match | null): string | null => {
    if (!match?.played || match.hg == null || match.ag == null) return null;
    if (match.hg === match.ag && match.so) return match.so[0] > match.so[1] ? match.home : match.away;
    return match.hg > match.ag ? match.home : match.away;
  };
  const phaseFinished = (forGender: Gender, phase: string) => {
    const matches = comp(forGender).matches.filter((match) => match.phase === phase);
    return matches.length > 0 && matches.every((match) => match.played);
  };
  const outOfTitle = (forGender: Gender, code: string | null) => {
    if (!code) return false;
    const competition = comp(forGender);
    const titlePools = [...FIRST_POOLS, ...SUPER_POOLS];
    for (const letter of titlePools) {
      const team = competition.pools[letter]?.teams.find((entry) => entry.code === code);
      if (team && phaseFinished(forGender, letter) && team.rank > 2) return true;
    }
    for (const match of competition.matches.filter((entry) => ['SF', '1/2', 'Final', 'F1'].includes(entry.phase ?? ''))) {
      if (match.played && (match.home === code || match.away === code) && matchWinner(match) !== code) return true;
    }
    return false;
  };

  const semifinals = $derived(cp.matches.filter((match) => match.phase === 'SF').sort((a, b) => a.id - b.id).slice(0, 2));

  const final = $derived(isFinal(gender));
  const finalists = $derived([
    { code: final?.home ?? '', label: 'V. DF1', angle: 270 },
    { code: final?.away ?? '', label: 'V. DF2', angle: 90 }
  ]);
  const champion = $derived.by(() => {
    return matchWinner(final);
  });

  const arcPath = (r: number, a0: number, a1: number) =>
    `M ${px(r, a0).toFixed(1)} ${py(r, a0).toFixed(1)} A ${r} ${r} 0 0 1 ${px(r, a1).toFixed(1)} ${py(r, a1).toFixed(1)}`;

  const onRing = (p: { x: number; y: number }, out: number) => {
    const dx = p.x - C;
    const dy = p.y - C;
    const d = Math.hypot(dx, dy) || 1;
    return { x: C + (dx / d) * (d + out), y: C + (dy / d) * (d + out) };
  };

  const chordPath = (a: { x: number; y: number }, b: { x: number; y: number }, rr: number) => {
    const degA = (Math.atan2(a.y - C, a.x - C) * 180) / Math.PI;
    const degB = (Math.atan2(b.y - C, b.x - C) * 180) / Math.PI;
    const sA = onRing(a, NR + 2);
    const sB = onRing(b, NR + 2);
    const d = ((degB - degA + 540) % 360) - 180;
    const sweep = d > 0 ? 1 : 0;
    return `M ${sA.x.toFixed(1)} ${sA.y.toFixed(1)} L ${px(rr, degA).toFixed(1)} ${py(rr, degA).toFixed(1)} A ${rr} ${rr} 0 0 ${sweep} ${px(rr, degB).toFixed(1)} ${py(rr, degB).toFixed(1)} L ${sB.x.toFixed(1)} ${sB.y.toFixed(1)}`;
  };
</script>

<div class="funnel">
  <div class="daynav">
    <button class="nav" onclick={() => step(-1)} disabled={dayIdx <= 0} aria-label="Jour précédent">‹</button>
    <div class="day-info">
      <span class="day-name">{fmtDay(curDay ? `${curDay} 12:00:00` : null)}</span>
      <span class="day-meta">
        {#if isToday}<span class="today-tag">aujourd'hui</span>{/if}
        {dayMatchCount} match{dayMatchCount > 1 ? 's' : ''}
      </span>
    </div>
    <button class="nav" onclick={() => step(1)} disabled={dayIdx < 0 || dayIdx >= days.length - 1} aria-label="Jour suivant">›</button>
  </div>

  <svg viewBox="0 0 {S} {S}" role="img" aria-label="Entonnoir du Mondial de hockey">
    <circle cx={C} cy={C} r={R.pool} class="ring anim" />
    <circle cx={C} cy={C} r={R.super} class="ring anim" style:animation-delay="360ms" />
    <circle cx={C} cy={C} r={R.semi} class="ring ring-inner anim" style:animation-delay="480ms" />

    {#each poolData as pool, i}
      <path d={arcPath(R.arc, pool.angle - 35, pool.angle + 35)} class="pool-arc anim" style:animation-delay="{120 + i * 45}ms" />
    {/each}

    {#each poolData as pool}
      <text x={px(R.poolLabel, pool.angle)} y={py(R.poolLabel, pool.angle)} class="pool-lbl anim" style:animation-delay="180ms">Poule {pool.letter}</text>
    {/each}

    <g class="line-layer" class:incoming={dayCrossfading}>
      {#each dayChords as c (c.mt.id)}
        {@const strong = hoverCode != null && (c.hc === hoverCode || c.ac === hoverCode)}
        {@const islive = isLiveMatch(c.mt.id)}
        {@const path = chordPath(c.a, c.b, c.rr)}
        <path d={path} class="chord-hit" role="button" tabindex="0" aria-label="{teamName(gender, c.hc)} contre {teamName(gender, c.ac)}" onclick={() => onmatch?.(c.mt)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onmatch?.(c.mt)} />
        <path d={path} class="chord" class:live={isToday} class:islive class:strong aria-hidden="true" />
      {/each}
    </g>

    {#if dayCrossfading && previousDay}
      <g class="line-layer outgoing" aria-hidden="true">
        {#each previousDayChords as c (c.mt.id)}
          {@const path = chordPath(c.a, c.b, c.rr)}
          <path d={path} class="chord" class:live={previousDay === today} />
        {/each}
      </g>
    {/if}

    <g class="nation-layer" class:incoming={crossfading}>
      {#each poolData as pool, pi}
        {#each pool.teams as t, i}
          {@const ta = pool.angle + TEAM_OFFSETS[i]}
          {@const x = px(R.pool, ta)}
          {@const y = py(R.pool, ta)}
          {@const dir = y > C ? -1 : 1}
          {@const lead = t.rank <= 2 && t.gp > 0}
          {@const plays = !!t.code && dayTeams.has(t.code)}
          {@const islive = !!t.code && liveTeams.has(t.code)}
          {@const hi = !!t.code && (hoverCode === t.code || linkedCodes.has(t.code))}
          {@const noTitle = outOfTitle(gender, t.code)}
          <g class="team pop" class:hi style:animation-delay="{200 + (pi * 4 + i) * 32}ms" role="button" tabindex="0" aria-label="{teamName(gender, t.code ?? '')}{noTitle ? ', hors de la course au titre' : ''}" onmouseenter={() => (hoverCode = t.code ?? null)} onmouseleave={() => (hoverCode = null)} onclick={() => t.code && onteam?.(t.code)} onkeydown={(e) => e.key === 'Enter' && t.code && onteam?.(t.code)}>
            <g class="team-visual" class:out-title={noTitle}>
              <clipPath id="clip-{pool.letter}-{i}"><circle cx={x} cy={y} r={NR - 1} /></clipPath>
              {#if islive}<circle cx={x} cy={y} r={NR} class="live-halo" aria-hidden="true" />{/if}
              <circle cx={x} cy={y} r={NR} class="flag-ring" class:lead class:plays class:islive />
              <image href={flagUrl(t.code)} x={x - NR} y={y - NR} width={NR * 2} height={NR * 2} clip-path="url(#clip-{pool.letter}-{i})" preserveAspectRatio="xMidYMid slice" />
              <text {x} y={y + dir * (NR + 12)} class="code">{abbr(t.code)}</text>
              {#if t.gp > 0}
                <text {x} y={y + dir * (NR + 23)} class="pts">{t.pts} pt{t.pts > 1 ? 's' : ''}</text>
              {/if}
            </g>
          </g>
        {/each}
      {/each}
    </g>

    {#if crossfading && previousGender}
      <g class="nation-layer outgoing" aria-hidden="true">
        {#each previousPoolData as pool}
          {#each pool.teams as t, i}
            {@const ta = pool.angle + TEAM_OFFSETS[i]}
            {@const x = px(R.pool, ta)}
            {@const y = py(R.pool, ta)}
            {@const dir = y > C ? -1 : 1}
            {@const lead = t.rank <= 2 && t.gp > 0}
            <g class="team">
              <g class="team-visual" class:out-title={outOfTitle(previousGender, t.code)}>
                <clipPath id="old-clip-{pool.letter}-{i}"><circle cx={x} cy={y} r={NR - 1} /></clipPath>
                <circle cx={x} cy={y} r={NR} class="flag-ring" class:lead />
                <image href={flagUrl(t.code)} x={x - NR} y={y - NR} width={NR * 2} height={NR * 2} clip-path="url(#old-clip-{pool.letter}-{i})" preserveAspectRatio="xMidYMid slice" />
                <text {x} y={y + dir * (NR + 12)} class="code">{abbr(t.code)}</text>
                {#if t.gp > 0}
                  <text {x} y={y + dir * (NR + 23)} class="pts">{t.pts} pt{t.pts > 1 ? 's' : ''}</text>
                {/if}
              </g>
            </g>
          {/each}
        {/each}
      </g>
    {/if}

    {#each superData as sp}
      <text x={px(R.superLabel, sp.angle)} y={py(R.superLabel, sp.angle)} class="super-lbl anim" style:animation-delay="520ms">Poule {sp.letter}</text>
      {#each sp.slots as slot, i}
        {@const sa = sp.angle + slot.off}
        {@const x = px(R.super, sa)}
        {@const y = py(R.super, sa)}
        {#if slot.real && slot.code}
          <g
            class="nation-slot clickable"
            class:incoming={crossfading}
            class:out-title={outOfTitle(gender, slot.code)}
            role="button"
            tabindex="0"
            aria-label={teamName(gender, slot.code ?? '')}
            onmouseenter={() => (hoverCode = slot.code)}
            onmouseleave={() => (hoverCode = null)}
            onclick={() => slot.code && onteam?.(slot.code)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && slot.code && onteam?.(slot.code)}
          >
            <clipPath id="sclip-{sp.letter}-{i}"><circle cx={x} cy={y} r="14" /></clipPath>
            <circle cx={x} cy={y} r="15" class="flag-ring anim" style:animation-delay="540ms" />
            <image href={flagUrl(slot.code)} x={x - 15} y={y - 15} width="30" height="30" clip-path="url(#sclip-{sp.letter}-{i})" preserveAspectRatio="xMidYMid slice" />
          </g>
        {:else}
          <circle cx={x} cy={y} r="15" class="reserved anim" style:animation-delay="{540 + i * 30}ms" />
          <text {x} y={y + 1} class="reserved-lbl anim" style:animation-delay="{540 + i * 30}ms">{slot.label}</text>
        {/if}
      {/each}
    {/each}

    {#if crossfading && previousGender}
      <g class="nation-layer outgoing" aria-hidden="true">
        {#each previousSuperData as sp}
          {#each sp.slots as slot, i}
            {@const sa = sp.angle + slot.off}
            {@const x = px(R.super, sa)}
            {@const y = py(R.super, sa)}
            {#if slot.real && slot.code}
              <g class="nation-slot" class:out-title={outOfTitle(previousGender, slot.code)}>
                <clipPath id="old-sclip-{sp.letter}-{i}"><circle cx={x} cy={y} r="14" /></clipPath>
                <circle cx={x} cy={y} r="15" class="flag-ring" />
                <image href={flagUrl(slot.code)} x={x - 15} y={y - 15} width="30" height="30" clip-path="url(#old-sclip-{sp.letter}-{i})" preserveAspectRatio="xMidYMid slice" />
              </g>
            {/if}
          {/each}
        {/each}
      </g>
    {/if}

    {#each [
      { match: semifinals[0] ?? null, angle: 270, labels: ['1er E', '2e F'], labelY: py(R.semi, 270) - 22 },
      { match: semifinals[1] ?? null, angle: 90, labels: ['1er F', '2e E'], labelY: py(R.semi, 90) + 23 }
    ] as semi, si}
      {@const y = py(R.semi, semi.angle)}
      <text x={C} y={semi.labelY} class="phase-lbl anim" style:animation-delay="600ms">demi-finale</text>
      {#each [semi.match?.home ?? '', semi.match?.away ?? ''] as code, ti}
        {@const x = C + (ti === 0 ? -18 : 18)}
        {@const noTitle = outOfTitle(gender, code)}
        {#if code}
          <g class="stage-team" class:out-title={noTitle} role="button" tabindex="0" aria-label="{teamName(gender, code)}{noTitle ? ', hors de la course au titre' : ''}" onclick={() => onteam?.(code)} onkeydown={(event) => event.key === 'Enter' && onteam?.(code)}>
            <clipPath id="semi-{si}-{ti}"><circle cx={x} cy={y} r="13" /></clipPath>
            <circle cx={x} cy={y} r="14" class="flag-ring anim" style:animation-delay="{600 + ti * 30}ms" />
            <image href={flagUrl(code)} x={x - 14} y={y - 14} width="28" height="28" clip-path="url(#semi-{si}-{ti})" preserveAspectRatio="xMidYMid slice" />
          </g>
        {:else}
          <circle cx={x} cy={y} r="14" class="reserved anim" style:animation-delay="{600 + ti * 30}ms" />
          <text {x} y={y + 1} class="semi-seed anim" style:animation-delay="{600 + ti * 30}ms">{semi.labels[ti]}</text>
        {/if}
      {/each}
    {/each}

    {#each finalists as finalist, i}
      {@const x = px(R.finalist, finalist.angle)}
      {@const y = py(R.finalist, finalist.angle)}
      {#if finalist.code}
        <g
          class="nation-slot clickable"
          class:incoming={crossfading}
          class:out-title={outOfTitle(gender, finalist.code)}
          role="button"
          tabindex="0"
          aria-label={teamName(gender, finalist.code)}
          onclick={() => finalist.code && onteam?.(finalist.code)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && finalist.code && onteam?.(finalist.code)}
        >
          <clipPath id="finalist-{i}"><circle cx={x} cy={y} r="13" /></clipPath>
          <circle cx={x} cy={y} r="14" class="flag-ring anim" style:animation-delay="650ms" />
          <image href={flagUrl(finalist.code)} x={x - 14} y={y - 14} width="28" height="28" clip-path="url(#finalist-{i})" preserveAspectRatio="xMidYMid slice" />
        </g>
      {:else}
        <circle cx={x} cy={y} r="14" class="reserved anim" style:animation-delay="650ms" />
        <text {x} y={y + 1} class="semi-seed anim" style:animation-delay="650ms">{finalist.label}</text>
      {/if}
    {/each}

    <g class="center-grp pop" style:animation-delay="680ms">
      <circle cx={C} cy={C} r={R.center} class="center-bg" class:crowned={!!champion} />
      {#if champion}
        <text x={C} y={C - 34} class="center-kicker">Champion du monde</text>
        <clipPath id="champClip"><circle cx={C} cy={C + 2} r="30" /></clipPath>
        <circle cx={C} cy={C + 2} r="31" class="flag-ring champ" />
        <image href={flagUrl(champion)} x={C - 31} y={C - 29} width="62" height="62" clip-path="url(#champClip)" preserveAspectRatio="xMidYMid slice" />
        <text x={C} y={C + 48} class="center-name">{teamName(gender, champion)}</text>
      {:else}
        <image href="{base}/hockey-logo.png" x={C - 26} y={C - 46} width="52" height="78" class="center-logo" />
        <text x={C} y={C + 46} class="center-soon">Finale le {gender === 'men' ? '30' : '29'} août</text>
      {/if}
    </g>
  </svg>
</div>

<style>
  .funnel {
    position: relative;
  }
  .daynav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin: 0 0 4px;
  }
  .nav {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
    flex: none;
  }
  .nav:hover:not(:disabled) {
    border-color: var(--hk-accent);
    color: var(--hk-accent);
  }
  .nav:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .day-info {
    flex: 1;
    text-align: center;
  }
  .day-name {
    display: block;
    font-size: 13.5px;
    font-weight: 800;
    color: var(--text);
    text-transform: capitalize;
  }
  .day-meta {
    font-size: 10.5px;
    color: var(--text-muted);
  }
  .today-tag {
    display: inline-block;
    background: var(--hk-accent);
    color: #fff;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0 5px;
    border-radius: 20px;
    margin-right: 5px;
    font-size: 9px;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font);
  }
  .anim {
    opacity: 0;
    animation: fade 0.55s ease forwards;
  }
  .pop {
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
    animation: pop 0.5s cubic-bezier(0.2, 0.75, 0.25, 1) forwards;
  }
  .nation-layer,
  .nation-slot {
    opacity: 1;
  }
  .nation-slot.clickable {
    cursor: pointer;
  }
  .nation-slot.clickable:hover .flag-ring,
  .nation-slot.clickable:focus-visible .flag-ring {
    stroke: var(--hk-accent);
  }
  .nation-layer.incoming,
  .nation-slot.incoming {
    animation: nations-in 0.24s ease both;
  }
  .nation-layer.outgoing {
    pointer-events: none;
    animation: nations-out 0.24s ease both;
  }
  @keyframes nations-in {
    from { opacity: 0; }
    to { opacity: var(--nation-opacity, 1); }
  }
  @keyframes nations-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes fade {
    to {
      opacity: 1;
    }
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.55);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .anim,
    .pop {
      opacity: 1;
      animation: none;
    }
    .nation-layer,
    .nation-slot,
    .line-layer {
      animation: none;
    }
  }
  .ring {
    fill: none;
    stroke: var(--divider);
    stroke-width: 1;
  }
  .ring-inner {
    stroke-dasharray: 3 4;
  }
  .pool-arc {
    fill: none;
    stroke: var(--hk-accent);
    stroke-width: 2.5;
    stroke-linecap: round;
    opacity: 0;
  }
  .pool-arc.anim {
    animation-name: fade-arc;
  }
  @keyframes fade-arc {
    to {
      opacity: 0.42;
    }
  }
  .pool-lbl {
    fill: var(--text-secondary);
    font-size: 12px;
    font-weight: 800;
    text-anchor: middle;
    dominant-baseline: middle;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .super-lbl {
    fill: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .phase-lbl {
    fill: var(--text-muted);
    font-size: 8.5px;
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: middle;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.75;
  }
  .phase-lbl.anim {
    animation-name: fade-phase;
  }
  .semi-seed {
    fill: var(--text-muted);
    font-size: 6.5px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  @keyframes fade-phase {
    to {
      opacity: 0.75;
    }
  }
  .chord {
    fill: none;
    stroke: var(--hk-accent);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.5;
    pointer-events: none;
    transition: opacity 0.14s, stroke-width 0.14s;
  }
  .line-layer.incoming {
    animation: lines-in 0.24s ease both;
  }
  .line-layer.outgoing {
    pointer-events: none;
    animation: lines-out 0.24s ease both;
  }
  @keyframes lines-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes lines-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  .chord-hit {
    fill: none;
    stroke: transparent;
    stroke-width: 18;
    pointer-events: stroke;
    cursor: pointer;
  }
  .chord.live {
    opacity: 0.82;
    stroke-width: 2.6;
  }
  .chord.strong,
  .chord-hit:hover + .chord,
  .chord-hit:focus-visible + .chord {
    opacity: 1;
    stroke-width: 3.6;
  }
  .chord.islive {
    opacity: 1;
    stroke-width: 3.4;
    animation: chord-live 1.5s ease-in-out infinite;
  }
  @keyframes chord-live {
    0%, 100% { opacity: 1; stroke-width: 3.4; }
    50% { opacity: 0.55; stroke-width: 2.4; }
  }
  .live-halo {
    fill: none;
    stroke: var(--hk-accent);
    stroke-width: 2;
    opacity: 0.6;
    animation: halo-live 1.5s ease-out infinite;
  }
  @keyframes halo-live {
    0% { stroke-width: 1.5; opacity: 0.5; }
    70%, 100% { stroke-width: 7; opacity: 0; }
  }
  .team {
    cursor: pointer;
  }
  .team-visual,
  .nation-slot,
  .stage-team {
    transition: opacity 0.2s ease, filter 0.2s ease;
  }
  .team-visual.out-title,
  .nation-slot.out-title,
  .stage-team.out-title {
    --nation-opacity: 0.38;
    opacity: var(--nation-opacity);
    filter: saturate(0.15);
  }
  .team:hover .team-visual.out-title,
  .team:focus-visible .team-visual.out-title,
  .stage-team.out-title:hover,
  .stage-team.out-title:focus-visible {
    --nation-opacity: 0.62;
  }
  .stage-team {
    cursor: pointer;
  }
  .flag-ring {
    fill: var(--surface);
    stroke: var(--border);
    stroke-width: 1.4;
  }
  .flag-ring.lead {
    stroke: var(--hk-accent);
    stroke-width: 2.4;
  }
  .flag-ring.plays {
    stroke: var(--hk-accent);
    stroke-width: 2.8;
  }
  .flag-ring.champ {
    stroke: #d9a441;
    stroke-width: 3;
  }
  .team:hover .flag-ring,
  .team.hi .flag-ring {
    stroke: var(--hk-accent);
    stroke-width: 3.2;
  }
  .team.hi .code {
    fill: var(--hk-accent);
    font-weight: 900;
  }
  .code {
    fill: var(--text);
    font-size: 10.5px;
    font-weight: 800;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .pts {
    fill: var(--text-muted);
    font-size: 8.5px;
    text-anchor: middle;
    dominant-baseline: middle;
    font-variant-numeric: tabular-nums;
  }
  .reserved {
    fill: none;
    stroke: var(--border-strong);
    stroke-width: 1.2;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }
  .reserved.anim {
    animation-name: fade-res;
  }
  @keyframes fade-res {
    to {
      opacity: 0.6;
    }
  }
  .reserved-lbl {
    fill: var(--text-muted);
    font-size: 8.5px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .center-bg {
    fill: var(--surface);
    stroke: var(--border-strong);
    stroke-width: 1.4;
  }
  .center-bg.crowned {
    stroke: #d9a441;
    stroke-width: 2.6;
  }
  .center-kicker {
    fill: var(--hk-accent);
    font-size: 9px;
    font-weight: 700;
    text-anchor: middle;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .center-name {
    fill: var(--text);
    font-size: 14px;
    font-weight: 800;
    text-anchor: middle;
  }
  .center-soon {
    fill: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    text-anchor: middle;
  }
</style>
