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
  const selectedCount = selectedRoutes.size
  const totalCount = routes.length

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>Tirana Transit</h1>
        <p>{selectedCount} of {totalCount} lines selected</p>
      </header>

      <div className="sidebar-controls">
        <button className="btn-all" onClick={onSelectAll}>
          Show All
        </button>
        <button className="btn-none" onClick={onSelectNone}>
          Hide All
        </button>
      </div>

      <div className="routes-list">
        {routes.map(route => {
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
        })}
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
