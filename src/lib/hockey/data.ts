import raw from '../../data/hockey.json';
import videosRaw from '../../data/hockey-videos.json';

export interface Team {
  code: string;
  name: string;
  teamId: number | null;
}

export interface PoolTeam {
  teamId: number | null;
  code: string | null;
  name: string;
  rank: number;
  gp: number;
  w: number;
  d: number;
  l: number;
  gd: number;
  pts: number;
}

export interface Pool {
  letter: string;
  poolId: number;
  teams: PoolTeam[];
}

export interface Scorer {
  team: string;
  minute: number;
  player: string;
  type: string | null;
  action: string;
  score: string | null;
}

export interface Card {
  team: string;
  minute: number;
  player: string;
  card: string;
}

export interface MatchStats {
  quarters: [number, number][];
  shots?: [number, number];
  circleEntries?: [number, number];
  penaltyCorners?: [number, number];
  possession?: [number, number];
}

export interface Match {
  id: number;
  home: string;
  away: string;
  homeLabel?: string;
  awayLabel?: string;
  hg: number | null;
  ag: number | null;
  so: [number, number] | null;
  played: boolean;
  utc: string | null;
  phase: string | null;
  venue?: string;
  status?: string | null;
  scorers?: Scorer[];
  cards?: Card[];
  stats?: MatchStats;
}

export interface Comp {
  gender: 'M' | 'W';
  competitionId: number;
  pools: Record<string, Pool>;
  matches: Match[];
  teams: Record<string, Team>;
}

export interface Hockey {
  updated: string;
  men: Comp;
  women: Comp;
}

export interface HockeyVideoRef {
  id: string;
  title: string;
  gender: 'M' | 'W';
  kind?: 'highlights' | 'replay';
  source?: 'FIH';
  published?: string;
}

export const HOCKEY = raw as unknown as Hockey;

export type Gender = 'men' | 'women';

export const FIRST_POOLS = ['A', 'B', 'C', 'D'];
export const SUPER_POOLS = ['E', 'F'];
export const CLASS_POOLS = ['G', 'H'];

export const SUPER_FEED: Record<string, string[]> = { E: ['A', 'D'], F: ['B', 'C'] };

const ISO2: Record<string, string> = {
  ARG: 'ar', AUS: 'au', BEL: 'be', CHI: 'cl', CHN: 'cn', ESP: 'es', FRA: 'fr',
  GER: 'de', IND: 'in', IRL: 'ie', JPN: 'jp', MAS: 'my', NED: 'nl', NZL: 'nz',
  PAK: 'pk', RSA: 'za', USA: 'us'
};

const SPECIAL_FLAG: Record<string, string> = {
  ENG: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  SCO: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  WAL: '🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}'
};

export const flagUrl = (code: string | null): string =>
  code ? `https://hockey-cdn.altius.live/resources/flags/round/${code}.png` : '';

export const flag = (code: string | null): string => {
  if (!code) return '';
  if (SPECIAL_FLAG[code]) return SPECIAL_FLAG[code];
  const iso = ISO2[code];
  if (!iso) return '';
  return [...iso.toUpperCase()].map((c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0))).join('');
};

export const comp = (g: Gender): Comp => HOCKEY[g];

const VIDEOS = videosRaw as Record<string, HockeyVideoRef>;

export const videoOf = (g: Gender, match: Match): HockeyVideoRef | null => {
  const pair = [match.home, match.away].sort().join('|');
  const gender = g === 'men' ? 'M' : 'W';
  const video = VIDEOS[`${gender}:${pair}`] ?? VIDEOS[pair];
  if (video?.gender !== gender) return null;
  const prefix = video.kind === 'replay' ? 'Match complet' : 'Résumé';
  return { ...video, title: `${prefix} : ${matchSideName(g, match, 'home')} – ${matchSideName(g, match, 'away')}` };
};

const FR_NAME: Record<string, string> = {
  ARG: 'Argentine', AUS: 'Australie', BEL: 'Belgique', CHI: 'Chili', CHN: 'Chine',
  ENG: 'Angleterre', ESP: 'Espagne', FRA: 'France', GER: 'Allemagne', IND: 'Inde',
  IRL: 'Irlande', JPN: 'Japon', MAS: 'Malaisie', NED: 'Pays-Bas', NZL: 'Nouvelle-Zélande',
  PAK: 'Pakistan', RSA: 'Afrique du Sud', SCO: 'Écosse', USA: 'États-Unis', WAL: 'Pays de Galles'
};

export const teamName = (g: Gender, code: string): string =>
  FR_NAME[code] ?? HOCKEY[g].teams[code]?.name ?? code;

