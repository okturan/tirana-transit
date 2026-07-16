export function parseUrlState(hash = '') {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const hasRoutes = params.has('routes')
  const routeIds = hasRoutes
    ? [...new Set(params.get('routes').split(',').map(routeId => routeId.trim()).filter(Boolean))]
    : null

  return {
    routeIds,
    showStops: params.get('stops') === '1',
    showDebug: params.get('debug') === '1'
  }
}

export function serializeUrlState({ routeIds, totalRoutes, showStops, showDebug }) {
  const params = new URLSearchParams()
  const uniqueRouteIds = [...new Set(routeIds)]

  if (totalRoutes > 0 && uniqueRouteIds.length !== totalRoutes) {
    params.set('routes', uniqueRouteIds.join(','))
  }
  if (showStops) params.set('stops', '1')
  if (showDebug) params.set('debug', '1')

  return params.toString()
}

export function filterKnownRouteIds(routeIds, knownRouteIds) {
  if (routeIds === null) return null
  const known = new Set(knownRouteIds)
  return routeIds.filter(routeId => known.has(routeId))
}
