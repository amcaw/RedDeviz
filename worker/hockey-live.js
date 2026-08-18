const ALLOWED = new Set(['https://amcaw.github.io']);

const TMS = 'https://tms.fih.ch/rt/matches/';

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = isAllowedOrigin(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    }
    if (!allowed) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    const ids = (new URL(request.url).searchParams.get('ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{1,8}$/.test(s))
      .slice(0, 12);

    const out = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(TMS + id, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cf: { cacheTtl: 8, cacheEverything: true }
          });
          if (!r.ok) return null;
          const m = await r.json();
          return {
            id: m.id,
            status: m.status,
            hg: m.homescore ?? null,
            ag: m.awayscore ?? null,
            hps: m.homeps ?? null,
            aps: m.awayps ?? null,
            period: m.period_short || m.period || null
          };
        } catch {
          return null;
        }
      })
    );

    return new Response(JSON.stringify(out.filter(Boolean)), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors }
    });
  }
};