const seedName = (label: string): string => {
  const pool = label.match(/^(\d)(?:st|nd|rd|th|h) Pool ([A-H])$/i);
  if (pool) return `${pool[1] === '1' ? '1er' : `${pool[1]}e`} de la poule ${pool[2].toUpperCase()}`;
  const winner = label.match(/^Winner (\d+)$/i);
  if (winner) return `Vainqueur du match ${winner[1]}`;
  const loser = label.match(/^Loser (\d+)$/i);
  if (loser) return `Perdant du match ${loser[1]}`;
  return label || 'À déterminer';
};

interface StandRow {
  code: string;
  pts: number;
  gd: number;
  gf: number;
  rem: number;
}

const FINAL_STATUS = /official|complete|finish|full[\s-]?time|ended|result/i;

const matchDecided = (m: Match): boolean => {
  if (!m.played || m.hg == null || m.ag == null) return false;
  const s = (m.status ?? '').trim();
  return s === '' ? true : FINAL_STATUS.test(s);
};

const poolStandings = (g: Gender, letter: string): StandRow[] => {
  const rows = new Map<string, StandRow>();
  const ensure = (code: string): StandRow => {
    let row = rows.get(code);
    if (!row) {
      row = { code, pts: 0, gd: 0, gf: 0, rem: 0 };
      rows.set(code, row);
    }
    return row;
  };
  for (const t of HOCKEY[g].pools[letter]?.teams ?? []) if (t.code) ensure(t.code);
  for (const m of HOCKEY[g].matches.filter((x) => x.phase === letter)) {
    if (!m.home || !m.away) continue;
    const h = ensure(m.home);
    const a = ensure(m.away);
    if (matchDecided(m)) {
      const hg = m.hg as number;
      const ag = m.ag as number;
      h.gf += hg;
      a.gf += ag;
      h.gd += hg - ag;
      a.gd += ag - hg;
      if (hg > ag) h.pts += 3;
      else if (hg < ag) a.pts += 3;
      else {
        h.pts += 1;
        a.pts += 1;
      }
    } else {
      h.rem += 1;
      a.rem += 1;
    }
  }
  return [...rows.values()];
};

export const rankClinched = (g: Gender, letter: string, target: number): string | null => {
  const base = poolStandings(g, letter);
  if (base.length < target) return null;
  const remMatches = HOCKEY[g].matches
    .filter((m) => m.phase === letter && m.home && m.away && !matchDecided(m))
    .map((m) => [m.home, m.away] as [string, string]);
  const remCount = new Map(base.map((r) => [r.code, r.rem]));
  const n = remMatches.length;
  if (n > 12) return null;
  const total = 3 ** n;
  let winner: string | null = null;
  for (let s = 0; s < total; s++) {
    const pts = new Map(base.map((r) => [r.code, r.pts]));
    let k = s;
    for (const [h, a] of remMatches) {
      const outcome = k % 3;
      k = Math.floor(k / 3);
      if (outcome === 0) pts.set(h, (pts.get(h) ?? 0) + 3);
      else if (outcome === 1) pts.set(a, (pts.get(a) ?? 0) + 3);
      else {
        pts.set(h, (pts.get(h) ?? 0) + 1);
        pts.set(a, (pts.get(a) ?? 0) + 1);
      }
    }
    const order = [...base].sort(
      (x, y) =>
        (pts.get(y.code) ?? 0) - (pts.get(x.code) ?? 0) ||
        y.gd - x.gd ||
        y.gf - x.gf ||
        (x.code < y.code ? -1 : 1)
    );
    const at = order[target - 1];
    const tieUnsafe = (other: StandRow | undefined): boolean =>
      !!other &&
      pts.get(other.code) === pts.get(at.code) &&
      ((remCount.get(at.code) ?? 0) > 0 || (remCount.get(other.code) ?? 0) > 0);
    if (tieUnsafe(order[target - 2]) || tieUnsafe(order[target])) return null;
    if (winner === null) winner = at.code;
    else if (winner !== at.code) return null;
  }
  return winner;
};

const resolveSeed = (g: Gender, label: string | null | undefined): string | null => {
  if (!label) return null;
  const m = label.match(/^(\d)(?:st|nd|rd|th|h) Pool ([A-H])$/i);
  if (!m) return null;
  const rank = Number(m[1]);
  const letter = m[2].toUpperCase();
  if (FIRST_POOLS.includes(letter)) return rankClinched(g, letter, rank);
  const matches = HOCKEY[g].matches.filter((x) => x.phase === letter);
  if (!matches.length || !matches.every(matchDecided)) return null;
  return HOCKEY[g].pools[letter]?.teams.find((t) => t.rank === rank)?.code ?? null;
};

export const matchSideCode = (g: Gender, match: Match, side: 'home' | 'away'): string | null => {
  const code = match[side];
  if (code) return code;
  return resolveSeed(g, side === 'home' ? match.homeLabel : match.awayLabel);
};

