import raw from './data/matches.json';

export type Result = 'W' | 'D' | 'L';

export interface Match {
  id: string;
  date: string;
  year: number;
  competition: string;
  category: string;
  home: string;
  away: string;
  score: string;
  opponent: string;
  venue: 'home' | 'away';
  hostCountry: string;
  result: Result;
  stadium: string;
  coach: string;
  city: string;
  coords: [number, number] | null;
  approx: boolean;
  hasDetail: boolean;
}

// Shape of the per-match files in /static/details/<id>.json (subset we render).
export interface MatchEventPlayer {
  lastName: string;
  firstName: string;
  kind: string; // goalScored | ownGoalScored | penaltyScored | yellowCard | redCard | ...
  minute: number;
}
export interface MatchDetailData {
  id: string;
  location?: { name?: string; city?: string };
  officials?: { lastName: string; firstName: string; function: string }[];
  events?: { minute: number; home: MatchEventPlayer[]; away: MatchEventPlayer[] }[];
  homeTeam?: { id: string; name: string; logo?: string };
  awayTeam?: { id: string; name: string; logo?: string };
  outcome?: { homeTeamGoals: number; awayTeamGoals: number; hasPenalties?: boolean };
  lineup?: { home?: LineupPlayer; away?: LineupPlayer }[];
  substitutes?: { home?: LineupPlayer; away?: LineupPlayer }[];
}
export interface LineupPlayer {
  lastName: string;
  firstName: string;
  shirtNumber?: string;
  badges?: string;
}

// Per-match detail files live in src/data/details/<id>.json and are bundled as
// lazy chunks via Vite's glob import (loaded on demand when a match is opened).
const detailModules = import.meta.glob<{ default: MatchDetailData }>('../data/details/*.json');

const detailCache = new Map<string, MatchDetailData | null>();
export async function loadDetail(id: string): Promise<MatchDetailData | null> {
  if (detailCache.has(id)) return detailCache.get(id)!;
  const loader = detailModules[`../data/details/${id}.json`];
  if (!loader) {
    detailCache.set(id, null);
    return null;
  }
  try {
    const mod = await loader();
    detailCache.set(id, mod.default);
    return mod.default;
  } catch {
    detailCache.set(id, null);
    return null;
  }
}

export interface RecordMatch {
  date: string;
  score: string;
  opponent: string;
  home: string;
  away: string;
}
export interface Streak {
  length: number;
  from: RecordMatch | null;
  to: RecordMatch | null;
  ids: string[];
}
export interface Records {
  biggestWin: { match: RecordMatch | null; ids: string[] };
  heaviestDefeat: { match: RecordMatch | null; ids: string[] };
  mostConsecutiveWins: Streak;
  mostConsecutiveNoDefeat: Streak;
  mostConsecutiveDraws: Streak;
  mostConsecutiveNoDraw: Streak;
  mostConsecutiveNoWin: Streak;
  mostConsecutiveDefeats: Streak;
  mostConsecutiveScoring: Streak;
  mostConsecutiveNoScoring: Streak;
  mostConsecutiveConceding: Streak;
  mostConsecutiveCleanSheets: Streak;
}
export interface Meta {
  total: number;
  firstYear: number;
  lastYear: number;
  wins: number;
  draws: number;
  losses: number;
  records: Records;
}

export const matches: Match[] = (raw as any).matches;
export const meta: Meta = (raw as any).meta;

// Preferred display order for the filter bar (mirrors the original viz).
const CATEGORY_ORDER = [
  'Amical',
  'Qualifications',
  'Coupe du monde',
  "Championnat d'Europe",
  'Ligue des Nations',
  'Coupe des Confédérations',
  'Jeux olympiques',
  'Coupe intercontinentale'
];

// Only show categories that actually occur in the data (e.g. Belgium never
// played the Confédérations or Intercontinental cups, so those are dropped).
export const CATEGORIES = CATEGORY_ORDER.filter((c) => matches.some((m) => m.category === c));

// Belgian flag palette — Win=red, Draw=yellow, Loss=black.
export const RESULT_COLORS: Record<Result, string> = {
  W: '#e63329', // victoire – rouge
  D: '#f4c20d', // nul      – jaune
  L: '#1a1a1a'  // défaite  – noir
};

export const RESULT_LABELS: Record<Result, string> = {
  W: 'Victoire',
  D: 'Nul',
  L: 'Défaite'
};

