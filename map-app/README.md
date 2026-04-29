# 🚌 Tirana Transit Map

An interactive web application for visualizing public bus routes in Tirana, Albania. Built with React, MapLibre GL, and GTFS data from the Municipality of Tirana.

![Tirana Transit](https://img.shields.io/badge/Tirana-Transit-blue)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)
![MapLibre](https://img.shields.io/badge/MapLibre-GL-396)

## Features

- **Interactive Map**: Pan and zoom through Tirana with smooth MapLibre GL rendering
- **Route Visualization**: All 27 bus routes with distinct colors and proper offsetting for overlapping corridors
- **Bus Stops**: Toggle stop display with custom icons showing which routes serve each stop
- **Timetables**: View detailed schedules for each route by direction and day type
- **Shareable Links**: URL hash stores selected routes and display settings
- **Responsive Design**: Works on desktop and mobile devices
- **Debug Mode**: Visual comparison between original GTFS paths and offset routes

## Data Coverage

| Metric | Value |
|--------|-------|
| Routes | 27 (1A-B, 2, 3A-C, 4, 5A-B, 6, 8A-C, 9A-B, 10A-C, 11, 12A-B, 13A-B, 15A-B, 16A-B) |
| Stops | 491 |
| Trips | 16,642 |
| Service Period | January 2026 – December 2026 |
| Data Source | [pt.tirana.al/gtfs/gtfs.zip](https://pt.tirana.al/gtfs/gtfs.zip) (Bashkia Tiranë, feed v0.2.0) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tirana-transit/map-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## Architecture

```
map-app/
├── src/
│   ├── components/
│   │   ├── TransitMap.jsx      # Main map component with MapLibre
│   │   ├── RouteSidebar.jsx    # Route selection
│   │   ├── TimetableModal.jsx  # Schedule display modal
│   │   └── ErrorBoundary.jsx   # Error handling
│   ├── App.jsx                 # Main app state management
│   ├── App.css                 # Component styles
│   └── main.jsx                # Entry point
├── public/
│   └── data/                   # Generated GeoJSON files
│       ├── routes.geojson
│       ├── stops.geojson
│       └── route_metadata.json
└── package.json
```

## Data Pipeline

The GTFS data processing happens in the `gtfs-data/` directory:

```bash
cd ../gtfs-data
source venv/bin/activate
python3 convert_to_geojson.py
```

This script:
1. Parses GTFS files (routes, stops, trips, shapes, schedules)
2. Detects corridor groups for routes that share roads
3. Calculates geographic offsets to prevent overlapping lines
4. Generates GeoJSON files for the web app

## Route Colors

Routes use a curated color palette for visual distinction:

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

The app supports URL hash parameters for sharing specific views:

```
#routes=1A,2,3A    # Comma-separated route names to show
#stops=1           # Show bus stops
#debug=1           # Show debug lines
```

Example: `http://localhost:5173/#routes=1A,3A,5A&stops=1`

## Troubleshooting

### Map doesn't load
- Check browser console for CORS errors
- Verify `public/data/` contains the GeoJSON files
- Ensure you're running via the dev server (`npm run dev`)

### Data is outdated
- Run the data pipeline: `cd ../gtfs-data && python3 convert_to_geojson.py`
- Refresh the browser

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

Transit data: © Municipality of Tirana, CC-BY-SA-4.0

Code: MIT License

## Acknowledgments

- Municipality of Tirana for providing GTFS data
- MapLibre GL for the excellent mapping library
- CartoDB for the Positron base map style
