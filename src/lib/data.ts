import rawDevils from '../data/matches.json';
import rawFlames from '../data/matches.flames.json';

export type Result = 'W' | 'D' | 'L';

// The two Belgian national teams the viz can show. `devils` is the default.
export type TeamKey = 'devils' | 'flames';
export interface TeamInfo {
  key: TeamKey;
  /** Full name shown in the title. */
  name: string;
  /** Short label for the toggle button. */
  short: string;
}
export const TEAM_LIST: TeamInfo[] = [
  { key: 'devils', name: 'Diables Rouges', short: 'Diables Rouges' },
  { key: 'flames', name: 'Red Flames', short: 'Red Flames' }
];

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
  /** RTBF Auvio links (Red Devils only; present only when available). */
  article?: string;
  video?: string;
}

// Compact per-match detail shown in the popup (from src/data/details.json).
export interface MatchGoal {
  side: 'home' | 'away';
  minute: number;
  kind: string; // goalScored | penaltyScored | ownGoalScored
  firstName: string;
  lastName: string;
}
export interface MatchDetailData {
  homeLogo: string;
  awayLogo: string;
  goals: MatchGoal[];
  referee: string;
  city: string;
  stadium: string;
}

// Each team's match details live in one bundled file (logos, scorers, referee,
// venue), keyed by match id. Loaded once per team.
import detailsDevils from '../data/details.json';
import detailsFlames from '../data/details.flames.json';
const DETAILS: Record<TeamKey, Record<string, MatchDetailData>> = {
  devils: detailsDevils as unknown as Record<string, MatchDetailData>,
  flames: detailsFlames as unknown as Record<string, MatchDetailData>
};

export function loadDetail(team: TeamKey, id: string): MatchDetailData | null {
  return DETAILS[team][id] ?? null;
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

export interface TeamData {
  matches: Match[];
  meta: Meta;
  /** Categories that actually occur in this team's data, in display order. */
  categories: string[];
}

const RAW: Record<TeamKey, any> = { devils: rawDevils, flames: rawFlames };

/** Everything the viz needs for one team: matches, meta, and its filter categories. */
export function getTeam(team: TeamKey): TeamData {
  const matches: Match[] = RAW[team].matches;
  const meta: Meta = RAW[team].meta;
  // Only show categories that actually occur for this team.
  const categories = CATEGORY_ORDER.filter((c) => matches.some((m) => m.category === c));
  return { matches, meta, categories };
}

// Belgian flag palette — Win=red, Draw=yellow, Loss=black.
// Static values (SSR fallback / reference). At runtime, prefer RESULT_VARS so the
// colours follow the active light/dark theme (loss is lightened in dark mode).
export const RESULT_COLORS: Record<Result, string> = {
  W: '#e63329', // victoire – rouge
  D: '#f4c20d', // nul      – jaune
  L: '#1a1a1a'  // défaite  – noir
};

// Theme-aware result colours as CSS custom properties. SVG `fill` and CSS
// `background`/`color` both accept var(), so using these makes every result
// colour follow the theme with no JS.
export const RESULT_VARS: Record<Result, string> = {
  W: 'var(--result-win)',
  D: 'var(--result-draw)',
  L: 'var(--result-loss)'
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