// Map our host-country labels -> world-atlas (110m) country names for highlighting.
const COUNTRY_NAME_MAP: Record<string, string> = {
  Belgium: 'Belgium',
  England: 'United Kingdom',
  Scotland: 'United Kingdom',
  Wales: 'United Kingdom',
  'Northern Ireland': 'United Kingdom',
  'Republic of Ireland': 'Ireland',
  USA: 'United States of America',
  'Czech Republic': 'Czechia',
  Czechoslovakia: 'Czechia',
  'Bosnia-Herzegovina': 'Bosnia and Herz.',
  'North Macedonia': 'Macedonia',
  Yugoslavia: 'Serbia',
  Serbia: 'Serbia',
  GDR: 'Germany',
  'San Marino': 'Italy', // tiny – fold into surrounding for fill purposes
  Russia: 'Russia',
  Netherlands: 'Netherlands',
  France: 'France',
  Germany: 'Germany',
  Italy: 'Italy',
  Spain: 'Spain',
  Portugal: 'Portugal'
};

export function atlasName(country: string): string {
  return COUNTRY_NAME_MAP[country] ?? country;
}

// Merge historical / alternate country names to one present-day key, so matches
// played in the same place are grouped together (e.g. matches in Dublin labelled
// "E.L. Ireland" and "Republic of Ireland" are the same country).
const COUNTRY_CANONICAL: Record<string, string> = {
  'E.L. Ireland': 'Republic of Ireland',
  GDR: 'Germany',
  'West Germany': 'Germany',
  'Czecho-Slovakia': 'Czech Republic',
  'Soviet Union': 'Russia',
  Yugoslavia: 'Serbia',
  'Serbia and Montenegro': 'Serbia'
};
export function canonicalCountry(country: string): string {
  return COUNTRY_CANONICAL[country] ?? country;
}

// Raw competition strings -> French display labels (used in the match popup).
const COMPETITION_FR: Record<string, string> = {
  'International friendly': 'Match amical',
  'Friendly tournament': 'Tournoi amical',
  'FIFA World Cup': 'Coupe du monde',
  'FIFA WC Qualifiers': 'Qualifications Coupe du monde',
  'UEFA European Championship': "Championnat d'Europe",
  'UEFA EC Qualifiers': "Qualifications Championnat d'Europe",
  'UEFA Nations League': 'Ligue des Nations',
  'Olympic Games': 'Jeux olympiques',
  Qualification: 'Qualifications',
  'Qualifying round': 'Tour de qualification',
  'Preliminary round': 'Tour préliminaire',
  'Play-offs': 'Barrages'
};

/** Competition name in French for display (falls back to the original). */
export function competitionFr(competition: string): string {
  return COMPETITION_FR[competition] ?? competition;
}

