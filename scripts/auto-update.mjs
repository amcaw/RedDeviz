// Incremental, self-contained data refresh for the auto-update GitHub Action.
//
// Unlike the full pipeline in ../../data-pipeline (which rebuilds everything from
// 17 MB of per-match detail files), this script needs NOTHING heavy on disk: it
// reads the existing src/data/*.json bundles, asks the RBFA API for each team's
// match list, fetches ONLY the details of newly-played matches, geocodes any new
// city via Nominatim (capital fallback otherwise), and patches the bundles in
// place. Run: `node scripts/auto-update.mjs` (from the app/ dir).
//
// It mirrors the logic of data-pipeline/{fetch_red_devils.cjs,process_data.mjs,
// build_details.mjs}; keep them in sync if that logic changes.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, 'data'); // committed caches (geocode, country, stadium, Auvio)
const OUT = resolve(__dirname, '../src/data'); // the app's data bundles

const ENDPOINT = 'https://datalake-prod2018.rbfa.be/graphql';
const BELGIUM_TEAM_ID = '578';
const UA = 'red-devils-cartochronologie/1.0 (auto-update action)';
const TODAY = process.env.CUTOFF_DATE || new Date().toISOString().slice(0, 10);

const TEAMS = [
  { key: 'devils', categoryId: '26', matches: 'matches.json', details: 'details.json', auvio: true },
  { key: 'flames', categoryId: '33', matches: 'matches.flames.json', details: 'details.flames.json' }
];

// ---- shared caches (committed in scripts/data) ----------------------------
const cityCache = JSON.parse(readFileSync(resolve(DATA, 'geocode_cache.json'), 'utf8'));
const countryCache = JSON.parse(readFileSync(resolve(DATA, 'country_coords.json'), 'utf8'));
const STADIUM_FR = JSON.parse(readFileSync(resolve(DATA, 'stadium_fr.json'), 'utf8'));
let cityCacheDirty = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- GraphQL --------------------------------------------------------------
const LIST_QUERY = `query($l:Language!,$c:String!,$s:PaginationAmount,$o:Int){
  internationalMatchResults(language:$l,categoryId:$c,size:$s,offset:$o){
    matchResults{ id startDateTime eventTitle
      homeTeam{name goalsScored penaltiesScored}
      awayTeam{name goalsScored penaltiesScored} }
    pageInfo{total} } }`;

const DETAIL_QUERY = `query($matchId:ID!,$language:Language!){
  internationalMatchDetail(matchId:$matchId,language:$language){
    id location{ name city }
    officials{ lastName firstName function }
    events{ minute home{ lastName firstName kind minute } away{ lastName firstName kind minute } }
    homeTeam{ id name logo } awayTeam{ id name logo }
    outcome{ isFinished }
    tournament{ nameTournament }
    staffLineup{ home{ lastName firstName function } away{ lastName firstName function } } } }`;

async function gql(query, variables, attempt = 0) {
  let text;
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ query, variables })
    });
    text = await r.text();
  } catch (e) {
    text = 'NETWORK_ERROR:' + e.message;
  }
  if (text.includes('Access Denied') || text.startsWith('NETWORK_ERROR')) {
    if (attempt >= 6) throw new Error('RBFA API blocked/unreachable after retries');
    await sleep(Math.min(30000, 1000 * 2 ** attempt));
    return gql(query, variables, attempt + 1);
  }
  const j = JSON.parse(text);
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

async function fetchList(categoryId) {
  const size = 100;
  let offset = 0, total = Infinity, rows = [];
  while (offset < total) {
    const p = (await gql(LIST_QUERY, { l: 'en', c: categoryId, s: size, o: offset }))
      .internationalMatchResults;
    total = p.pageInfo.total;
    rows.push(...p.matchResults);
    offset += size;
    if (p.matchResults.length === 0) break;
  }
  return rows;
}

// ---- Nominatim geocoding (new cities only) --------------------------------
async function geocode(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const json = await res.json();
  if (!json.length) return null;
  return { lon: +json[0].lon, lat: +json[0].lat, display: json[0].display_name };
}

