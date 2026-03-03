import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '../utils/constants'
import { fetchSlots } from '../utils/api'
import { getTeamMember } from '../utils/teamData'
import './Schedule.css'

function Schedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const triageData = location.state?.triageData

  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Track which card has its approach section expanded
  const [expanded, setExpanded] = useState({})

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSlots()
      if (data.grouped && Object.keys(data.grouped).length > 0) {
        setGrouped(data.grouped)
      } else if (data.slots) {
        const manual = {}
        data.slots.forEach(slot => {
          const pro = slot.professional || 'Available Slots'
          if (!manual[pro]) manual[pro] = []
          manual[pro].push(slot)
        })
        setGrouped(manual)
      }
    } catch (err) {
      console.error('Error loading slots:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const handleBookNow = (slot) => {
    navigate(ROUTES.DETAILS_PAYMENT, {
      state: { selectedSlot: slot, professional: slot.professional, triageData },
    })
  }

  const totalSlots = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <h1 className="schedule-title">Book a session</h1>
        <p className="schedule-subtitle">Choose a counsellor whose availability works for you.</p>
      </div>

      {loading && (
        <div className="schedule-state">
          <div className="sched-spinner" />
          <p>Finding available professionals…</p>
        </div>
      )}

      {error && (
        <div className="schedule-state">
          <p className="schedule-error-msg">{error}</p>
          <button className="sched-retry-btn" onClick={loadData}>Try again</button>
        </div>
      )}

      {!loading && !error && totalSlots === 0 && (
        <div className="schedule-state">
          <p>No available slots at the moment. Please check back soon.</p>
        </div>
      )}

      {!loading && !error && totalSlots > 0 && (
        <div className="schedule-list">
          {Object.entries(grouped).map(([proName, slots]) => {
            const info = getTeamMember(proName)
            const isOpen = !!expanded[proName]
            const nextSlot = slots[0]

            return (
              <div key={proName} className={`pro-card ${isOpen ? 'pro-card--open' : ''}`}>

                {/* ── Top: photo + identity + expand toggle ── */}
                <div className="pro-card-top">
                  {/* Avatar */}
                  <div className="pro-card-avatar">
                    {info?.photo
                      ? <img src={info.photo} alt={proName} className="pro-card-avatar-img" />
                      : <span>{proName.charAt(0)}</span>
                    }
                  </div>

                  {/* Identity */}
                  <div className="pro-card-info">
                    <h2 className="pro-card-name">{proName}</h2>
                    <p className="pro-card-role">
                      {info?.role || 'Counselling Psychologist'}
                      {info?.exp ? ` · ${info.exp}` : ''}
                    </p>
                    {info?.languages && (
                      <p className="pro-card-lang">🗣 {info.languages}</p>
                    )}
                  </div>

                  {/* Expand/collapse */}
                  {info && (
                    <button
                      className="pro-card-toggle"
                      onClick={() => toggleExpand(proName)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${proName}'s profile`}
                    >
                      <span>{isOpen ? '−' : '+'}</span>
                    </button>
                  )}
                </div>

                {/* ── Area chips — always visible ── */}
                {info?.areas?.length > 0 && (
                  <div className="pro-card-areas">
                    {info.areas.map(a => (
                      <span key={a} className="pro-card-chip">{a}</span>
                    ))}
                  </div>
                )}

                {/* ── Approach — only when expanded ── */}
                {isOpen && info?.approach?.length > 0 && (
                  <div className="pro-card-approach">
                    <p className="pro-card-approach-label">Therapeutic approach</p>
                    <div className="pro-card-approach-tags">
                      {info.approach.map(a => (
                        <span key={a} className="pro-card-approach-tag">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── All slots grid (secondary) ── */}
                {slots.length > 1 && (
                  <div className="pro-card-slots">
                    <span className="pro-card-slots-label">All available slots</span>
                    <div className="pro-card-slots-grid">
                      {slots.map(slot => (
                        <button
                          key={slot.id}
                          className="slot-pill"
                          onClick={() => handleBookNow(slot)}
                          aria-label={`Book ${proName} on ${slot.date} at ${slot.time}`}
                        >
                          <span className="slot-pill-date">{slot.date}</span>
                          <span className="slot-pill-time">{slot.time}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Footer: next slot + BOOK NOW ── */}
                {nextSlot && (
                  <div className="pro-card-footer">
                    <div className="pro-card-next">
                      <span className="pro-card-next-label">Next available</span>
                      <span className="pro-card-next-slot">{nextSlot.date} · {nextSlot.time}</span>
                    </div>
                    <button
                      className="pro-book-btn"
                      onClick={() => handleBookNow(nextSlot)}
                      aria-label={`Book session with ${proName}`}
                    >
                      BOOK NOW
                    </button>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Schedule
