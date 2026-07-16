import { useState, useEffect } from 'react'
import TransitMap from './components/TransitMap'
import RouteSidebar from './components/RouteSidebar'
import TimetableModal from './components/TimetableModal'
import ErrorBoundary from './components/ErrorBoundary'
import { filterKnownRouteIds, parseUrlState, serializeUrlState } from './urlState'
import './App.css'

function App() {
  const [initialUrlState] = useState(() => parseUrlState(window.location.hash))
  const [routes, setRoutes] = useState([])
  const [routesGeoJSON, setRoutesGeoJSON] = useState(null)
  const [stopsGeoJSON, setStopsGeoJSON] = useState(null)
  const [selectedRoutes, setSelectedRoutes] = useState(() => new Set(initialUrlState.routeIds || []))
  const [showStops, setShowStops] = useState(initialUrlState.showStops)
  const [showDebug, setShowDebug] = useState(initialUrlState.showDebug)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timetableRoute, setTimetableRoute] = useState(null)

  // Update URL when state changes
  useEffect(() => {
    if (routes.length === 0) return

    const hash = serializeUrlState({
      routeIds: Array.from(selectedRoutes),
      totalRoutes: routes.length,
      showStops,
      showDebug
    })
    window.location.hash = hash || ''
  }, [selectedRoutes, showStops, showDebug, routes.length])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [metadataRes, routesRes, stopsRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/route_metadata.json`),
          fetch(`${import.meta.env.BASE_URL}data/routes.geojson`),
          fetch(`${import.meta.env.BASE_URL}data/stops.geojson`)
        ])

        // Check for HTTP errors
        if (!metadataRes.ok) throw new Error(`Failed to load route metadata: ${metadataRes.status}`)
        if (!routesRes.ok) throw new Error(`Failed to load routes: ${routesRes.status}`)
        if (!stopsRes.ok) throw new Error(`Failed to load stops: ${stopsRes.status}`)

        // Parse JSON with error handling
        let metadata, routesGeo, stopsGeo
        try {
          metadata = await metadataRes.json()
          routesGeo = await routesRes.json()
          stopsGeo = await stopsRes.json()
        } catch {
          throw new Error('Failed to parse data files. They may be corrupted.')
        }

        // Validate data structure
        if (!Array.isArray(metadata)) throw new Error('Invalid route metadata format')
        if (!routesGeo || !Array.isArray(routesGeo.features)) throw new Error('Invalid routes GeoJSON format')
        if (!stopsGeo || !Array.isArray(stopsGeo.features)) throw new Error('Invalid stops GeoJSON format')

        setRoutes(metadata)
        setRoutesGeoJSON(routesGeo)
        setStopsGeoJSON(stopsGeo)
        
        const urlRouteIds = filterKnownRouteIds(
          parseUrlState(window.location.hash).routeIds,
          metadata.map(route => route.route_id)
        )

        // Only set all routes as selected if URL didn't specify a route filter.
        if (urlRouteIds === null) {
          setSelectedRoutes(new Set(metadata.map(r => r.route_id)))
        } else {
          setSelectedRoutes(new Set(urlRouteIds))
        }
      } catch (err) {
        console.error('Failed to load data:', err)
        setError(err.message || 'Failed to load transit data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const toggleRoute = (routeId) => {
    setSelectedRoutes(prev => {
      const next = new Set(prev)
      if (next.has(routeId)) {
        next.delete(routeId)
      } else {
        next.add(routeId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedRoutes(new Set(routes.map(r => r.route_id)))
  }

  const selectNone = () => {
    setSelectedRoutes(new Set())
  }

  const showTimetable = (route) => {
    setTimetableRoute(route)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading transit data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h2>Failed to Load Data</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="retry-btn">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <RouteSidebar
        routes={routes}
        selectedRoutes={selectedRoutes}
        onToggleRoute={toggleRoute}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
        showStops={showStops}
        onToggleStops={() => setShowStops(!showStops)}
        onShowTimetable={showTimetable}
        showDebug={showDebug}
        onToggleDebug={() => setShowDebug(!showDebug)}
      />
      <div className="map-container">
        <ErrorBoundary fallback={<div className="map-error">Map failed to load. Please refresh the page.</div>}>
          <TransitMap
            routesGeoJSON={routesGeoJSON}
            stopsGeoJSON={stopsGeoJSON}
            selectedRoutes={selectedRoutes}
            showStops={showStops}
            showDebug={showDebug}
            routes={routes}
          />
        </ErrorBoundary>
      </div>

      {timetableRoute && (
        <TimetableModal
          route={timetableRoute}
          onClose={() => setTimetableRoute(null)}
        />
      )}
    </div>
  )
}

export default App
