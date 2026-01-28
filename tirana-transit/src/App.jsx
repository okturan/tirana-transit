import { useState, useEffect } from 'react'
import TransitMap from './components/TransitMap'
import RouteSidebar from './components/RouteSidebar'
import TimetableModal from './components/TimetableModal'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

function App() {
  const [routes, setRoutes] = useState([])
  const [routesGeoJSON, setRoutesGeoJSON] = useState(null)
  const [stopsGeoJSON, setStopsGeoJSON] = useState(null)
  const [selectedRoutes, setSelectedRoutes] = useState(new Set())
  const [showStops, setShowStops] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timetableRoute, setTimetableRoute] = useState(null)

  // Load state from URL on initial load
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      try {
        const params = new URLSearchParams(hash)
        const routesParam = params.get('routes')
        const stopsParam = params.get('stops')
        const debugParam = params.get('debug')
        
        if (routesParam) {
          const routeIds = routesParam.split(',').filter(Boolean)
          setSelectedRoutes(new Set(routeIds))
        }
        if (stopsParam === '1') setShowStops(true)
        if (debugParam === '1') setShowDebug(true)
      } catch (e) {
        console.warn('Failed to parse URL state:', e)
      }
    }
  }, [])

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedRoutes.size > 0 && selectedRoutes.size !== routes.length) {
      params.set('routes', Array.from(selectedRoutes).join(','))
    }
    if (showStops) params.set('stops', '1')
    if (showDebug) params.set('debug', '1')
    
    const hash = params.toString()
    window.location.hash = hash || ''
  }, [selectedRoutes, showStops, showDebug, routes.length])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [metadataRes, routesRes, stopsRes] = await Promise.all([
          fetch('/data/route_metadata.json'),
          fetch('/data/routes.geojson'),
          fetch('/data/stops.geojson')
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
        
        // Only set all routes as selected if URL didn't specify
        const hash = window.location.hash.slice(1)
        if (!hash || !new URLSearchParams(hash).get('routes')) {
          setSelectedRoutes(new Set(metadata.map(r => r.route_id)))
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
