import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/hockey.json');

const BASE = 'https://tms.fih.ch';
const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } };

const COMPS = [
  { gender: 'M', id: 1866 },
  { gender: 'W', id: 1867 }
];

const decode = (s) =>
  s
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

const strip = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function fetchText(path) {
  const res = await fetch(path.startsWith('http') ? path : BASE + path, UA);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.text();
}

function parsePools(html) {
  const letters = {};
  for (const m of html.matchAll(/data-toggle="tab"\s+href="#pool(\d+)"\s*>\s*([A-H])\s*</g)) {
    letters[m[1]] = m[2];
  }

  const panes = [];
  const re = /id="pool(\d+)"\s*>/g;
  let m;
  const marks = [];
  while ((m = re.exec(html))) marks.push({ id: m[1], start: m.index });
  for (let i = 0; i < marks.length; i++) {
    const seg = html.slice(marks[i].start, marks[i + 1]?.start ?? html.length);
    panes.push({ id: marks[i].id, letter: letters[marks[i].id] ?? '?', html: seg });
  }

  const pools = {};
  for (const pane of panes) {
    const rows = [];
    for (const tr of pane.html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const body = tr[1];
      if (/<th/.test(body)) continue;
      const cells = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
      if (cells.length < 8) continue;
      const teamCell = cells[1];
      const teamId = Number(teamCell.match(/teams\/(\d+)/)?.[1]) || null;
      const code = teamCell.match(/flags\/[^"']*\/([A-Za-z]{2,3})\.[a-z]+/)?.[1]?.toUpperCase() ?? null;
      const name = strip(teamCell);
      const num = (i) => Number(strip(cells[i]).match(/-?\d+/)?.[0] ?? 0);
      rows.push({
        teamId,
        code,
        name,
        rank: num(0),
        gp: num(2),
        w: num(3),
        d: num(4),
        l: num(5),
        gd: num(6),
        pts: num(7)
      });
    }
    if (rows.length) pools[pane.letter] = { letter: pane.letter, poolId: Number(pane.id), teams: rows };
  }
  return pools;
}

function parseMatches(html) {
  const out = [];
  const phaseById = new Map();
  for (const m of html.matchAll(/matches\/(\d+)">[^<]*\(([A-H]|SF|\d+\/\d+)\)<\/a>/g)) {
    phaseById.set(Number(m[1]), m[2]);
  }
  const panels = html.split(/<div class="panel panel-default[^>]*>/).slice(1);
  for (const panel of panels) {
    const anchor = panel.match(/<a href="[^"]*matches\/(\d+)"><b>([\s\S]*?)<\/a>/);
    if (!anchor) continue;
    const id = Number(anchor[1]);
    const matchup = strip(anchor[2]);
    const codes = [...panel.matchAll(/flags\/round\/([A-Z0-9]{2,3})\.png/g)].map((m) => m[1]);
    const labels = matchup.split(/\s+-\s+/);
    const score = panel.match(/<b>\s*(\d{1,2})\s*-\s*(\d{1,2})\s*<\/b>/);
    const so = panel.match(/\(\s*(\d)\s*-\s*(\d)\s*(?:SO|s\.?o\.?)\s*\)/i);
    const phase = panel.match(/<BR>\s*([A-H]|SF|\d+\/\d+)\s*<BR>/)?.[1] ?? phaseById.get(id) ?? null;
    const utc = panel.match(/UTC:\s*([\d-]+\s[\d:]+)/)?.[1] ?? null;
    out.push({
      id,
      home: codes[0] ?? '',
      away: codes[1] ?? '',
      ...(codes.length < 2 ? { homeLabel: labels[0] ?? '', awayLabel: labels[1] ?? '' } : {}),
      hg: score ? Number(score[1]) : null,
      ag: score ? Number(score[2]) : null,
      so: so ? [Number(so[1]), Number(so[2])] : null,
      played: !!score,
      utc,
      phase
    });
  }
  return out;
}

function parseEventTable(html, paneId) {
  const i = html.indexOf(`id="${paneId}"`);
  if (i < 0) return [];
  const tail = html.slice(i + paneId.length + 5);
  const end = tail.search(/<div class="tab-pane[^>]*id="/i);
  const pane = tail.slice(0, end < 0 ? 12000 : end);
  const rows = [];
  for (const tr of pane.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const b = tr[1];
    if (/<th[\s>]/i.test(b) || /colspan/i.test(b)) continue;
    const tds = [...b.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => strip(c[1]));
    if (tds.length < 5) continue;
    rows.push({ b, tds });
  }
  return rows;
}

async function fetchStats(id) {
  try {
    const data = JSON.parse(await fetchText(`/rt/matches/${id}?embeds=hometeam%2Cawayteam%2Cstatistics`));
    const s = data.statistics;
    if (!s?.goal) return null;
    const pair = (key) => [Number(key?.home?.match?.all ?? 0), Number(key?.away?.match?.all ?? 0)];
    const quarters = ['P1', 'P2', 'P3', 'P4'].map((q) => [Number(s.goal.home?.[q]?.all ?? 0), Number(s.goal.away?.[q]?.all ?? 0)]);
    const out = { quarters };
    const shots = pair(s.shot);
    if (shots[0] >= data.homescore && shots[1] >= data.awayscore && shots[0] + shots[1] > 0) out.shots = shots;
    const circleEntries = pair(s.circle);
    if (circleEntries[0] + circleEntries[1] > 0) out.circleEntries = circleEntries;
    const penaltyCorners = pair(s.pc);
    const pcGoals = [Number(s.goal.home?.match?.PC ?? 0), Number(s.goal.away?.match?.PC ?? 0)];
    if (penaltyCorners[0] >= pcGoals[0] && penaltyCorners[1] >= pcGoals[1] && penaltyCorners[0] + penaltyCorners[1] > 0) out.penaltyCorners = penaltyCorners;
    const possession = [Number(s.poss?.percentage?.home?.match ?? 0), Number(s.poss?.percentage?.away?.match ?? 0)];
    if (possession[0] + possession[1] >= 99 && possession[0] + possession[1] <= 101) out.possession = possession;
    return out;
  } catch {
    return null;
  }
}

async function fetchDetail(id) {
  let html;
  try {
    html = await fetchText(`/matches/${id}`);
  } catch {
    return null;
  }
  const field = (k) => html.match(new RegExp(`&quot;${k}&quot;:&quot;([^&]*)&quot;`))?.[1] ?? null;
  const venue = field('venue');
  const date = field('date');
  const time = (field('time') ?? '').slice(0, 5);
  const status = field('status');

  const scorers = parseEventTable(html, 'goals').map(({ b, tds }) => ({
    team: b.match(/country_\w+">([^<]+)</i)?.[1] ?? tds[0],
    minute: Number(tds[1]?.match(/\d+/)?.[0] ?? 0),
    player: tds[3],
    type: b.match(/goal_(\w+)/i)?.[1] ?? null,
    action: tds[4],
    score: tds[5] ?? null
  }));

  const cards = parseEventTable(html, 'cards').map(({ b, tds }) => ({
    team: b.match(/country_\w+">([^<]+)</i)?.[1] ?? tds[0],
    minute: Number(tds[1]?.match(/\d+/)?.[0] ?? 0),
    player: tds[3],
    card: b.match(/card_(\w+)/i)?.[1] ?? tds[4]
  }));

  const stats = await fetchStats(id);
  return { venue, date, time, status, scorers, cards, stats };
}

async function fetchComp(comp) {
  const main = await fetchText(`/competitions/${comp.id}`);
  const matchesHtml = await fetchText(`/competitions/${comp.id}/matches`);
  const pools = parsePools(main);
  const matches = parseMatches(matchesHtml);
  const teams = {};
  for (const pl of Object.values(pools)) {
    for (const t of pl.teams) {
      if (t.code && !teams[t.code]) teams[t.code] = { code: t.code, name: t.name, teamId: t.teamId };
    }
  }

  for (const mt of matches) {
    if (!mt.played) continue;
    const det = await fetchDetail(mt.id);
    if (!det) continue;
    mt.venue = det.venue;
    mt.status = det.status;
    if (!mt.utc && det.date) mt.utc = `${det.date} ${det.time}:00`;
    mt.scorers = det.scorers;
    mt.cards = det.cards;
    if (det.stats) mt.stats = det.stats;
  }

  return {
    gender: comp.gender,
    competitionId: comp.id,
    pools,
    matches,
    teams
  };
}

const data = { updated: new Date().toISOString(), men: null, women: null };
for (const comp of COMPS) {
  try {
    const res = await fetchComp(comp);
    data[comp.gender === 'M' ? 'men' : 'women'] = res;
    const played = res.matches.filter((m) => m.played).length;
    console.log(`${comp.gender} (comp ${comp.id}): ${Object.keys(res.pools).length} poules, ${res.matches.length} matchs (${played} joués), ${Object.keys(res.teams).length} équipes`);
  } catch (e) {
    console.warn(`${comp.gender} (comp ${comp.id}): ${e.message}`);
  }
}

writeFileSync(OUT, JSON.stringify(data));
console.log(`écrit -> ${OUT}`);
