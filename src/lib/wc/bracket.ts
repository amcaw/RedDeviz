const ENDPOINT =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719';

export type RoundKey = 'R32' | 'R16' | 'QF' | 'SF' | 'F';
export const ROUND_ORDER: RoundKey[] = ['R32', 'R16', 'QF', 'SF', 'F'];
export const ROUND_LABEL: Record<RoundKey, string> = {
  R32: '16es de finale',
  R16: '8es de finale',
  QF: 'Quarts de finale',
  SF: 'Demi-finales',
  F: 'Finale'
};

export interface WcVideoRef {
  id: string;
  title: string;
}

export interface Side {
  name: string;
  abbr: string;
  logo: string;
  winner: boolean;
  score: string | null;
  shootout: string | null;
  color: string;
  altColor: string;
}

export interface WcMatch {
  round: RoundKey;
  num: number;
  id?: string;
  date?: string;
  state: 'pre' | 'in' | 'post';
  detail?: string;
  home: Side | null;
  away: Side | null;
  feeds: [number, number] | null;
  angle: number;
}

export interface Bracket {
  rounds: Record<RoundKey, WcMatch[]>;
  leafOrder: number[];
  updated: number;
}

const PLACEHOLDER = /Round of \d+ \d+ Winner|Quarterfinal \d+ Winner|Semifinal \d+ Winner/i;

function side(c: any): Side | null {
  const name = c?.team?.displayName ?? '';
  if (!name || PLACEHOLDER.test(name)) return null;
  return {
    name,
    abbr: c.team?.abbreviation ?? name.slice(0, 3).toUpperCase(),
    logo: c.team?.logo ?? '',
    winner: !!c.winner,
    score: c.score ?? null,
    shootout: c.shootoutScore != null ? String(c.shootoutScore) : null,
    color: c.team?.color ?? '',
    altColor: c.team?.alternateColor ?? ''
  };
}

function placeholderNum(c: any): number | null {
  const m = (c?.team?.displayName ?? '').match(/(\d+)\s+Winner/i);
  return m ? +m[1] : null;
}

function normaliseRound(events: any[], slug: string, round: RoundKey): WcMatch[] {
  return events
    .filter((e) => e.season?.slug === slug)
    .map((e, i) => {
      const comp = e.competitions[0];
      const cs = comp.competitors;
      const homeC = cs.find((c: any) => c.homeAway === 'home') ?? cs[0];
      const awayC = cs.find((c: any) => c.homeAway === 'away') ?? cs[1];
      return {
        round,
        num: i + 1,
        id: e.id,
        date: e.date,
        state: e.status?.type?.state ?? 'pre',
        detail: e.status?.type?.shortDetail ?? '',
        home: side(homeC),
        away: side(awayC),
        _home: homeC,
        _away: awayC,
        feeds: null,
        angle: 0
      } as WcMatch & { _home: any; _away: any };
    });
}

function resolveFeeds(m: any, prev: WcMatch[]): [number, number] {
  const one = (c: any, real: Side | null): number => {
    const n = placeholderNum(c);
    if (n) return n;
    if (real) {
      const idx = prev.findIndex(
        (p) =>
          (p.home?.name === real.name && p.home?.winner) ||
          (p.away?.name === real.name && p.away?.winner)
      );
      if (idx >= 0) return idx + 1;
    }
    return 0;
  };
  return [one(m._home, m.home), one(m._away, m.away)];
}

const tbd = (round: RoundKey, num: number, feeds: [number, number], date?: string): WcMatch => ({
  round,
  num,
  state: 'pre',
  home: null,
  away: null,
  feeds,
  angle: 0,
  date
});

export async function fetchBracket(signal?: AbortSignal): Promise<Bracket> {
  const res = await fetch(ENDPOINT, { signal });
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
  const data = await res.json();
  const events: any[] = data.events ?? [];

  const R32 = normaliseRound(events, 'round-of-32', 'R32');
  const R16 = normaliseRound(events, 'round-of-16', 'R16');
  const QF = normaliseRound(events, 'quarterfinals', 'QF');

  for (const m of R16 as any[]) m.feeds = resolveFeeds(m, R32);
  for (const m of QF as any[]) m.feeds = resolveFeeds(m, R16);

  let SF = normaliseRound(events, 'semifinals', 'SF');
  if (SF.length === 2) {
    for (const m of SF as any[]) m.feeds = resolveFeeds(m, QF);
  } else {
    SF = [tbd('SF', 1, [1, 2], '2026-07-14T00:00Z'), tbd('SF', 2, [3, 4], '2026-07-15T00:00Z')];
  }

  let F = normaliseRound(events, 'final', 'F');
  if (F.length === 1) {
    for (const m of F as any[]) m.feeds = resolveFeeds(m, SF);
  } else {
    F = [tbd('F', 1, [1, 2], '2026-07-19T00:00Z')];
  }

  const rounds: Record<RoundKey, WcMatch[]> = { R32, R16, QF, SF, F };

  const prevOf: Record<Exclude<RoundKey, 'R32'>, RoundKey> = {
    R16: 'R32',
    QF: 'R16',
    SF: 'QF',
    F: 'SF'
  };
  function leaves(round: RoundKey, num: number): number[] {
    if (round === 'R32') return [num];
    const m = rounds[round].find((x) => x.num === num);
    if (!m?.feeds) return [];
    const prev = prevOf[round as Exclude<RoundKey, 'R32'>];
    return [...leaves(prev, m.feeds[0]), ...leaves(prev, m.feeds[1])];
  }
  const leafOrder = leaves('F', 1).filter((n) => n > 0);

  layout(rounds, leafOrder);
  return { rounds, leafOrder, updated: Date.now() };
}

function layout(rounds: Record<RoundKey, WcMatch[]>, leafOrder: number[]) {
  const N = leafOrder.length || 16;
  const TAU = Math.PI * 2;
  leafOrder.forEach((num, i) => {
    const a = -Math.PI / 2 + (i + 0.5) * (TAU / N);
    const m = rounds.R32.find((x) => x.num === num);
    if (m) m.angle = a;
  });
  const prevOf: Record<Exclude<RoundKey, 'R32'>, RoundKey> = {
    R16: 'R32',
    QF: 'R16',
    SF: 'QF',
    F: 'SF'
  };
  for (const round of ['R16', 'QF', 'SF', 'F'] as Exclude<RoundKey, 'R32'>[]) {
    for (const m of rounds[round]) {
      if (!m.feeds) continue;
      const prev = rounds[prevOf[round]];
      const a = prev.find((x) => x.num === m.feeds![0])?.angle ?? 0;
      const b = prev.find((x) => x.num === m.feeds![1])?.angle ?? 0;
      m.angle = circularMid(a, b);
    }
  }
}

function circularMid(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d / 2;
}
