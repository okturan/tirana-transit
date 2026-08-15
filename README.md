# Tirana Transit

[![CI](https://github.com/okturan/tirana-transit/actions/workflows/ci.yml/badge.svg)](https://github.com/okturan/tirana-transit/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/okturan/tirana-transit/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/okturan/tirana-transit/actions/workflows/deploy-pages.yml)

An interactive map of Tirana's public bus network backed by a reproducible GTFS-to-GeoJSON pipeline. The project converts a municipality feed into browser-ready routes, stops, and timetables, then renders route selection, corridor offsets, stop service, and schedules with React and MapLibre.

![Tirana Transit map showing color-coded bus routes](./map-app/public/screenshot.png)

## What it demonstrates

- Converts static GTFS tables into GeoJSON and compact route metadata with Python.
- Detects shared corridors and offsets overlapping route geometry for a readable network map.
- Shows the routes serving each stop and timetables by direction and day type.
- Persists selected routes and display settings in the URL hash for shareable views.
- Keeps the data pipeline and the React map independently runnable.

## Project status

| | Current state |
|---|---|
| Application | GitHub Pages workflow configured for [okturan.github.io/tirana-transit](https://okturan.github.io/tirana-transit/); deployments come from `main` |
| Data snapshot | Municipality of Tirana feed `2026-08-12`, covering 2026-01-01 through 2026-12-31 |
| Bundled coverage | 27 routes, 490 stops, and 10,623 scheduled trips |
| Scope | Static schedule visualization; not live vehicle tracking or a journey planner |

The counts above describe the bundled snapshot, not necessarily the municipality's current live network. The source snapshot is available from [pt.tirana.al](https://pt.tirana.al/gtfs/gtfs.zip).
Its retrieval time, archive hash, license, attribution, and source-table counts are recorded in [`gtfs-data/snapshot-manifest.json`](./gtfs-data/snapshot-manifest.json) and verified in CI.

## Quick start

The application requires Node.js 22.13 or newer.

```bash
cd map-app
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Regenerate the map data

```bash
cd gtfs-data
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --requirement requirements.txt
python convert_to_geojson.py
```

The converter uses Python 3.13 and a pinned geometry stack, reads the bundled GTFS tables, and writes generated files to `map-app/public/data/`. Its vertex-preserving offset algorithm retains every route segment and normalizes output for stable cross-platform snapshots. Set `OUTPUT_DIR` to validate a conversion without replacing the tracked snapshot.

### Check the municipality feed

The monthly [`Check GTFS feed`](./.github/workflows/check-gtfs-feed.yml) workflow downloads the declared municipality source, compares it with the bundled archive, and publishes versions, coverage dates, record-count deltas, changed filenames, and archive hashes in the run summary and a retained report artifact. It is deliberately read-only: a detected update still requires human review, attribution preservation, local regeneration, and green CI before tracked data changes.

Run the same comparison locally:

```bash
curl --fail --location --output /tmp/tirana-gtfs.zip \
  https://pt.tirana.al/gtfs/gtfs.zip
python gtfs-data/check_feed_update.py \
  --baseline gtfs-data/gtfs.zip \
  --candidate /tmp/tirana-gtfs.zip \
  --source-url https://pt.tirana.al/gtfs/gtfs.zip \
  --json /tmp/tirana-gtfs-report.json \
  --markdown /tmp/tirana-gtfs-report.md
```

## Architecture

| Path | Responsibility |
|---|---|
| `gtfs-data/convert_to_geojson.py` | GTFS parsing, corridor detection, geometry offsets, and output generation |
| `gtfs-data/*.txt` | Municipality GTFS snapshot and its embedded feed metadata |
| `map-app/public/data/` | Generated GeoJSON and route/timetable metadata |
| `map-app/src/` | React UI, MapLibre map, route controls, and timetable views |

See the [web app documentation](./map-app/README.md) for feature and URL-state details.

## Verification

```bash
cd map-app
npm ci
npm test
npm run lint
npm run build

cd ../gtfs-data
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --requirement requirements.txt
python convert_to_geojson.py
git diff --exit-code -- ../map-app/public/data
```

Dependency maintenance is intentionally low-noise. Weekly compatible npm updates are grouped together, while coupled Vite and ESLint majors are grouped with their matching plugins so Dependabot does not propose peer-incompatible half-upgrades. CI verifies the browser application on the minimum supported Node 22 line and current Node 24, then independently regenerates and validates the transit geometry on Python 3.13.

## Licensing and provenance

Repository history identifies the application and conversion pipeline as owner-authored. The original software and documentation are licensed under the [MIT License](./LICENSE).

That software license does **not** relicense the transit feed or its derivatives. The bundled `gtfs-data/feed_info.txt` declares the municipality feed as `CC-BY-SA-4.0` and requires this attribution:

> Schedule data created and provided by Municipality of Tirana, Directorate of Transportation and Road Traffic

The GTFS files under `gtfs-data/` and generated transit data under `map-app/public/data/` remain subject to those data terms. Third-party libraries and assets remain under their respective licenses.
