const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=';
const RANGES = ['20260611-20260701', '20260701-20260719'];

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

export interface GoalEvent {
  minute: string;
  scorer: string;
  note: string | null;
}

export interface CardEvent {
  minute: string;
  scorer: string;
  red: boolean;
}

export interface Side {
  id: string;
  name: string;
  nameFr: string;
  abbr: string;
  logo: string;
  homeAway: 'home' | 'away';
  winner: boolean;
  score: string | null;
  shootout: string | null;
  color: string;
  altColor: string;
  form: string | null;
  possession: string | null;
  shots: string | null;
  shotsOnTarget: string | null;
  corners: string | null;
  fouls: string | null;
  assists: string | null;
  record: string | null;
  goals: GoalEvent[];
  cards: CardEvent[];
  venue: string | null;
  city: string | null;
  country: string | null;
  date: string | null;
  roundLabel: string | null;
  opp: Side | null;
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

export const FR_NAME: Record<string, string> = {
  Algeria: 'Algérie',
  Argentina: 'Argentine',
  Australia: 'Australie',
  Austria: 'Autriche',
  Belgium: 'Belgique',
  'Bosnia-Herzegovina': 'Bosnie-Herzégovine',
  Brazil: 'Brésil',
  Canada: 'Canada',
  'Cape Verde': 'Cap-Vert',
  Colombia: 'Colombie',
  'Congo DR': 'RD Congo',
  Croatia: 'Croatie',
  Curaçao: 'Curaçao',
  Czechia: 'Tchéquie',
  Ecuador: 'Équateur',
  Egypt: 'Égypte',
  England: 'Angleterre',
  France: 'France',
  Germany: 'Allemagne',
  Ghana: 'Ghana',
  Haiti: 'Haïti',
  Iran: 'Iran',
  Iraq: 'Irak',
  'Ivory Coast': "Côte d'Ivoire",
  Japan: 'Japon',
  Jordan: 'Jordanie',
  Mexico: 'Mexique',
  Morocco: 'Maroc',
  Netherlands: 'Pays-Bas',
  'New Zealand': 'Nouvelle-Zélande',
  Norway: 'Norvège',
  Panama: 'Panama',
  Paraguay: 'Paraguay',
  Portugal: 'Portugal',
  Qatar: 'Qatar',
  'Saudi Arabia': 'Arabie saoudite',
  Scotland: 'Écosse',
  Senegal: 'Sénégal',
  'South Africa': 'Afrique du Sud',
  'South Korea': 'Corée du Sud',
  Spain: 'Espagne',
  Sweden: 'Suède',
  Switzerland: 'Suisse',
  Tunisia: 'Tunisie',
  Türkiye: 'Turquie',
  'United States': 'États-Unis',
  Uruguay: 'Uruguay',
  Uzbekistan: 'Ouzbékistan'
};

export const FR_ABBR: Record<string, string> = {
  Algeria: 'ALG',
  Argentina: 'ARG',
  Australia: 'AUS',
  Austria: 'AUT',
  Belgium: 'BEL',
  'Bosnia-Herzegovina': 'BIH',
  Brazil: 'BRÉ',
  Canada: 'CAN',
  'Cape Verde': 'CAP',
  Colombia: 'COL',
  'Congo DR': 'RDC',
  Croatia: 'CRO',
  Curaçao: 'CUR',
  Czechia: 'TCH',
  Ecuador: 'ÉQU',
  Egypt: 'ÉGY',
  England: 'ANG',
  France: 'FRA',
  Germany: 'ALL',
  Ghana: 'GHA',
  Haiti: 'HAÏ',
  Iran: 'IRN',
  Iraq: 'IRK',
  'Ivory Coast': 'CIV',
  Japan: 'JAP',
  Jordan: 'JOR',
  Mexico: 'MEX',
  Morocco: 'MAR',
  Netherlands: 'PBS',
  'New Zealand': 'NZL',
  Norway: 'NOR',
  Panama: 'PAN',
  Paraguay: 'PAR',
  Portugal: 'POR',
  Qatar: 'QAT',
  'Saudi Arabia': 'ARA',
  Scotland: 'ÉCO',
  Senegal: 'SÉN',
  'South Africa': 'AFS',
  'South Korea': 'CDS',
  Spain: 'ESP',
  Sweden: 'SUÈ',
  Switzerland: 'SUI',
  Tunisia: 'TUN',
  Türkiye: 'TUR',
  'United States': 'USA',
  Uruguay: 'URU',
  Uzbekistan: 'OUZ'
};

const stat = (c: any, name: string): string | null =>
  c.statistics?.find((s: any) => s.name === name)?.displayValue ?? null;

function side(c: any): Side | null {
  const name = c?.team?.displayName ?? '';
  if (!name || PLACEHOLDER.test(name)) return null;
  return {
    id: c.team?.id ?? '',
    name,
    nameFr: FR_NAME[name] ?? name,
    abbr: FR_ABBR[name] ?? c.team?.abbreviation ?? name.slice(0, 3).toUpperCase(),
    logo: c.team?.logo ?? '',
    homeAway: c.homeAway === 'away' ? 'away' : 'home',
    winner: !!c.winner,
    score: c.score ?? null,
    shootout: c.shootoutScore != null ? String(c.shootoutScore) : null,
    color: c.team?.color ?? '',
    altColor: c.team?.alternateColor ?? '',
    form: c.form ?? null,
    possession: stat(c, 'possessionPct'),
    shots: stat(c, 'totalShots'),
    shotsOnTarget: stat(c, 'shotsOnTarget'),
    corners: stat(c, 'wonCorners'),
    fouls: stat(c, 'foulsCommitted'),
    assists: stat(c, 'goalAssists'),
    record: c.records?.find((r: any) => r.type === 'total')?.summary ?? c.records?.[0]?.summary ?? null,
    goals: [],
    cards: [],
    venue: null,
    city: null,
    country: null,
    date: null,
    roundLabel: null,
    opp: null
  };
}

function enrich(s: Side | null, comp: any, roundLabel: string) {
  if (!s) return;
  s.venue = comp.venue?.fullName ?? null;
  s.city = comp.venue?.address?.city ?? null;
  s.country = comp.venue?.address?.country ?? null;
  s.date = comp.date ?? comp.startDate ?? null;
  s.roundLabel = roundLabel;
  for (const d of comp.details ?? []) {
    if (d.team?.id !== s.id) continue;
    const minute = d.clock?.displayValue ?? '';
    const a0 = d.athletesInvolved?.[0];
    const who = a0?.shortName ?? a0?.displayName ?? '';
    if (d.scoringPlay && !d.shootout) {
      const note = d.penaltyKick
        ? 'pen'
        : d.ownGoal
          ? 'csc'
          : /header/i.test(d.type?.text ?? '')
            ? 'tête'
            : null;
      s.goals.push({ minute, scorer: who, note });
    } else if (d.redCard || d.yellowCard) {
      s.cards.push({ minute, scorer: who, red: !!d.redCard });
    }
  }
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
      const home = side(homeC);
      const away = side(awayC);
      enrich(home, comp, ROUND_LABEL[round]);
      enrich(away, comp, ROUND_LABEL[round]);
      if (home && away) {
        home.opp = away;
        away.opp = home;
      }
      return {
        round,
        num: i + 1,
        id: e.id,
        date: e.date,
        state: e.status?.type?.state ?? 'pre',
        detail: e.status?.type?.shortDetail ?? '',
        home,
        away,
        _home: homeC,
        _away: awayC,
        feeds: null,
        angle: 0
      } as WcMatch & { _home: any; _away: any };
    });
}

