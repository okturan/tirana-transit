# Tirana Transit

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
| Application | Working local showcase; no public deployment is currently configured or verified |
| Data snapshot | Municipality of Tirana feed `0.2.0`, covering 2026-01-01 through 2026-12-31 |
| Bundled coverage | 27 routes, 491 stops, and 16,642 scheduled trips |
| Scope | Static schedule visualization; not live vehicle tracking or a journey planner |

The counts above describe the bundled snapshot, not necessarily the municipality's current live network. The source snapshot is available from [pt.tirana.al](https://pt.tirana.al/gtfs/gtfs.zip).

## Quick start

Vite 7 requires Node.js 20.19+ or 22.12+.

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
python -m pip install shapely pyproj
python convert_to_geojson.py
```

The converter reads the bundled GTFS tables and writes generated files to `map-app/public/data/`. Set `OUTPUT_DIR` to validate a conversion without replacing the tracked snapshot.

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
npm run lint
npm run build

cd ../gtfs-data
OUTPUT_DIR=/tmp/tirana-transit-output python3 convert_to_geojson.py
```

## Licensing and provenance

Repository history identifies the application and conversion pipeline as owner-authored. The original software and documentation are licensed under the [MIT License](./LICENSE).

That software license does **not** relicense the transit feed or its derivatives. The bundled `gtfs-data/feed_info.txt` declares the municipality feed as `CC-BY-SA-4.0` and requires this attribution:

> Schedule data created and provided by Municipality of Tirana, Directorate of Transportation and Road Traffic

The GTFS files under `gtfs-data/` and generated transit data under `map-app/public/data/` remain subject to those data terms. Third-party libraries and assets remain under their respective licenses.