async function ensureCity(city, hostHint) {
  if (!city || cityCache[city]) return;
  for (const q of [hostHint ? `${city}, ${hostHint}` : city, city]) {
    let r = null;
    try { r = await geocode(q); } catch (e) { console.warn(`  geocode error: ${e.message}`); }
    await sleep(1100); // Nominatim: <=1 req/s
    if (r) { cityCache[city] = r; cityCacheDirty = true; console.log(`  geocoded ${city} -> [${r.lon.toFixed(3)}, ${r.lat.toFixed(3)}]`); return; }
  }
  console.warn(`  city not geocoded, will fall back to capital: ${city}`);
}

// ---- helpers mirrored from the pipeline -----------------------------------
const stadiumFr = (name) => (name ? STADIUM_FR[name] || name : '');
const fullName = (p) => [p.firstName, p.lastName].filter(Boolean).join(' ').trim();

function belgiumCoach(d) {
  if (!d?.staffLineup) return '';
  const side = d.homeTeam?.id === BELGIUM_TEAM_ID ? 'home'
    : d.awayTeam?.id === BELGIUM_TEAM_ID ? 'away' : null;
  if (!side) return '';
  const people = d.staffLineup.map((s) => s[side]).filter(Boolean);
  const coach = people.find((p) => /coach|trainer/i.test(p.function || '')) || people[0];
  return coach ? fullName(coach) : '';
}
function refereeOf(d) {
  const ref = (d?.officials || []).find((o) => /^referee$/i.test(o.function || ''));
  return ref ? fullName(ref) : '';
}

const NOMINATIM_TO_LABEL = {
  Czechia: 'Czech Republic', Ireland: 'Republic of Ireland', 'United States': 'USA',
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina', 'South Korea': 'Korea Republic',
  'United Kingdom': 'United Kingdom'
};
function ukNation(display) {
  if (/Scotland/.test(display)) return 'Scotland';
  if (/Wales/.test(display)) return 'Wales';
  if (/Northern Ireland/.test(display)) return 'Northern Ireland';
  return 'England';
}
function hostFromCity(city) {
  const entry = cityCache[city];
  if (!entry?.display) return null;
  const parts = entry.display.split(',').map((s) => s.trim());
  const last = parts[parts.length - 1];
  if (last === 'United Kingdom') return ukNation(entry.display);
  return NOMINATIM_TO_LABEL[last] ?? last;
}

function categorize(comp) {
  const c = (comp || '').toLowerCase();
  if (c.includes('friendly')) return 'Amical';
  if (c.includes('nations league')) return 'Ligue des Nations';
  if (c.includes('world cup') && !c.includes('qualif') && !c.includes('wc qualif')) return 'Coupe du monde';
  if (c.includes('european championship')) return "Championnat d'Europe";
  if (c.includes('olympic')) return 'Jeux olympiques';
  if (c.includes('qualif') || c.includes('preliminary') || c.includes('play-off')) return 'Qualifications';
  if (c.includes('confeder')) return 'Coupe des Confédérations';
  if (c.includes('intercontinental')) return 'Coupe intercontinentale';
  return 'Amical';
}

const isGoal = (k) => /goal|penalty/i.test(k || '');
function extractGoals(d) {
  const goals = [];
  for (const ev of d.events ?? []) {
    for (const side of ['home', 'away']) {
      for (const p of ev[side] ?? []) {
        if (isGoal(p.kind))
          goals.push({ side, minute: p.minute, kind: p.kind, firstName: p.firstName, lastName: p.lastName });
      }
    }
  }
  goals.sort((a, b) => a.minute - b.minute);
  return goals;
}