// English (data) -> French display names for every country in the dataset.
const COUNTRY_FR: Record<string, string> = {
  Albania: 'Albanie',
  Algeria: 'Algérie',
  Andorra: 'Andorre',
  Argentina: 'Argentine',
  Armenia: 'Arménie',
  Australia: 'Australie',
  Austria: 'Autriche',
  Azerbaijan: 'Azerbaïdjan',
  Belarus: 'Biélorussie',
  Belgium: 'Belgique',
  'Bosnia-Herzegovina': 'Bosnie-Herzégovine',
  Brazil: 'Brésil',
  Bulgaria: 'Bulgarie',
  'Burkina Faso': 'Burkina Faso',
  Canada: 'Canada',
  Chile: 'Chili',
  Colombia: 'Colombie',
  'Costa Rica': 'Costa Rica',
  Croatia: 'Croatie',
  Cyprus: 'Chypre',
  'Czech Republic': 'République tchèque',
  'Czecho-Slovakia': 'Tchécoslovaquie',
  Denmark: 'Danemark',
  'E.L. Ireland': 'Irlande',
  Egypt: 'Égypte',
  'El Salvador': 'Salvador',
  England: 'Angleterre',
  Estonia: 'Estonie',
  'Faroe Islands': 'Îles Féroé',
  Finland: 'Finlande',
  France: 'France',
  GDR: 'RDA',
  Gabon: 'Gabon',
  Germany: 'Allemagne',
  Gibraltar: 'Gibraltar',
  Greece: 'Grèce',
  Hungary: 'Hongrie',
  Iceland: 'Islande',
  Iraq: 'Irak',
  Israel: 'Israël',
  Italy: 'Italie',
  'Ivory Coast': "Côte d'Ivoire",
  Japan: 'Japon',
  Kazakhstan: 'Kazakhstan',
  'Korea Republic': 'Corée du Sud',
  Latvia: 'Lettonie',
  Liechtenstein: 'Liechtenstein',
  Lithuania: 'Lituanie',
  Luxembourg: 'Luxembourg',
  Malta: 'Malte',
  Mexico: 'Mexique',
  Montenegro: 'Monténégro',
  Morocco: 'Maroc',
  Netherlands: 'Pays-Bas',
  'North Macedonia': 'Macédoine du Nord',
  'Northern Ireland': 'Irlande du Nord',
  Norway: 'Norvège',
  Panama: 'Panama',
  Paraguay: 'Paraguay',
  Peru: 'Pérou',
  Poland: 'Pologne',
  Portugal: 'Portugal',
  Qatar: 'Qatar',
  'Republic of Ireland': 'Irlande',
  Romania: 'Roumanie',
  Russia: 'Russie',
  'San Marino': 'Saint-Marin',
  'Saudi Arabia': 'Arabie saoudite',
  Scotland: 'Écosse',
  Serbia: 'Serbie',
  'Serbia and Montenegro': 'Serbie-et-Monténégro',
  Slovakia: 'Slovaquie',
  Slovenia: 'Slovénie',
  'Soviet Union': 'Union soviétique',
  Spain: 'Espagne',
  Sweden: 'Suède',
  Switzerland: 'Suisse',
  Tunisia: 'Tunisie',
  Turkey: 'Turquie',
  USA: 'États-Unis',
  Ukraine: 'Ukraine',
  Uruguay: 'Uruguay',
  Wales: 'Pays de Galles',
  'West Germany': 'Allemagne de l’Ouest',
  Yugoslavia: 'Yougoslavie',
  Zambia: 'Zambie'
};

/** Country name in French for display (falls back to the original if unknown). */
export function fr(country: string): string {
  return COUNTRY_FR[country] ?? country;
}

// City names are stored in Dutch in the CSV; this maps the ones with a distinct
// French exonym. Cities not listed here are spelled the same in French.
const CITY_FR: Record<string, string> = {
  Antwerpen: 'Anvers',
  Athene: 'Athènes',
  Bazel: 'Bâle',
  Basel: 'Bâle',
  Belgrado: 'Belgrade',
  Beograd: 'Belgrade',
  Berlin: 'Berlin',
  Boekarest: 'Bucarest',
  Bucharest: 'Bucarest',
  Brugge: 'Bruges',
  Brussel: 'Bruxelles',
  Boedapest: 'Budapest',
  Düsseldorf: 'Düsseldorf',
  Firenze: 'Florence',
  Gent: 'Gand',
  'Genève': 'Genève',
  Hanovre: 'Hanovre',
  Jeruzalem: 'Jérusalem',
  Keulen: 'Cologne',
  Kopenhagen: 'Copenhague',
  'La Coruna': 'La Corogne',
  'La Valetta': 'La Valette',
  'Le Caire': 'Le Caire',
  Lissabon: 'Lisbonne',
  'Liège': 'Liège',
  Londen: 'Londres',
  Luik: 'Liège',
  Luxemburg: 'Luxembourg',
  Milaan: 'Milan',
  Moskou: 'Moscou',
  Munich: 'Munich',
  'Nürnberg': 'Nuremberg',
  Parijs: 'Paris',
  Praag: 'Prague',
  Pragues: 'Prague',
  Praha: 'Prague',
  Rijsel: 'Lille',
  Rome: 'Rome',
  'Séoul': 'Séoul',
  'Oïta': 'Ōita',
  Turijn: 'Turin',
  Tokyo: 'Tokyo',
  Venetië: 'Venise',
  Warschau: 'Varsovie',
  Wenen: 'Vienne',
  Vienna: 'Vienne',
  Zürich: 'Zurich'
};

/** City name in French for display (falls back to the original spelling). */
export function cityFr(city: string): string {
  return CITY_FR[city] ?? city;
}

// Set of world-atlas country names that have hosted a (filtered) match.
export function hostAtlasNames(ms: Match[]): Set<string> {
  return new Set(ms.map((m) => atlasName(m.hostCountry)));
}
