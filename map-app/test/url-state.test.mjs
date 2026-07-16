import test from 'node:test'
import assert from 'node:assert/strict'

import { parseUrlState, serializeUrlState } from '../src/urlState.js'

test('parses route and display state from a URL hash', () => {
  assert.deepEqual(parseUrlState('#routes=1,3,1,%20&stops=1&debug=1'), {
    routeIds: ['1', '3'],
    showStops: true,
    showDebug: true
  })
})

test('distinguishes no route filter from an explicitly empty selection', () => {
  assert.equal(parseUrlState('').routeIds, null)
  assert.deepEqual(parseUrlState('#routes=').routeIds, [])
})

test('omits the route filter when every route is selected', () => {
  assert.equal(serializeUrlState({
    routeIds: ['1', '2', '3'],
    totalRoutes: 3,
    showStops: false,
    showDebug: false
  }), '')
})

test('serializes partial and empty selections for shareable views', () => {
  assert.equal(serializeUrlState({
    routeIds: ['1', '3'],
    totalRoutes: 3,
    showStops: true,
    showDebug: false
  }), 'routes=1%2C3&stops=1')

  assert.equal(serializeUrlState({
    routeIds: [],
    totalRoutes: 3,
    showStops: false,
    showDebug: false
  }), 'routes=')
})
