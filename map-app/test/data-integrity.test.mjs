import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readJson = async file => JSON.parse(await readFile(new URL(`../public/data/${file}`, import.meta.url), 'utf8'))

const [metadata, routes, stops] = await Promise.all([
  readJson('route_metadata.json'),
  readJson('routes.geojson'),
  readJson('stops.geojson')
])

test('bundled snapshot has the documented route and stop coverage', () => {
  assert.equal(metadata.length, 27)
  assert.equal(stops.type, 'FeatureCollection')
  assert.equal(stops.features.length, 491)

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
  assert.equal(rows.length - 1, 16_642)
})
