import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import { ROUTES } from '../utils/constants'
import { fetchSlots } from '../utils/api'
import { getProfessional } from '../data/professionals'
import './Schedule.css'

function Schedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const triageData = location.state?.triageData

  const [selectedSlot, setSelectedSlot] = useState(null)
  const [expandedPro, setExpandedPro] = useState(null)   // which pro's bio panel is open
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadSlots() }, [])

  const loadSlots = async () => {
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

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot)
    setTimeout(() => {
      navigate(ROUTES.DETAILS_PAYMENT, {
        state: { selectedSlot: slot, professional: slot.professional, triageData },
      })
    }, 300)
  }

  const toggleBio = (name) => setExpandedPro(p => p === name ? null : name)

  const totalSlots = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <div className="schedule-page">
      {/* Back */}
      <button className="schedule-back" onClick={() => navigate(-1)} aria-label="Go back">←</button>

      <div className="schedule-header">
        <h2 className="schedule-title">Choose your professional &amp; time</h2>
        <p className="schedule-subtitle">Tap a professional to learn about their approach, then select a slot.</p>
      </div>

      {loading && <div className="schedule-state"><p>Loading available times…</p></div>}

      {error && (
        <div className="schedule-state">
          <p className="schedule-error-msg">{error}</p>
          <Button variant="secondary" onClick={loadSlots}>Try again</Button>
        </div>
      )}

      {!loading && !error && totalSlots === 0 && (
        <div className="schedule-state">
          <p>No available slots at the moment. Please check back soon.</p>
        </div>
      )}

      {!loading && !error && totalSlots > 0 && (
        <div className="schedule-professionals">
          {Object.entries(grouped).map(([proName, slots]) => {
            const bio = getProfessional(proName)
            const isOpen = expandedPro === proName

            return (
              <div key={proName} className={`pro-group ${isOpen ? 'open' : ''}`}>

                {/* Professional header row — click to expand bio */}
                <button
                  className="pro-header"
                  onClick={() => toggleBio(proName)}
                  aria-expanded={isOpen}
                  aria-controls={`bio-${proName}`}
                >
                  <div className="pro-avatar" aria-hidden="true">
                    {proName.charAt(0)}
                  </div>
                  <div className="pro-meta">
                    <span className="pro-name">{proName}</span>
                    <span className="pro-sub">
                      {bio ? `${bio.title} · ${bio.experience}` : 'Counseling Psychologist'}
                      {' · '}
                      <span className="pro-slot-count">{slots.length} slot{slots.length !== 1 ? 's' : ''}</span>
                    </span>
                  </div>
                  <span className="pro-chevron" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Bio panel */}
                {isOpen && bio && (
                  <div className="pro-bio" id={`bio-${proName}`} role="region" aria-label={`About ${proName}`}>
                    <p className="pro-approach">{bio.approach}</p>
                    <div className="pro-tags">
                      {bio.specializations.map(s => (
                        <span key={s} className="pro-tag">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slots grid — always visible once pro section is in view */}
                <div className="pro-slots">
                  {slots.map(slot => (
                    <button
                      key={slot.id}
                      className={`slot-card ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                      onClick={() => handleSlotClick(slot)}
                      aria-label={`${proName} — ${slot.date} at ${slot.time}`}
                    >
                      <span className="slot-date">{slot.date}</span>
                      <span className="slot-time">{slot.time}</span>
                    </button>
                  ))}
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Schedule
