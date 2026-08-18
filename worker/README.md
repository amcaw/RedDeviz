# Hockey live-score proxy (Cloudflare Worker)

Tiny CORS proxy in front of the FIH real-time match feed (`tms.fih.ch/rt/matches/{id}`),
which has live scores but no `Access-Control-Allow-Origin` header, so the browser can't
call it directly. This Worker fetches it server-side and re-serves it with CORS — only to
the origins in the `ALLOWED` allowlist. **No secrets, no API keys.**

## Deploy (dashboard, no CLI, nothing stored locally)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**.
2. Name it (e.g. `reddeviz-hockey`). Its URL becomes `https://reddeviz-hockey.<your-subdomain>.workers.dev`.
3. **Edit code** → paste the contents of `hockey-live.js` → **Deploy**.

## Deploy (wrangler CLI, alternative)

```
npm i -g wrangler
wrangler login          # one-time Cloudflare auth, stays on your machine
wrangler deploy worker/hockey-live.js --name reddeviz-hockey --compatibility-date 2024-01-01
```

## Wire it into the site

Set `LIVE_WORKER` in `src/routes/hockey2026/+page.svelte` to the deployed Worker URL
(e.g. `https://reddeviz-hockey.<your-subdomain>.workers.dev`). Empty string = live polling off
(the page falls back to the static `hockey.json`).

If your `*.workers.dev` subdomain differs from the origins already listed, add your GitHub
Pages origin to `ALLOWED` and redeploy. For local dev, the common Vite ports are already listed.

## What it returns

`GET /?ids=22342,22343` → `[{ id, status, hg, ag, hps, aps, period }, …]`
(home/away score, penalty-shootout score, live period). At most 12 ids per call; 8-second
edge cache to keep load on the FIH feed low.
