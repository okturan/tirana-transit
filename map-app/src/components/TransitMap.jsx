import { useMemo, useRef, useState } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

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
    routes.forEach(r => info[r.route_id] = r)
    return info
  }, [routes])

  // Always use offset geometry (simpler, more reliable)
  const filteredRoutes = useMemo(() => {
    if (!routesGeoJSON) return { type: 'FeatureCollection', features: [] }
    
    return {
      type: 'FeatureCollection',
      features: routesGeoJSON.features.filter(f => 
        selectedRoutes.has(f.properties.route_id) && !f.properties.debug
      )
    }
  }, [routesGeoJSON, selectedRoutes])

  const debugRoutes = useMemo(() => {
    if (!routesGeoJSON || !showDebug) return { type: 'FeatureCollection', features: [] }
    return {
      type: 'FeatureCollection',
      features: routesGeoJSON.features.filter(f =>
        selectedRoutes.has(f.properties.route_id) && f.properties.debug
      )
    }
  }, [routesGeoJSON, selectedRoutes, showDebug])

  const terminalPoints = useMemo(() => {
    const features = []
    filteredRoutes.features.forEach(f => {
      const coords = f.geometry.coordinates
      if (coords.length < 2) return
      const props = f.properties
      features.push(
        { type: 'Feature', properties: { type: 'start', route_short_name: props.route_short_name, route_color: props.route_color },
          geometry: { type: 'Point', coordinates: coords[0] }},
        { type: 'Feature', properties: { type: 'end', route_short_name: props.route_short_name, route_color: props.route_color },
          geometry: { type: 'Point', coordinates: coords[coords.length - 1] }}
      )
    })
    return { type: 'FeatureCollection', features }
  }, [filteredRoutes])

  const filteredStops = useMemo(() => {
    if (!stopsGeoJSON || !showStops) return { type: 'FeatureCollection', features: [] }
    return {
      type: 'FeatureCollection',
      features: stopsGeoJSON.features.filter(stop => 
        (stop.properties.route_ids || []).some(routeId => selectedRoutes.has(routeId))
      )
    }
  }, [stopsGeoJSON, selectedRoutes, showStops])

  const onMapLoad = (e) => {
    const map = e.target

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
    map.addImage('direction-arrow', { width: arrowSize, height: arrowSize, data: arrowCtx.getImageData(0, 0, arrowSize, arrowSize).data })
    setArrowImageLoaded(true)

    const stopSize = 32
    const stopCanvas = document.createElement('canvas')
    stopCanvas.width = stopSize
    stopCanvas.height = stopSize
    const stopCtx = stopCanvas.getContext('2d')
    stopCtx.beginPath()
    stopCtx.arc(16, 16, 14, 0, Math.PI * 2)
    stopCtx.fillStyle = '#1a1a2e'
    stopCtx.fill()
    stopCtx.strokeStyle = '#fff'
    stopCtx.lineWidth = 2
    stopCtx.stroke()
    stopCtx.fillStyle = '#fff'
    stopCtx.fillRect(8, 10, 16, 10)
    stopCtx.fillRect(10, 8, 12, 3)
    stopCtx.fillStyle = '#1a1a2e'
    stopCtx.fillRect(10, 11, 4, 4)
    stopCtx.fillRect(16, 11, 4, 4)
    stopCtx.fillStyle = '#fff'
    stopCtx.beginPath()
    stopCtx.arc(11, 21, 2, 0, Math.PI * 2)
    stopCtx.fill()
    stopCtx.beginPath()
    stopCtx.arc(21, 21, 2, 0, Math.PI * 2)
    stopCtx.fill()
    map.addImage('bus-stop', { width: stopSize, height: stopSize, data: stopCtx.getImageData(0, 0, stopSize, stopSize).data })
    setBusStopImageLoaded(true)

    map.on('mouseenter', 'route-lines', () => map.getCanvas().style.cursor = 'pointer')
    map.on('mouseleave', 'route-lines', () => map.getCanvas().style.cursor = '')
    map.on('mouseenter', 'stops-icon', () => map.getCanvas().style.cursor = 'default')
    map.on('mouseleave', 'stops-icon', () => map.getCanvas().style.cursor = '')
  }

  const onMapClick = (e) => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const features = map.queryRenderedFeatures(e.point, { layers: ['route-lines'] })
    if (features.length > 0) {
      const props = features[0].properties
      setPopupInfo({ longitude: e.lngLat.lng, latitude: e.lngLat.lat, ...props })
    } else {
      const stopFeatures = map.queryRenderedFeatures(e.point, { layers: ['stops-icon'] })
      if (stopFeatures.length > 0) {
        const props = stopFeatures[0].properties
        const routeIds = JSON.parse(props.route_ids || '[]')
        const activeRoutes = routeIds.filter(id => selectedRoutes.has(id)).map(id => routeInfo[id]).filter(Boolean)
        setPopupInfo({ longitude: e.lngLat.lng, latitude: e.lngLat.lat, isStop: true, stop_name: props.stop_name, stop_desc: props.stop_desc, routes: activeRoutes })
      } else {
        setPopupInfo(null)
      }
    }
  }

  return (
    <Map ref={mapRef} initialViewState={{ ...TIRANA_CENTER, zoom: DEFAULT_ZOOM }} style={{ width: '100%', height: '100%' }} mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" maxZoom={MAX_ZOOM} onClick={onMapClick} onLoad={onMapLoad} interactiveLayerIds={['route-lines', 'stops-icon']}>
      {showDebug && (
        <Source id="debug-routes" type="geojson" data={debugRoutes}>
          <Layer id="debug-route-lines" type="line" paint={{ 'line-color': '#000', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [2, 2] }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </Source>
      )}
      <Source id="routes" type="geojson" data={filteredRoutes}>
        <Layer id="route-lines" type="line" paint={{ 'line-color': ['get', 'route_color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 13, 5, 16, 8, 19, 12], 'line-opacity': 0.9 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        {arrowImageLoaded && <Layer id="route-arrows" type="symbol" layout={{ 'symbol-placement': 'line', 'symbol-spacing': 1, 'icon-image': 'direction-arrow', 'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 13, 0.45, 16, 0.55, 19, 0.65], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' }} paint={{ 'icon-opacity': 0.75 }} />}
      </Source>
      <Source id="terminals" type="geojson" data={terminalPoints}>
        <Layer id="terminal-start" type="circle" filter={['==', ['get', 'type'], 'start']} paint={{ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5, 18, 7], 'circle-color': ['get', 'route_color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }} />
        <Layer id="terminal-end-outer" type="circle" filter={['==', ['get', 'type'], 'end']} paint={{ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 7, 18, 10], 'circle-color': '#fff', 'circle-stroke-width': 3, 'circle-stroke-color': ['get', 'route_color'] }} />
        <Layer id="terminal-end-inner" type="circle" filter={['==', ['get', 'type'], 'end']} paint={{ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 18, 4], 'circle-color': ['get', 'route_color'] }} />
      </Source>
      {showStops && busStopImageLoaded && (
        <Source id="stops" type="geojson" data={filteredStops}>
          <Layer id="stops-icon" type="symbol" layout={{ 'icon-image': 'bus-stop', 'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 14, 0.6, 18, 0.9], 'icon-allow-overlap': true }} />
        </Source>
      )}
      {popupInfo && (
        <Popup longitude={popupInfo.longitude} latitude={popupInfo.latitude} anchor="bottom" onClose={() => setPopupInfo(null)} closeButton={true} closeOnClick={false}>
          {popupInfo.isStop ? (
            <div style={{ minWidth: 150 }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>{popupInfo.stop_name}</div>
              {popupInfo.stop_desc && <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8 }}>{popupInfo.stop_desc}</div>}
              <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Lines:</div>
                {popupInfo.routes.map(r => <span key={r.route_id} style={{ display: 'inline-block', background: r.color, color: r.text_color, padding: '2px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: '0.85em', margin: 2 }}>{r.short_name}</span>)}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ background: popupInfo.route_color, color: popupInfo.route_text_color, padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', fontSize: '1.1em', marginBottom: 8 }}>Line {popupInfo.route_short_name}</div>
              <div style={{ color: '#666', fontSize: '0.9em' }}>{popupInfo.route_long_name || ''}</div>
              <div style={{ color: '#999', fontSize: '0.8em', marginTop: 4 }}>Direction {popupInfo.direction === '0' ? 'A' : 'B'}</div>
            </div>
          )}
        </Popup>
      )}
    </Map>
  )
}

export default TransitMap
