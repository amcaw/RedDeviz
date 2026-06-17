# scripts/ — automated data refresh

`auto-update.mjs` is a **self-contained, incremental** data updater run daily by the
[`refresh-data.yml`](../.github/workflows/refresh-data.yml) GitHub Action.

Unlike the full pipeline in `../../data-pipeline/` (which rebuilds everything from
~17 MB of per-match detail files), this script needs nothing heavy on disk:

1. reads the existing bundles in `src/data/` (`matches.json`, `matches.flames.json`,
   `details.json`, `details.flames.json`);
2. asks the RBFA API for each team's match list;
3. fetches **only** the details of newly-played matches not already in the bundles;
4. geocodes any genuinely new city via Nominatim (capital fallback otherwise);
5. patches the bundles in place (re-sorts, recomputes meta + records).

It prints `DATA_CHANGED=0/1`; the workflow commits + redeploys only when something
changed. New matches inherit Auvio links by date if present in `data/Auvio.csv`.

## `data/`

Small committed inputs the script needs (the full pipeline keeps the masters):

- `geocode_cache.json` — city → coordinates (the script appends new cities here)
- `country_coords.json` — capital fallback per country
- `stadium_fr.json` — French stadium names
- `Auvio.csv` — RTBF article/video links (Red Devils only; manual export)

## Keep in sync

The match-record / detail / records logic mirrors `data-pipeline/`'s
`fetch_red_devils.cjs`, `process_data.mjs` and `build_details.mjs`. If that logic
changes (e.g. categorisation, result handling), update this script too. A no-op run
(no new matches) must leave `src/data/` byte-identical to a full-pipeline rebuild —
that equivalence is the correctness check.

## Caveat

Runs from GitHub's cloud IPs. The RBFA API (Akamai) and Nominatim can rate-limit or
block datacenter IPs; the script retries with backoff and degrades gracefully (new
matches fall back to the capital with an `approx` flag if geocoding is refused).
