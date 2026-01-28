# 🚌 Tirana Transportation

A comprehensive transit visualization project for Tirana, Albania. This repository contains both the GTFS data processing pipeline and the interactive web map application.

## 📁 Project Structure

```
tirana-transportation/
├── tirana-gtfs/          # GTFS data processing (Python)
│   ├── convert_to_geojson.py
│   ├── *.txt             # GTFS source files
│   └── venv/             # Python virtual environment
└── tirana-transit/       # Web application (React + Vite)
    ├── src/              # React components
    ├── public/data/      # Generated GeoJSON files
    └── package.json
```

## 🏃 Quick Start

### 1. Start the Web App

```bash
cd tirana-transit
npm install
npm run dev
```

### 2. (Optional) Regenerate Data

If you have updated GTFS files:

```bash
cd tirana-gtfs
python3 -m venv venv
source venv/bin/activate
pip install shapely pyproj
python3 convert_to_geojson.py
```

## 📊 Data Overview

- **26 bus routes** covering Tirana metropolitan area
- **467 bus stops** with precise GPS coordinates
- **16,777 trips** with full schedule information
- **Service period**: January 2026 - December 2026

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| Data Processing | Python, Shapely, PyProj |
| Frontend | React 19, Vite 7 |
| Mapping | MapLibre GL |
| Styling | CSS3 |

## 📚 Documentation

- [Web App README](./tirana-transit/README.md)
- [Data Pipeline](./tirana-gtfs/convert_to_geojson.py) (inline documentation)

## 📄 License

- **Transit Data**: © Municipality of Tirana, CC-BY-SA-4.0
- **Code**: MIT License

## 🤝 Contributing

Contributions welcome! Please ensure:
1. Code follows existing style patterns
2. Components are memoized for performance
3. Error boundaries are used for error handling
4. Changes are tested on both desktop and mobile