export const matchSideName = (g: Gender, match: Match, side: 'home' | 'away'): string => {
  const code = matchSideCode(g, match, side);
  if (code) return teamName(g, code);
  return seedName(side === 'home' ? match.homeLabel ?? '' : match.awayLabel ?? '');
};

export const phaseLabel = (phase: string | null): string => {
  if (!phase) return '';
  if (FIRST_POOLS.includes(phase)) return `Poule ${phase}`;
  if (SUPER_POOLS.includes(phase)) return `2e phase · poule ${phase}`;
  if (CLASS_POOLS.includes(phase)) return `2e phase · classement ${phase}`;
  if (phase === 'SF') return 'Demi-finale';
  if (phase === '1/2') return 'Finale';
  if (phase === '3/4') return 'Petite finale';
  const places = phase.match(/^(\d+)\/(\d+)$/);
  return places ? `Match pour les ${places[1]}e et ${places[2]}e places` : phase;
};

export const enName = (g: Gender, code: string): string => HOCKEY[g].teams[code]?.name ?? code;

export const eventTeamCode = (g: Gender, match: Match, name: string): string => {
  const key = name.trim().toLocaleLowerCase('fr');
  for (const code of [match.home, match.away]) {
    if (!code) continue;
    if ([code, enName(g, code), teamName(g, code)].some((value) => value.toLocaleLowerCase('fr') === key)) return code;
  }
  return '';
};

export const eventTeamName = (g: Gender, match: Match, name: string): string => {
  const code = eventTeamCode(g, match, name);
  return code ? teamName(g, code) : name;
};

const FR_ABBR: Record<string, string> = {
  ARG: 'ARG', AUS: 'AUS', BEL: 'BEL', CHI: 'CHI', CHN: 'CHN', ENG: 'ANG', ESP: 'ESP',
  FRA: 'FRA', GER: 'ALL', IND: 'IND', IRL: 'IRL', JPN: 'JAP', MAS: 'MAL', NED: 'P-B',
  NZL: 'NZL', PAK: 'PAK', RSA: 'AFS', SCO: 'ECO', USA: 'USA', WAL: 'GAL'
};

export const abbr = (code: string | null): string => (code ? FR_ABBR[code] ?? code : '');

export const cardClass = (card: string): 'green' | 'yellow' | 'red' => {
  const k = (card ?? '').toLowerCase();
  if (k.startsWith('r')) return 'red';
  if (k.startsWith('y')) return 'yellow';
  return 'green';
};

export const frPeriod = (p: string | null | undefined): string => {
  const s = (p ?? '').trim();
  if (!s) return 'En direct';
  const k = s.toLowerCase();
  if (/warm|(^|[^a-z])wu([^a-z]|$)/.test(k)) return 'Échauffement';
  if (/upcoming|not started|scheduled|(^|[^a-z])up([^a-z]|$)/.test(k)) return 'À venir';
  if (/shoot|penalt|(^|[^a-z])so([^a-z]|$)/.test(k)) return 'Tirs au but';
  if (/half|(^|[^a-z])ht([^a-z]|$)/.test(k)) return 'Mi-temps';
  if (/official|complet|full time|(^|[^a-z])(of|co|ft)([^a-z]|$)/.test(k)) return 'Terminé';
  const q = k.match(/([1-4])\s*(?:st|nd|rd|th)?\s*(?:quarter|interval|period|q)|q\s*([1-4])/);
  const n = q?.[1] ?? q?.[2];
  if (n) return `Q${n}`;
  return 'En direct';
};

export const todayKey = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());

export const poolOf = (g: Gender, letter: string): Pool | null => HOCKEY[g].pools[letter] ?? null;

export const matchesOfPool = (g: Gender, letter: string): Match[] =>
  HOCKEY[g].matches.filter((m) => m.phase === letter);

export const hasStarted = (g: Gender): boolean =>
  HOCKEY[g].matches.some((m) => m.played);

const DT = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Brussels'
});

const TIME = new Intl.DateTimeFormat('fr-BE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Brussels'
});

const DAY = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Brussels'
});

const toDate = (utc: string | null): Date | null => {
  if (!utc) return null;
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
};

export const fmtDateTime = (utc: string | null): string => {
  const d = toDate(utc);
  return d ? DT.format(d).replace(/:/g, 'h') : '';
};

export const fmtTime = (utc: string | null): string => {
  const d = toDate(utc);
  return d ? TIME.format(d).replace(/:/g, 'h') : '';
};

export const fmtDay = (utc: string | null): string => {
  const d = toDate(utc);
  return d ? DAY.format(d) : '';
};

export const dayKey = (utc: string | null): string => (utc ? utc.slice(0, 10) : '');

export const isFinal = (g: Gender): Match | null =>
  HOCKEY[g].matches.find((m) => m.phase === 'Final' || m.phase === 'F1' || m.phase === '1/2') ?? null;
