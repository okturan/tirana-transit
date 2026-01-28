import { useState, useMemo } from 'react'

function RouteSidebar({
  routes,
  selectedRoutes,
  onToggleRoute,
  onSelectAll,
  onSelectNone,
  showStops,
  onToggleStops,
  onShowTimetable,
  showDebug,
  onToggleDebug
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes

    const query = searchQuery.toLowerCase().trim()
    return routes.filter(route => 
      route.short_name.toLowerCase().includes(query) ||
      route.long_name.toLowerCase().includes(query) ||
      route.route_id.toLowerCase().includes(query)
    )
  }, [routes, searchQuery])

  const selectedCount = selectedRoutes.size
  const totalCount = routes.length
  const filteredCount = filteredRoutes.length
  const visibleSelectedCount = filteredRoutes.filter(r => selectedRoutes.has(r.route_id)).length

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>Tirana Transit</h1>
        <p>{selectedCount} of {totalCount} lines selected</p>
      </header>

      {/* Search */}
      <div className="sidebar-filters">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search routes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="search-clear" 
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {searchQuery && (
          <div className="filter-status">
            Showing {filteredCount} of {totalCount} routes
            {visibleSelectedCount > 0 && (
              <span> ({visibleSelectedCount} selected)</span>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-controls">
        <button className="btn-all" onClick={onSelectAll}>
          Show All
        </button>
        <button className="btn-none" onClick={onSelectNone}>
          Hide All
        </button>
      </div>

      <div className="routes-list">
        {filteredRoutes.length === 0 ? (
          <div className="no-results">
            <p>No routes match &quot;{searchQuery}&quot;</p>
            <button onClick={() => setSearchQuery('')}>Clear search</button>
          </div>
        ) : (
          filteredRoutes.map(route => {
            const isActive = selectedRoutes.has(route.route_id)
            return (
              <div
                key={route.route_id}
                className={`route-item ${isActive ? 'active' : ''}`}
                style={{ '--route-color': route.color, cursor: 'pointer' }}
                onClick={() => onToggleRoute(route.route_id)}
              >
                <div
                  className="route-badge"
                  style={{
                    backgroundColor: route.color,
                    color: route.text_color
                  }}
                >
                  {route.short_name}
                </div>
                <div className="route-info">
                  <div className="route-name">
                    Line {route.short_name}
                    {route.stop_count > 0 && (
                      <span className="stop-count">{route.stop_count} stops</span>
                    )}
                  </div>
                  {route.long_name && (
                    <div className="route-desc">{route.long_name}</div>
                  )}
                </div>
                <button
                  className="timetable-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onShowTimetable(route)
                  }}
                  title="View timetable"
                >
                  Schedule
                </button>
                <div className="route-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="stops-toggle">
        <label>
          <input
            type="checkbox"
            checked={showStops}
            onChange={onToggleStops}
          />
          Show bus stops
        </label>
        {showStops && selectedRoutes.size > 0 && (
          <span className="stops-hint">for selected lines</span>
        )}
      </div>

      <div className="stops-toggle">
        <label>
          <input
            type="checkbox"
            checked={showDebug}
            onChange={onToggleDebug}
          />
          Debug: show original lines
        </label>
        {showDebug && (
          <span className="stops-hint">dashed = original GTFS</span>
        )}
      </div>

      <footer className="sidebar-footer">
        Data: <a href="https://tirana.al" target="_blank" rel="noopener noreferrer">Municipality of Tirana</a> · CC-BY-SA-4.0
      </footer>
    </aside>
  )
}

export default RouteSidebar