interface SlotRes {
  num: number;
  real: boolean;
}

function resolveSlot(c: any, real: Side | null, prev: WcMatch[]): SlotRes {
  if (real) {
    const idx = prev.findIndex(
      (p) =>
        (p.home?.name === real.name && p.home?.winner) ||
        (p.away?.name === real.name && p.away?.winner)
    );
    if (idx >= 0) return { num: idx + 1, real: true };
  }
  const n = placeholderNum(c);
  return { num: n ?? 0, real: false };
}

function assignFeeds(nexts: any[], prev: WcMatch[]) {
  const slots = nexts.map((m) => [
    resolveSlot(m._home, m.home, prev),
    resolveSlot(m._away, m.away, prev)
  ]);
  const claimed = new Set<number>();
  for (const pair of slots)
    for (const s of pair) if (s.real && s.num) claimed.add(s.num);
  const unclaimed: number[] = [];
  for (let n = 1; n <= prev.length; n++) if (!claimed.has(n)) unclaimed.push(n);
  const holes = slots
    .flat()
    .filter((s) => !s.real)
    .sort((a, b) => (a.num || Number.MAX_SAFE_INTEGER) - (b.num || Number.MAX_SAFE_INTEGER));
  holes.forEach((s, i) => {
    s.num = unclaimed[i] ?? 0;
  });
  nexts.forEach((m, i) => {
    m.feeds = [slots[i][0].num, slots[i][1].num];
  });
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

export async function fetchScoreboard(signal?: AbortSignal): Promise<any> {
  const pages = await Promise.all(
    RANGES.map(async (range) => {
      const res = await fetch(SCOREBOARD + range, { signal });
      if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
      return res.json();
    })
  );
  const seen = new Set<string>();
  const events: any[] = [];
  for (const page of pages)
    for (const ev of page.events ?? [])
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        events.push(ev);
      }
  return { events };
}

export async function fetchBracket(signal?: AbortSignal): Promise<Bracket> {
  const data = await fetchScoreboard(signal);
  return buildBracket(data.events ?? []);
}

export function buildBracket(events: any[]): Bracket {
  const R32 = normaliseRound(events, 'round-of-32', 'R32');
  const R16 = normaliseRound(events, 'round-of-16', 'R16');
  const QF = normaliseRound(events, 'quarterfinals', 'QF');

  assignFeeds(R16, R32);
  assignFeeds(QF, R16);

  let SF = normaliseRound(events, 'semifinals', 'SF');
  if (SF.length === 2) {
    assignFeeds(SF, QF);
  } else {
    SF = [tbd('SF', 1, [1, 2], '2026-07-14T19:00Z'), tbd('SF', 2, [3, 4], '2026-07-15T19:00Z')];
  }

  let F = normaliseRound(events, 'final', 'F');
  if (F.length === 1) {
    assignFeeds(F, SF);
  } else {
    F = [tbd('F', 1, [1, 2], '2026-07-19T19:00Z')];
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
