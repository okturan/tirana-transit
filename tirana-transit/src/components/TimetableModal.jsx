import { useState } from 'react'

function TimetableModal({ route, onClose }) {
  const [activeDirection, setActiveDirection] = useState('0')
  const [activeDay, setActiveDay] = useState('Weekdays')

  if (!route) return null

  const { schedules, directions } = route
  const dayTypes = ['Weekdays', 'Saturday', 'Sunday']

  // Get times for current selection
  const key = `${activeDirection}_${activeDay}`
  const times = schedules[key] || []

  // Group times by hour for better display
  const timesByHour = {}
  times.forEach(time => {
    const hour = time.split(':')[0]
    if (!timesByHour[hour]) timesByHour[hour] = []
    timesByHour[hour].push(time.split(':')[1])
  })

  const directionNames = {
    '0': directions['0'] || 'Direction A',
    '1': directions['1'] || 'Direction B'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: route.color }}>
          <div className="modal-title">
            <span className="modal-badge" style={{ background: route.color, color: route.text_color }}>
              {route.short_name}
            </span>
            <span className="modal-route-name" style={{ color: route.text_color }}>
              {route.long_name || `Line ${route.short_name}`}
            </span>
          </div>
          <button className="modal-close" onClick={onClose} style={{ color: route.text_color }}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Direction selector */}
          {directions['1'] && (
            <div className="direction-selector">
              <button
                className={`direction-btn ${activeDirection === '0' ? 'active' : ''}`}
                onClick={() => setActiveDirection('0')}
              >
                {directionNames['0']}
              </button>
              <button
                className={`direction-btn ${activeDirection === '1' ? 'active' : ''}`}
                onClick={() => setActiveDirection('1')}
              >
                {directionNames['1']}
              </button>
            </div>
          )}

          {/* Day type selector */}
          <div className="day-selector">
            {dayTypes.map(day => (
              <button
                key={day}
                className={`day-btn ${activeDay === day ? 'active' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Timetable */}
          <div className="timetable">
            {Object.keys(timesByHour).length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Hour</th>
                    <th>Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(timesByHour).sort(([a], [b]) => a - b).map(([hour, minutes]) => (
                    <tr key={hour}>
                      <td className="hour-cell">{hour}</td>
                      <td className="minutes-cell">
                        {minutes.sort().map((min, i) => (
                          <span key={i} className="minute-badge">{min}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-times">No schedule available for this selection</div>
            )}
          </div>

          <div className="timetable-footer">
            <p>First departure: {times[0] || '-'}</p>
            <p>Last departure: {times[times.length - 1] || '-'}</p>
            <p>Total trips: {times.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimetableModal
