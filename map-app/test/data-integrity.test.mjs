import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readJson = async file => JSON.parse(await readFile(new URL(`../public/data/${file}`, import.meta.url), 'utf8'))

const [metadata, routes, stops] = await Promise.all([
  readJson('route_metadata.json'),
  readJson('routes.geojson'),
  readJson('stops.geojson')
])
const snapshotManifest = JSON.parse(
  await readFile(new URL('../../gtfs-data/snapshot-manifest.json', import.meta.url), 'utf8')
)

const radians = degrees => degrees * Math.PI / 180

const distanceMeters = ([lon1, lat1], [lon2, lat2]) => {
  const earthRadius = 6_371_000
  const latitudeDelta = radians(lat2 - lat1)
  const longitudeDelta = radians(lon2 - lon1)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

const lineLengthMeters = coordinates => coordinates
  .slice(1)
  .reduce((length, coordinate, index) => length + distanceMeters(coordinates[index], coordinate), 0)

test('bundled snapshot has the documented route and stop coverage', () => {
  assert.equal(metadata.length, snapshotManifest.records['routes.txt'])
  assert.equal(stops.type, 'FeatureCollection')
  assert.equal(stops.features.length, snapshotManifest.records['stops.txt'])

  const routeIds = metadata.map(route => route.route_id)
  assert.equal(new Set(routeIds).size, routeIds.length)
})

test('route geometry is paired, valid, and linked to metadata', () => {
  assert.equal(routes.type, 'FeatureCollection')
  assert.equal(routes.features.length, 96)
  assert.equal(routes.features.filter(feature => feature.properties.debug).length, 48)
  assert.equal(routes.features.filter(feature => !feature.properties.debug).length, 48)

  const knownRouteIds = new Set(metadata.map(route => route.route_id))
  const renderedRouteIds = new Set()

  for (const feature of routes.features) {
    assert.equal(feature.type, 'Feature')
    assert.equal(feature.geometry.type, 'LineString')
    assert.ok(feature.geometry.coordinates.length > 1)
    assert.ok(knownRouteIds.has(feature.properties.route_id))
    if (!feature.properties.debug) renderedRouteIds.add(feature.properties.route_id)
  }

  assert.deepEqual(renderedRouteIds, knownRouteIds)
})

test('every rendered shape preserves its complete debug centerline', () => {
  const pairs = new Map()

  for (const feature of routes.features) {
    const key = `${feature.properties.route_id}:${feature.properties.shape_id}`
    const pair = pairs.get(key) || { main: [], debug: [] }
    pair[feature.properties.debug ? 'debug' : 'main'].push(feature)
    pairs.set(key, pair)
  }

  assert.equal(pairs.size, 48)

  for (const [key, pair] of pairs) {
    assert.equal(pair.main.length, 1, `${key} should have one rendered geometry`)
    assert.equal(pair.debug.length, 1, `${key} should have one debug centerline`)

    const mainCoordinates = pair.main[0].geometry.coordinates
    const debugCoordinates = pair.debug[0].geometry.coordinates
    assert.equal(mainCoordinates.length, debugCoordinates.length, `${key} changed vertex count`)
    const lengthRatio = lineLengthMeters(mainCoordinates) / lineLengthMeters(debugCoordinates)
    assert.ok(lengthRatio >= 0.90 && lengthRatio <= 1.10, `${key} lost route geometry (${lengthRatio})`)

    const forwardEndpointGap = distanceMeters(mainCoordinates[0], debugCoordinates[0])
      + distanceMeters(mainCoordinates.at(-1), debugCoordinates.at(-1))
    const reverseEndpointGap = distanceMeters(mainCoordinates[0], debugCoordinates.at(-1))
      + distanceMeters(mainCoordinates.at(-1), debugCoordinates[0])
    assert.ok(Math.min(forwardEndpointGap, reverseEndpointGap) <= 100, `${key} lost a route endpoint`)
  }
})

test('every stop is a valid point linked only to known routes', () => {
  const knownRouteIds = new Set(metadata.map(route => route.route_id))

  for (const feature of stops.features) {
    assert.equal(feature.type, 'Feature')
    assert.equal(feature.geometry.type, 'Point')
    assert.equal(feature.geometry.coordinates.length, 2)
    assert.ok(feature.geometry.coordinates.every(Number.isFinite))
    assert.ok(feature.properties.route_ids.every(routeId => knownRouteIds.has(routeId)))
  }
})

test('metadata schedules use valid service keys and departure times', () => {
  for (const route of metadata) {
    assert.match(route.color, /^#[0-9A-F]{6}$/i)
    assert.match(route.text_color, /^#[0-9A-F]{6}$/i)
    assert.ok(route.stop_count > 0)

    for (const [serviceKey, times] of Object.entries(route.schedules)) {
      assert.match(serviceKey, /^[01]_.+$/)
      assert.ok(Array.isArray(times))
      for (const time of times) assert.match(time, /^\d{2}:\d{2}$/)
    }
  }
})

test('source GTFS contains the documented number of trips', async () => {
  const trips = await readFile(new URL('../../gtfs-data/trips.txt', import.meta.url), 'utf8')
  const rows = trips.trimEnd().split(/\r?\n/)
  assert.equal(rows.length - 1, snapshotManifest.records['trips.txt'])
})
