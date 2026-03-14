# 🚌 Tirana Transit Map

An interactive web application for visualizing public bus routes in Tirana, Albania. Built with React, MapLibre GL, and GTFS data from the Municipality of Tirana.

![Tirana Transit](https://img.shields.io/badge/Tirana-Transit-blue)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)
![MapLibre](https://img.shields.io/badge/MapLibre-GL-396)

## ✨ Features

- **Interactive Map**: Pan and zoom through Tirana with smooth MapLibre GL rendering
- **Route Visualization**: All 26 bus routes with distinct colors and proper offsetting for overlapping corridors
- **Route Filtering**: Search and filter routes by number or name
- **Bus Stops**: Toggle stop display with custom icons showing which routes serve each stop
- **Timetables**: View detailed schedules for each route by direction and day type
- **Shareable Links**: URL hash stores selected routes and display settings
- **Responsive Design**: Works on desktop and mobile devices
- **Debug Mode**: Visual comparison between original GTFS paths and offset routes

## 🗺️ Data Coverage

| Metric | Value |
|--------|-------|
| Routes | 26 (1A, 1B, 2, 3A-C, 4, 5A-B, 6, 8A-C, 9A-B, 10A-C, 11, 12, 13A-B, 15A-B, 16A-B) |
| Stops | 467 |
| Trips | 16,777 |
| Service Period | January 2026 - December 2026 |
| Data Source | Bashkia Tiranë (Municipality of Tirana) |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tirana-transportation/tirana-transit

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

## 🏗️ Architecture

```
tirana-transit/
├── src/
│   ├── components/
│   │   ├── TransitMap.jsx      # Main map component with MapLibre
│   │   ├── RouteSidebar.jsx    # Route selection, search, filters
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

## 🔄 Data Pipeline

The GTFS data processing happens in the `tirana-gtfs/` directory:

```bash
cd ../tirana-gtfs
source venv/bin/activate
python3 convert_to_geojson.py
```

This script:
1. Parses GTFS files (routes, stops, trips, shapes, schedules)
2. Detects corridor groups for routes that share roads
3. Calculates geographic offsets to prevent overlapping lines
4. Generates GeoJSON files for the web app

## 🎨 Route Colors

Routes use a carefully selected color palette for visual distinction:

| Route | Color | Route | Color |
|-------|-------|-------|-------|
| 1A | 🔴 Red | 8A-C | 🟣 Purple |
| 1B | 🔴 Coral | 9A-B | 🫒 Lime |
| 2 | 🩷 Pink | 10A-C | 🟠 Orange |
| 3A-C | 🔵 Cyan | 11 | 🔵 Blue |
| 4 | 🟣 Maroon | 12 | 🩵 Teal |
| 5A-B | 🟢 Green | 13A-B | 🟣 Magenta |
| 6 | 🩷 Rose | 15A-B | 🟠 Deep Orange |
| | | 16A-B | 🟢 Light Green |

## 🔧 URL Parameters

The app supports URL hash parameters for sharing specific views:

```
#routes=1,2,3      # Comma-separated route IDs to show
#stops=1           # Show bus stops
#debug=1           # Show debug lines
```

Example: `http://localhost:5173/#routes=1A,3A,5A&stops=1`

## 📱 Keyboard Shortcuts

None currently implemented (future enhancement opportunity).

## 🐛 Troubleshooting

### Map doesn't load
- Check browser console for CORS errors
- Verify `public/data/` contains the GeoJSON files
- Ensure you're running via the dev server (`npm run dev`)

### Data is outdated
- Run the data pipeline: `cd ../tirana-gtfs && python3 convert_to_geojson.py`
- Refresh the browser

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## 📄 License

Transit data: © Municipality of Tirana, CC-BY-SA-4.0

Code: MIT License

## 🙏 Acknowledgments

- Municipality of Tirana for providing GTFS data
- MapLibre GL for the excellent mapping library
- CartoDB for the Positron base map style
