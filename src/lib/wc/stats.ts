import { FR_NAME, FR_ABBR } from './bracket';

export interface Scorer {
  id: string;
  name: string;
  teamAbbr: string;
  logo: string;
  goals: number;
  pens: number;
}

export interface AttackRow {
  team: string;
  teamAbbr: string;
  logo: string;
  goalsFor: number;
  played: number;
}

export interface DefenseRow {
  team: string;
  teamAbbr: string;
  logo: string;
  against: number;
  played: number;
  perMatch: number;
}

export interface ConversionRow {
  team: string;
  teamAbbr: string;
  logo: string;
  goals: number;
  shots: number;
  pct: number;
}

export interface DisciplineRow {
  team: string;
  teamAbbr: string;
  logo: string;
  yellow: number;
  red: number;
  total: number;
}

export interface BigScore {
  wAbbr: string;
  wLogo: string;
  lAbbr: string;
  lLogo: string;
  ws: number;
  ls: number;
  phase: string;
}

export interface WcStats {
  scorers: Scorer[];
  attacks: AttackRow[];
  defenses: DefenseRow[];
  conversion: ConversionRow[];
  discipline: DisciplineRow[];
  bigScores: BigScore[];
  worstDefense: number;
  totalGoals: number;
  matchesPlayed: number;
  goalsPerMatch: number;
  shootouts: number;
  redCards: number;
  updated: number;
}

interface Agg {
  name: string;
  abbr: string;
  logo: string;
  gf: number;
  ga: number;
  played: number;
  shots: number;
  yellow: number;
  red: number;
}

const frName = (n: string) => FR_NAME[n] ?? n;
const frAbbr = (n: string) => FR_ABBR[n] ?? n.slice(0, 3).toUpperCase();
const cnum = (c: any, name: string) => {
  const v = c.statistics?.find((s: any) => s.name === name)?.displayValue;
  return v == null ? NaN : Number(v);
};
const PHASE: Record<string, string> = {
  'group-stage': 'Groupes',
  'round-of-32': '16es',
  'round-of-16': '8es',
  quarterfinals: 'Quarts',
  semifinals: 'Demies',
  final: 'Finale'
};
const MIN_PLAYED = 3;

export function computeStats(events: any[]): WcStats {
  const agg = new Map<string, Agg>();
  const ensure = (t: any): Agg => {
    let a = agg.get(t.id);
    if (!a) {
      a = { name: frName(t.displayName), abbr: frAbbr(t.displayName), logo: t.logo ?? '', gf: 0, ga: 0, played: 0, shots: 0, yellow: 0, red: 0 };
      agg.set(t.id, a);
    }
    return a;
  };

  const scorers = new Map<string, Scorer>();
  const bigScores: BigScore[] = [];
  let totalGoals = 0;
  let matchesPlayed = 0;
  let shootouts = 0;
  let redCards = 0;

  for (const e of events) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const post = e.status?.type?.state === 'post';
    const cs = comp.competitors ?? [];
    const home = cs.find((c: any) => c.homeAway === 'home') ?? cs[0];
    const away = cs.find((c: any) => c.homeAway === 'away') ?? cs[1];

    if (post) {
      matchesPlayed++;
      const hs = Number(home?.score);
      const as = Number(away?.score);
      for (const [c, own, opp] of [
        [home, hs, as],
        [away, as, hs]
      ] as const) {
        if (!c?.team?.id) continue;
        const a = ensure(c.team);
        a.played++;
        if (!Number.isNaN(own)) a.gf += own;
        if (!Number.isNaN(opp)) a.ga += opp;
        const sh = cnum(c, 'totalShots');
        if (!Number.isNaN(sh)) a.shots += sh;
      }
      if (!Number.isNaN(hs) && !Number.isNaN(as) && Math.abs(hs - as) >= 3) {
        const win = hs >= as ? home : away;
        const los = hs >= as ? away : home;
        bigScores.push({
          wAbbr: frAbbr(win.team.displayName),
          wLogo: win.team.logo ?? '',
          lAbbr: frAbbr(los.team.displayName),
          lLogo: los.team.logo ?? '',
          ws: Math.max(hs, as),
          ls: Math.min(hs, as),
          phase: PHASE[e.season?.slug] ?? ''
        });
      }
    }

    let hadShootout = false;
    for (const d of comp.details ?? []) {
      if (d.shootout) {
        hadShootout = true;
        continue;
      }
      if (d.team?.id) {
        const a = ensure(d.team);
        if (d.yellowCard) a.yellow++;
        if (d.redCard) a.red++;
      }
      if (d.redCard) redCards++;
      if (!d.scoringPlay) continue;
      totalGoals++;
      if (d.ownGoal) continue;
      const ath = d.athletesInvolved?.[0];
      if (!ath?.id) continue;
      const info = d.team?.id ? agg.get(d.team.id) : undefined;
      const cur =
        scorers.get(ath.id) ??
        { id: ath.id, name: ath.displayName ?? ath.shortName ?? '', teamAbbr: info?.abbr ?? '', logo: info?.logo ?? '', goals: 0, pens: 0 };
      cur.goals++;
      if (d.penaltyKick) cur.pens++;
      scorers.set(ath.id, cur);
    }
    if (hadShootout) shootouts++;
  }

  const teams = [...agg.values()];
  const played = teams.filter((t) => t.played >= MIN_PLAYED);

  const topScorers = [...scorers.values()]
    .sort((a, b) => b.goals - a.goals || a.pens - b.pens || a.name.localeCompare(b.name))
    .slice(0, 5);

  const attacks: AttackRow[] = played
    .map((t) => ({ team: t.name, teamAbbr: t.abbr, logo: t.logo, goalsFor: t.gf, played: t.played }))
    .sort((a, b) => b.goalsFor - a.goalsFor || b.played - a.played)
    .slice(0, 5);

  const defRows = played
    .map((t) => ({ team: t.name, teamAbbr: t.abbr, logo: t.logo, against: t.ga, played: t.played, perMatch: t.ga / t.played }))
    .sort((a, b) => a.perMatch - b.perMatch || a.against - b.against);
  const worstDefense = defRows.length ? Math.max(...defRows.map((d) => d.perMatch)) : 1;
  const defenses = defRows.slice(0, 5);

  const conversion: ConversionRow[] = played
    .filter((t) => t.shots > 0)
    .map((t) => ({ team: t.name, teamAbbr: t.abbr, logo: t.logo, goals: t.gf, shots: t.shots, pct: (t.gf / t.shots) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const discipline: DisciplineRow[] = teams
    .map((t) => ({ team: t.name, teamAbbr: t.abbr, logo: t.logo, yellow: t.yellow, red: t.red, total: t.yellow + t.red }))
    .sort((a, b) => b.total - a.total || b.red - a.red)
    .slice(0, 5);

  bigScores.sort((a, b) => b.ws - b.ls - (a.ws - a.ls) || b.ws + b.ls - (a.ws + a.ls));

  return {
    scorers: topScorers,
    attacks,
    defenses,
    conversion,
    discipline,
    bigScores: bigScores.slice(0, 5),
    worstDefense,
    totalGoals,
    matchesPlayed,
    goalsPerMatch: matchesPlayed ? totalGoals / matchesPlayed : 0,
    shootouts,
    redCards,
    updated: Date.now()
  };
}