// ---- Auvio links (Red Devils only), keyed by date -------------------------
function loadAuvio() {
  const path = resolve(DATA, 'Auvio.csv');
  if (!existsSync(path)) return {};
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const [dd, mm, yy] = (r[0] || '').trim().split('/');
    if (!dd || !mm || !yy) continue;
    const iso = `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    const entry = {};
    if ((r[8] || '').trim().startsWith('http')) entry.article = r[8].trim();
    if ((r[10] || '').trim().startsWith('http')) entry.video = r[10].trim();
    if (entry.article || entry.video) out[iso] = entry;
  }
  return out;
}
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// ---- records (mirrors process_data.mjs) -----------------------------------
function buildMeta(matches) {
  const wins = matches.filter((m) => m.result === 'W').length;
  const draws = matches.filter((m) => m.result === 'D').length;
  const losses = matches.filter((m) => m.result === 'L').length;
  const belGoals = (m) => {
    const [h, a] = m.score.split('-').map(Number);
    const isHome = m.home === 'Belgium';
    return { gf: isHome ? h : a, ga: isHome ? a : h };
  };
  const enriched = matches.map((m) => ({ ...m, ...belGoals(m) }));
  const longestStreak = (pred) => {
    let best = { length: 0, from: null, to: null, ids: [] }, cur = [];
    for (const m of enriched) {
      if (pred(m)) { cur.push(m); if (cur.length > best.length) best = { length: cur.length, from: cur[0], to: m, ids: cur.map((x) => x.id) }; }
      else cur = [];
    }
    return best;
  };
  const extreme = (filterFn, scoreFn) => {
    let best = null;
    for (const m of enriched) { if (!filterFn(m)) continue; if (!best || scoreFn(m) >= scoreFn(best)) best = m; }
    return best;
  };
  const slim = (m) => m && { date: m.date, score: m.score, opponent: m.opponent, home: m.home, away: m.away };
  const streakOut = (s) => ({ length: s.length, from: slim(s.from), to: slim(s.to), ids: s.ids });
  const biggestWin = extreme((m) => m.result === 'W', (m) => m.gf - m.ga);
  const heaviestDefeat = extreme((m) => m.result === 'L', (m) => m.ga - m.gf);
  const records = {
    biggestWin: { match: slim(biggestWin), ids: biggestWin ? [biggestWin.id] : [] },
    heaviestDefeat: { match: slim(heaviestDefeat), ids: heaviestDefeat ? [heaviestDefeat.id] : [] },
    mostConsecutiveWins: streakOut(longestStreak((m) => m.result === 'W')),
    mostConsecutiveNoDefeat: streakOut(longestStreak((m) => m.result !== 'L')),
    mostConsecutiveDraws: streakOut(longestStreak((m) => m.result === 'D')),
    mostConsecutiveNoDraw: streakOut(longestStreak((m) => m.result !== 'D')),
    mostConsecutiveNoWin: streakOut(longestStreak((m) => m.result !== 'W')),
    mostConsecutiveDefeats: streakOut(longestStreak((m) => m.result === 'L')),
    mostConsecutiveScoring: streakOut(longestStreak((m) => m.gf > 0)),
    mostConsecutiveNoScoring: streakOut(longestStreak((m) => m.gf === 0)),
    mostConsecutiveConceding: streakOut(longestStreak((m) => m.ga > 0)),
    mostConsecutiveCleanSheets: streakOut(longestStreak((m) => m.ga === 0))
  };
  return {
    total: matches.length,
    firstYear: matches[0].year,
    lastYear: matches[matches.length - 1].year,
    wins, draws, losses, records
  };
}

// Build a match record from a list entry + its detail (mirrors buildCsv + process_data).
function buildMatch(listEntry, d, auvioByDate) {
  const h = listEntry.homeTeam, a = listEntry.awayTeam;
  const date = (listEntry.startDateTime || '').split('T')[0];
  const hg = h.goalsScored, ag = a.goalsScored;
  const isBelHome = /belgi/i.test(h.name), isBelAway = /belgi/i.test(a.name);
  const venue = isBelHome ? 'home' : isBelAway ? 'away' : 'neutral';
  const opponent = isBelHome ? a.name : isBelAway ? h.name : `${h.name} vs ${a.name}`;
  const score = `${hg}-${ag}`;
  const belG = isBelHome ? hg : ag, oppG = isBelHome ? ag : hg;
  let result = belG > oppG ? 'W' : belG < oppG ? 'L' : 'D';
  // a drawn match decided on penalties counts as a win/loss (symmetric with the
  // original viz's W(pen) handling), so the colour reflects the shootout outcome
  if (belG === oppG && h.penaltiesScored != null && a.penaltiesScored != null) {
    const belP = isBelHome ? h.penaltiesScored : a.penaltiesScored;
    const oppP = isBelHome ? a.penaltiesScored : h.penaltiesScored;
    if (belP > oppP) result = 'W';
    else if (belP < oppP) result = 'L';
  }
  const rawStadium = d.location?.name || '';
  const city = d.location?.city || '';
  const hostCountry =
    hostFromCity(city) || (venue === 'home' ? h.name : h.name === 'Belgium' ? a.name : h.name);
  let coords = null, approx = false;
  if (city && cityCache[city]) coords = [cityCache[city].lon, cityCache[city].lat];
  else if (countryCache[hostCountry]) { coords = [countryCache[hostCountry].lon, countryCache[hostCountry].lat]; approx = true; }
  const auvio = auvioByDate[date];
  return {
    id: listEntry.id,
    date,
    year: +date.slice(0, 4),
    competition: listEntry.eventTitle,
    category: categorize(listEntry.eventTitle),
    home: h.name,
    away: a.name,
    score,
    opponent,
    venue,
    hostCountry,
    result,
    stadium: stadiumFr(rawStadium),
    coach: belgiumCoach(d),
    city,
    coords,
    approx,
    hasDetail: true,
    ...(auvio?.article ? { article: auvio.article } : {}),
    ...(auvio?.video ? { video: auvio.video } : {})
  };
}

function buildDetailEntry(d) {
  const ref = (d.officials ?? []).find((o) => o.function === 'referee');
  return {
    homeLogo: d.homeTeam?.logo ?? '',
    awayLogo: d.awayTeam?.logo ?? '',
    goals: extractGoals(d),
    referee: ref ? `${ref.firstName} ${ref.lastName}`.trim() : '',
    city: d.location?.city ?? '',
    stadium: d.location?.name ?? ''
  };
}

// ---- per-team incremental update ------------------------------------------
async function updateTeam(team, auvioByDate) {
  const matchesPath = resolve(OUT, team.matches);
  const detailsPath = resolve(OUT, team.details);
  const bundle = JSON.parse(readFileSync(matchesPath, 'utf8'));
  const details = JSON.parse(readFileSync(detailsPath, 'utf8'));
  const known = new Set(bundle.matches.map((m) => m.id));

  const list = await fetchList(team.categoryId);
  // candidates: played (both scores set) + past/today + not already in our data
  const candidates = list.filter(
    (m) =>
      m.homeTeam.goalsScored != null &&
      m.awayTeam.goalsScored != null &&
      (m.startDateTime || '').slice(0, 10) <= TODAY &&
      !known.has(m.id)
  );
  console.log(`[${team.key}] API list ${list.length}, new played matches: ${candidates.length}`);
  if (!candidates.length) return false;

  let added = 0;
  for (const entry of candidates) {
    const d = (await gql(DETAIL_QUERY, { matchId: entry.id, language: 'en' })).internationalMatchDetail;
    await sleep(150);
    if (!d || !d.outcome?.isFinished) { console.log(`  skip (not finished): ${entry.id}`); continue; }
    const city = d.location?.city || '';
    const hostHint = /belgi/i.test(entry.homeTeam.name) ? entry.awayTeam.name : entry.homeTeam.name;
    await ensureCity(city, hostHint);
    const match = buildMatch(entry, d, auvioByDate);
    bundle.matches.push(match);
    details[match.id] = buildDetailEntry(d);
    added++;
    console.log(`  + ${match.date} ${match.home} ${match.score} ${match.away}`);
  }
  if (!added) return false;

  bundle.matches.sort((a, b) => a.date.localeCompare(b.date));
  bundle.meta = buildMeta(bundle.matches);
  writeFileSync(matchesPath, JSON.stringify(bundle));
  writeFileSync(detailsPath, JSON.stringify(details));
  return true;
}

// ---- run ------------------------------------------------------------------
const auvioByDate = loadAuvio();
let changed = false;
for (const team of TEAMS) {
  try {
    if (await updateTeam(team, team.auvio ? auvioByDate : {})) changed = true;
  } catch (e) {
    console.error(`[${team.key}] FAILED: ${e.message}`);
    process.exitCode = 1;
  }
}
if (cityCacheDirty) {
  writeFileSync(resolve(DATA, 'geocode_cache.json'), JSON.stringify(cityCache, null, 2));
  console.log('Updated geocode cache with new cities.');
}
console.log(changed ? 'DATA_CHANGED=1' : 'DATA_CHANGED=0');
