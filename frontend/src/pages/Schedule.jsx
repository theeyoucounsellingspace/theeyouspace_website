import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import { ROUTES } from '../utils/constants'
import { fetchSlots } from '../utils/api'
import { getProfessional } from '../data/professionals'
import './Schedule.css'

// ── Per-professional warm-muted color identities ─────────────────────────────
// Each professional gets a unique hue that appears in their avatar, bio panel
// tint, tag borders, and slot card accents. Colors stay within the site palette.
const PRO_COLORS = {
  'Mohammed Muhaiyadeen M': {
    hue: '#C4975A',          // warm amber / sand
    tint: 'rgba(196,151,90,0.08)',
    gradient: 'linear-gradient(135deg, #C4975A 0%, #E2BC88 100%)',
    label: '#7a5c2a',
  },
  'Leaskar Paulraj DJ': {
    hue: '#7A9E87',          // sage green / eucalyptus
    tint: 'rgba(122,158,135,0.08)',
    gradient: 'linear-gradient(135deg, #7A9E87 0%, #A6C4AD 100%)',
    label: '#3a5f46',
  },
  'Jeevan KJ': {
    hue: '#B8849A',          // dusty rose / mauve
    tint: 'rgba(184,132,154,0.08)',
    gradient: 'linear-gradient(135deg, #B8849A 0%, #D4A9BB 100%)',
    label: '#7a3f5a',
  },
  'Abijith KB': {
    hue: '#7B9EAE',          // ocean mist / slate blue
    tint: 'rgba(123,158,174,0.08)',
    gradient: 'linear-gradient(135deg, #7B9EAE 0%, #A8C3CF 100%)',
    label: '#3a5f70',
  },
  'Joan Ana': {
    hue: '#9E8AB8',          // warm lavender / lilac
    tint: 'rgba(158,138,184,0.08)',
    gradient: 'linear-gradient(135deg, #9E8AB8 0%, #BEB0D4 100%)',
    label: '#5a3f7a',
  },
}

// Fallback for any professional not in the color map
const DEFAULT_COLOR = {
  hue: '#a89880',
  tint: 'rgba(168,152,128,0.08)',
  gradient: 'linear-gradient(135deg, #a89880 0%, #c4b49e 100%)',
  label: '#6b5c48',
}

function getProColor(name) {
  if (!name) return DEFAULT_COLOR
  if (PRO_COLORS[name]) return PRO_COLORS[name]
  // case-insensitive fallback
  const key = Object.keys(PRO_COLORS).find(
    k => k.toLowerCase() === name.toLowerCase()
  )
  return key ? PRO_COLORS[key] : DEFAULT_COLOR
}

function Schedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const triageData = location.state?.triageData

  const [selectedSlot, setSelectedSlot] = useState(null)
  const [expandedPro, setExpandedPro] = useState(null)
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
            const color = getProColor(proName)
            const isOpen = expandedPro === proName

            // Inject color as CSS custom properties on each card
            const colorVars = {
              '--pro-hue': color.hue,
              '--pro-tint': color.tint,
              '--pro-gradient': color.gradient,
              '--pro-label': color.label,
            }

            return (
              <div
                key={proName}
                className={`pro-group ${isOpen ? 'open' : ''}`}
                style={colorVars}
              >
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
                      <span className="pro-slot-count">
                        {slots.length} slot{slots.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>
                  <span className="pro-chevron" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Bio panel — fades in with the professional's personal tint */}
                {isOpen && bio && (
                  <div
                    className="pro-bio"
                    id={`bio-${proName}`}
                    role="region"
                    aria-label={`About ${proName}`}
                  >
                    <p className="pro-approach">{bio.approach}</p>
                    <div className="pro-tags">
                      {bio.specializations.map(s => (
                        <span key={s} className="pro-tag">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slots — left-border accent uses the professional's personal hue */}
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
