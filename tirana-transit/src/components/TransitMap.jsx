import { useMemo, useRef, useState } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

// Tirana center coordinates
const TIRANA_CENTER = { longitude: 19.8187, latitude: 41.3275 }
const DEFAULT_ZOOM = 12
const MAX_ZOOM = 19

function TransitMap({ routesGeoJSON, stopsGeoJSON, selectedRoutes, showStops, routes, showDebug }) {
  const mapRef = useRef(null)
  const [popupInfo, setPopupInfo] = useState(null)
  const [arrowImageLoaded, setArrowImageLoaded] = useState(false)
  const [busStopImageLoaded, setBusStopImageLoaded] = useState(false)

  const routeInfo = useMemo(() => {
    const info = {}
    routes.forEach(r => {
      info[r.route_id] = r
    })
    return info
  }, [routes])

  // Build corridor info from features
  const corridorInfo = useMemo(() => {
    if (!routesGeoJSON) return { corridorGroups: {}, routeCorridor: {} }
    
    const routeCorridor = {}
    const corridorGroups = {}
    
    routesGeoJSON.features.forEach(f => {
      if (f.properties.debug) return
      const group = f.properties.corridor_group
      const routeId = f.properties.route_id
      const offset = f.properties.offset_meters
      
      routeCorridor[routeId] = { group, offset }
      
      if (group) {
        if (!corridorGroups[group]) corridorGroups[group] = []
        // Store unique routes per corridor
        if (!corridorGroups[group].find(r => r.routeId === routeId)) {
          corridorGroups[group].push({ routeId, offset })
        }
      }
    })
    
    return { corridorGroups, routeCorridor }
  }, [routesGeoJSON])

  // Determine dynamic offset for each route
  // When routes from same corridor are visible, spread them evenly
  // rather than using fixed positions from the full corridor
  const dynamicOffsets = useMemo(() => {
    const offsets = {}
    const { corridorGroups, routeCorridor } = corridorInfo
    
    // Process each corridor
    Object.entries(corridorGroups).forEach(([, routes]) => {
      // Which routes from this corridor are visible?
      const visibleRoutes = routes.filter(r => selectedRoutes.has(r.routeId))
      
      if (visibleRoutes.length === 0) return
      
      if (visibleRoutes.length === 1) {
        // Only one route visible - center it (0 offset)
        offsets[visibleRoutes[0].routeId] = 0
      } else {
        // Multiple routes visible - spread them evenly
        // Sort by original offset to maintain relative order
        visibleRoutes.sort((a, b) => a.offset - b.offset)
        
        const spacing = 6 // meters between visible routes
        const totalWidth = (visibleRoutes.length - 1) * spacing
        const startOffset = -totalWidth / 2
        
        visibleRoutes.forEach((route, index) => {
          offsets[route.routeId] = startOffset + (index * spacing)
        })
      }
    })
    
    // Routes not in any corridor keep their original offset
    selectedRoutes.forEach(routeId => {
      if (!(routeId in offsets)) {
        const info = routeCorridor[routeId]
        offsets[routeId] = info?.offset || 0
      }
    })
    
    return offsets
  }, [corridorInfo, selectedRoutes])

  // Build filtered routes with dynamic offsets
  const filteredRoutes = useMemo(() => {
    if (!routesGeoJSON) return { type: 'FeatureCollection', features: [] }
    
    const features = []
    
    // Group features by route
    const featuresByRoute = {}
    routesGeoJSON.features.forEach(f => {
      const routeId = f.properties.route_id
      if (!selectedRoutes.has(routeId)) return
      
      if (!featuresByRoute[routeId]) {
        featuresByRoute[routeId] = { offset: null, center: null }
      }
      
      if (f.properties.debug) {
        featuresByRoute[routeId].center = f
      } else {
        featuresByRoute[routeId].offset = f
      }
    })
    
    // Process each route
    Object.entries(featuresByRoute).forEach(([routeId, { offset, center }]) => {
      const targetOffset = dynamicOffsets[routeId] || 0
      const originalOffset = offset?.properties?.offset_meters || 0
      
      if (!offset || !center) {
        // Only have one version, use what's available
        if (offset) features.push(offset)
        else if (center) features.push(center)
        return
      }
      
      if (Math.abs(targetOffset - originalOffset) < 0.5) {
        // Target is close to pre-calculated offset, use it
        features.push(offset)
      } else if (Math.abs(targetOffset) < 0.5) {
        // Target is center, use centerline
        features.push(center)
      } else {
        // Need to interpolate between center and offset
        const t = targetOffset / originalOffset // interpolation factor
        const interpolatedCoords = offset.geometry.coordinates.map((point, i) => {
          const centerPoint = center.geometry.coordinates[i]
          if (!centerPoint) return point
          return [
            centerPoint[0] + (point[0] - centerPoint[0]) * t,
            centerPoint[1] + (point[1] - centerPoint[1]) * t
          ]
        })
        
        features.push({
          ...offset,
          geometry: {
            ...offset.geometry,
            coordinates: interpolatedCoords
          },
          properties: {
            ...offset.properties,
            dynamic_offset: targetOffset
          }
        })
      }
    })
    
    return { type: 'FeatureCollection', features }
  }, [routesGeoJSON, selectedRoutes, dynamicOffsets])

  // Debug routes (original unmodified lines) - only when explicitly enabled
  const debugRoutes = useMemo(() => {
    if (!routesGeoJSON || !showDebug) return { type: 'FeatureCollection', features: [] }
    return {
      type: 'FeatureCollection',
      features: routesGeoJSON.features.filter(f =>
        selectedRoutes.has(f.properties.route_id) && f.properties.debug
      )
    }
  }, [routesGeoJSON, selectedRoutes, showDebug])

  // Create start/end terminal points from routes
  const terminalPoints = useMemo(() => {
    const features = []
    filteredRoutes.features.forEach(f => {
      const coords = f.geometry.coordinates
      if (coords.length < 2) return

      const props = f.properties
      // Start point
      features.push({
        type: 'Feature',
        properties: {
          type: 'start',
          route_short_name: props.route_short_name,
          route_color: props.route_color
        },
        geometry: {
          type: 'Point',
          coordinates: coords[0]
        }
      })
      // End point
      features.push({
        type: 'Feature',
        properties: {
          type: 'end',
          route_short_name: props.route_short_name,
          route_color: props.route_color
        },
        geometry: {
          type: 'Point',
          coordinates: coords[coords.length - 1]
        }
      })
    })
    return { type: 'FeatureCollection', features }
  }, [filteredRoutes])

  // Filter stops based on selection
  const filteredStops = useMemo(() => {
    if (!stopsGeoJSON || !showStops) return { type: 'FeatureCollection', features: [] }
    return {
      type: 'FeatureCollection',
      features: stopsGeoJSON.features.filter(stop => {
        const stopRoutes = stop.properties.route_ids || []
        return stopRoutes.some(routeId => selectedRoutes.has(routeId))
      })
    }
  }, [stopsGeoJSON, selectedRoutes, showStops])

  // Create images when map loads
  const onMapLoad = (e) => {
    const map = e.target

    // Create a chevron/arrow image for direction indicators
    const arrowSize = 24
    const arrowCanvas = document.createElement('canvas')
    arrowCanvas.width = arrowSize
    arrowCanvas.height = arrowSize
    const arrowCtx = arrowCanvas.getContext('2d')

    arrowCtx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    arrowCtx.beginPath()
    arrowCtx.moveTo(6, 4)
    arrowCtx.lineTo(18, 12)
    arrowCtx.lineTo(6, 20)
    arrowCtx.lineTo(10, 12)
    arrowCtx.closePath()
    arrowCtx.fill()

    map.addImage('direction-arrow', {
      width: arrowSize,
      height: arrowSize,
      data: arrowCtx.getImageData(0, 0, arrowSize, arrowSize).data
    })
    setArrowImageLoaded(true)

    // Create bus stop icon
    const stopSize = 32
    const stopCanvas = document.createElement('canvas')
    stopCanvas.width = stopSize
    stopCanvas.height = stopSize
    const stopCtx = stopCanvas.getContext('2d')

    // Draw bus stop sign (circle with bus icon)
    // Outer circle - dark background
    stopCtx.beginPath()
    stopCtx.arc(16, 16, 14, 0, Math.PI * 2)
    stopCtx.fillStyle = '#1a1a2e'
    stopCtx.fill()
    stopCtx.strokeStyle = '#fff'
    stopCtx.lineWidth = 2
    stopCtx.stroke()

    // Draw simple bus shape
    stopCtx.fillStyle = '#fff'
    // Bus body
    stopCtx.fillRect(8, 10, 16, 10)
    // Roof
    stopCtx.fillRect(10, 8, 12, 3)
    // Windows
    stopCtx.fillStyle = '#1a1a2e'
    stopCtx.fillRect(10, 11, 4, 4)
    stopCtx.fillRect(16, 11, 4, 4)
    // Wheels
    stopCtx.fillStyle = '#fff'
    stopCtx.beginPath()
    stopCtx.arc(11, 21, 2, 0, Math.PI * 2)
    stopCtx.fill()
    stopCtx.beginPath()
    stopCtx.arc(21, 21, 2, 0, Math.PI * 2)
    stopCtx.fill()

    map.addImage('bus-stop', {
      width: stopSize,
      height: stopSize,
      data: stopCtx.getImageData(0, 0, stopSize, stopSize).data
    })
    setBusStopImageLoaded(true)

    // Change cursor on hover for routes (pointer) and stops (default)
    map.on('mouseenter', 'route-lines', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'route-lines', () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('mouseenter', 'stops-icon', () => {
      map.getCanvas().style.cursor = 'default'
    })
    map.on('mouseleave', 'stops-icon', () => {
      map.getCanvas().style.cursor = ''
    })
  }

  // Handle click on routes
  const onMapClick = (e) => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const features = map.queryRenderedFeatures(e.point, {
      layers: ['route-lines']
    })

    if (features.length > 0) {
      const feature = features[0]
      const props = feature.properties
      setPopupInfo({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        route_short_name: props.route_short_name,
        route_long_name: props.route_long_name,
        route_color: props.route_color,
        route_text_color: props.route_text_color,
        direction: props.direction
      })
    } else {
      // Check stops
      const stopFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['stops-icon']
      })
      if (stopFeatures.length > 0) {
        const stop = stopFeatures[0]
        const props = stop.properties
        const routeIds = JSON.parse(props.route_ids || '[]')
        const activeRoutes = routeIds
          .filter(id => selectedRoutes.has(id))
          .map(id => routeInfo[id])
          .filter(Boolean)

        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          isStop: true,
          stop_name: props.stop_name,
          stop_desc: props.stop_desc,
          routes: activeRoutes
        })
      } else {
        setPopupInfo(null)
      }
    }
  }


  return (
    <Map
      ref={mapRef}
      initialViewState={{
        ...TIRANA_CENTER,
        zoom: DEFAULT_ZOOM
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      maxZoom={MAX_ZOOM}
      onClick={onMapClick}
      onLoad={onMapLoad}
      interactiveLayerIds={['route-lines', 'stops-icon']}
    >
      {/* Debug routes (original unmodified lines) */}
      {showDebug && (
        <Source id="debug-routes" type="geojson" data={debugRoutes}>
          <Layer
            id="debug-route-lines"
            type="line"
            paint={{
              'line-color': '#000',
              'line-width': 2,
              'line-opacity': 0.6,
              'line-dasharray': [2, 2]
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round'
            }}
          />
        </Source>
      )}

      {/* Route lines */}
      <Source id="routes" type="geojson" data={filteredRoutes}>
        {/* Main route line */}
        <Layer
          id="route-lines"
          type="line"
          paint={{
            'line-color': ['get', 'route_color'],
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 3,
              13, 5,
              16, 8,
              19, 12
            ],
            'line-opacity': 0.9
          }}
          layout={{
            'line-cap': 'round',
            'line-join': 'round'
          }}
        />

        {/* Direction arrows along the line */}
        {arrowImageLoaded && (
          <Layer
            id="route-arrows"
            type="symbol"
            layout={{
              'symbol-placement': 'line',
              'symbol-spacing': 1,
              'icon-image': 'direction-arrow',
              'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                10, 0.35,
                13, 0.45,
                16, 0.55,
                19, 0.65
              ],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-rotation-alignment': 'map'
            }}
            paint={{
              'icon-opacity': 0.75
            }}
          />
        )}
      </Source>

      {/* Terminal points (start/end) */}
      <Source id="terminals" type="geojson" data={terminalPoints}>
        {/* Start terminals - small filled circles */}
        <Layer
          id="terminal-start"
          type="circle"
          filter={['==', ['get', 'type'], 'start']}
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 3,
              14, 5,
              18, 7
            ],
            'circle-color': ['get', 'route_color'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }}
        />
        {/* End terminals - white circles with colored border */}
        <Layer
          id="terminal-end-outer"
          type="circle"
          filter={['==', ['get', 'type'], 'end']}
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 5,
              14, 7,
              18, 10
            ],
            'circle-color': '#fff',
            'circle-stroke-width': 3,
            'circle-stroke-color': ['get', 'route_color']
          }}
        />
        {/* End terminals - inner dot */}
        <Layer
          id="terminal-end-inner"
          type="circle"
          filter={['==', ['get', 'type'], 'end']}
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 2,
              14, 3,
              18, 4
            ],
            'circle-color': ['get', 'route_color']
          }}
        />
      </Source>

      {/* Stops */}
      {showStops && busStopImageLoaded && (
        <Source id="stops" type="geojson" data={filteredStops}>
          <Layer
            id="stops-icon"
            type="symbol"
            layout={{
              'icon-image': 'bus-stop',
              'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                10, 0.4,
                14, 0.6,
                18, 0.9
              ],
              'icon-allow-overlap': true
            }}
          />
        </Source>
      )}

      {/* Popup */}
      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          anchor="bottom"
          onClose={() => setPopupInfo(null)}
          closeButton={true}
          closeOnClick={false}
        >
          {popupInfo.isStop ? (
            <div style={{ minWidth: 150 }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>
                {popupInfo.stop_name}
              </div>
              {popupInfo.stop_desc && (
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8 }}>
                  {popupInfo.stop_desc}
                </div>
              )}
              <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Lines:</div>
                {popupInfo.routes.map(r => (
                  <span
                    key={r.route_id}
                    style={{
                      display: 'inline-block',
                      background: r.color,
                      color: r.text_color,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 'bold',
                      fontSize: '0.85em',
                      margin: 2
                    }}
                  >
                    {r.short_name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div
                style={{
                  background: popupInfo.route_color,
                  color: popupInfo.route_text_color,
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontWeight: 'bold',
                  fontSize: '1.1em',
                  marginBottom: 8
                }}
              >
                Line {popupInfo.route_short_name}
              </div>
              <div style={{ color: '#666', fontSize: '0.9em' }}>
                {popupInfo.route_long_name || ''}
              </div>
              <div style={{ color: '#999', fontSize: '0.8em', marginTop: 4 }}>
                Direction {popupInfo.direction === '0' ? 'A' : 'B'}
              </div>
            </div>
          )}
        </Popup>
      )}
    </Map>
  )
}

export default TransitMap
