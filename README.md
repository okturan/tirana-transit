# 🚌 Tirana Transportation

A transit visualization project for Tirana, Albania. This repository contains both the GTFS data processing pipeline and the interactive web map application.

## Project Structure

```
tirana-transit/
├── gtfs-data/          # GTFS data processing (Python)
│   ├── convert_to_geojson.py
│   ├── *.txt           # GTFS source files
│   └── venv/           # Python virtual environment
└── map-app/            # Web application (React + Vite)
    ├── src/            # React components
    ├── public/data/    # Generated GeoJSON files
    └── package.json
```

## Quick Start

### 1. Start the Web App

```bash
cd map-app
npm install
npm run dev
```

### 2. (Optional) Regenerate Data

If you have updated GTFS files:

```bash
cd gtfs-data
python3 -m venv venv
source venv/bin/activate
pip install shapely pyproj
python3 convert_to_geojson.py
```

## Data Overview

- **27 bus routes** covering the Tirana metropolitan area
- **491 bus stops** with precise GPS coordinates
- **16,642 trips** with full schedule information
- **Service period**: January 2026 – December 2026
- **Source**: [pt.tirana.al/gtfs/gtfs.zip](https://pt.tirana.al/gtfs/gtfs.zip) (feed v0.2.0)

## Technology Stack

| Component | Technology |
|-----------|------------|
| Data Processing | Python, Shapely, PyProj |
| Frontend | React 19, Vite 7 |
| Mapping | MapLibre GL |
| Styling | CSS3 |

## Documentation

- [Web App README](./map-app/README.md)
- [Data Pipeline](./gtfs-data/convert_to_geojson.py) (inline documentation)

## License

- **Transit Data**: © Municipality of Tirana, CC-BY-SA-4.0
- **Code**: MIT License

## Contributing

Contributions welcome! Please ensure:
1. Code follows existing style patterns
2. Components are memoized for performance
3. Error boundaries are used for error handling
4. Changes are tested on both desktop and mobile
