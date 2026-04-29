# 🚌 Tirana Transit Map

Interactive map of public bus routes in Tirana, Albania. Built with React, MapLibre GL, and GTFS data from the Municipality of Tirana.

![Tirana Transit](https://img.shields.io/badge/Tirana-Transit-blue)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)
![MapLibre](https://img.shields.io/badge/MapLibre-GL-396)

## Features

- Pan and zoom over Tirana with MapLibre GL
- All 27 bus routes, with offsetting so overlapping corridors stay readable
- Bus stop markers showing which routes serve each stop
- Per-route timetables by direction and day type
- URL hash for shareable views (selected routes, display settings)
- Mobile-responsive layout
- Debug mode comparing original GTFS paths to offset routes

## Data Coverage

| Metric | Value |
|--------|-------|
| Routes | 27 (1A-B, 2, 3A-C, 4, 5A-B, 6, 8A-C, 9A-B, 10A-C, 11, 12A-B, 13A-B, 15A-B, 16A-B) |
| Stops | 491 |
| Trips | 16,642 |
| Service Period | January 2026 to December 2026 |
| Data Source | [pt.tirana.al/gtfs/gtfs.zip](https://pt.tirana.al/gtfs/gtfs.zip) (Bashkia Tiranë, feed v0.2.0) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Run

```bash
cd map-app
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

Output goes to `dist/`.

## Architecture

```
map-app/
├── src/
│   ├── components/
│   │   ├── TransitMap.jsx      # MapLibre map
│   │   ├── RouteSidebar.jsx    # Route selection
│   │   ├── TimetableModal.jsx  # Schedule modal
│   │   └── ErrorBoundary.jsx   # Error handling
│   ├── App.jsx                 # State management
│   ├── App.css                 # Styles
│   └── main.jsx                # Entry point
├── public/
│   └── data/                   # Generated GeoJSON
│       ├── routes.geojson
│       ├── stops.geojson
│       └── route_metadata.json
└── package.json
```

## Data Pipeline

GTFS processing happens in `gtfs-data/`:

```bash
cd ../gtfs-data
source venv/bin/activate
python3 convert_to_geojson.py
```

The script:
1. Parses GTFS files (routes, stops, trips, shapes, schedules)
2. Detects corridor groups for routes that share roads
3. Calculates geographic offsets to prevent overlapping lines
4. Generates GeoJSON files for the web app

## Route Colors

| Route | Color | Route | Color |
|-------|-------|-------|-------|
| 1A    | 🔴 Red          | 8A-C  | 🟣 Purple |
| 1B    | 🔴 Coral        | 9A-B  | 🫒 Lime |
| 2     | 🩷 Pink         | 10A-C | 🟠 Orange |
| 3A-C  | 🔵 Cyan         | 11    | 🔵 Blue |
| 4     | 🟣 Maroon       | 12A-B | 🩵 Teal |
| 5A-B  | 🟢 Green        | 13A-B | 🟣 Magenta |
| 6     | 🩷 Rose         | 15A-B | 🟠 Deep Orange |
|       |                 | 16A-B | 🟢 Light Green |

## URL Parameters

The app uses URL hash parameters for sharing views:

```
#routes=1A,2,3A    # Comma-separated route names
#stops=1           # Show bus stops
#debug=1           # Show debug lines
```

Example: `http://localhost:5173/#routes=1A,3A,5A&stops=1`

## Troubleshooting

Map doesn't load:
- Check browser console for CORS errors
- Verify `public/data/` contains the GeoJSON files
- Make sure you're running via the dev server (`npm run dev`)

Data is outdated:
- Run the data pipeline: `cd ../gtfs-data && python3 convert_to_geojson.py`
- Refresh the browser

## License

Transit data: © Municipality of Tirana, CC-BY-SA-4.0

Code: MIT License
