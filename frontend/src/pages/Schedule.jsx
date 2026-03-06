import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '../utils/constants'
import { fetchSlots, fetchProfessionals } from '../utils/api'
import { getTeamMember } from '../utils/teamData'
import './Schedule.css'

const WA_LINK = `${import.meta.env.VITE_WHATSAPP_LINK || 'https://wa.me/917358154022'}?text=${encodeURIComponent('Hi, I need to speak with a counsellor urgently.')}`

function Schedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const triageData = location.state?.triageData

  const [grouped, setGrouped] = useState({})
  const [apiProfMap, setApiProfMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [slotResult, profResult] = await Promise.allSettled([
        fetchSlots(),
        fetchProfessionals(),
      ])

      if (slotResult.status === 'rejected') throw new Error(slotResult.reason?.message || 'Failed to load slots')
      const data = slotResult.value
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

      if (profResult.status === 'fulfilled' && Array.isArray(profResult.value)) {
        const map = {}
        profResult.value.forEach(p => { if (p.name) map[p.name.toLowerCase()] = p })
        setApiProfMap(map)
      }
    } catch (err) {
      console.error('Error loading schedule data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Photo priority: sheet URL → bundled photo (founders) → null (initials)
   * Info priority: API data (sheet) → local teamData fallback
   */
  const getMergedInfo = (proName) => {
    const api = apiProfMap[proName.toLowerCase()] || null
    const local = getTeamMember(proName)
    const photo = (api?.photoUrl) || local?.photo || null

    return {
      role: api?.title || local?.role || 'Counselling Psychologist',
      exp: api?.experience || local?.exp || '',
      languages: api?.languages || local?.languages || '',
      areas: api?.areas?.length ? api.areas : (local?.areas || []),
      // Approach: API wins if sheet has it, else fall back to teamData hardcoded
      approach: api?.approach?.length ? api.approach : (local?.approach || []),
      price: api?.price || '',
      photo,
      photoPosition: local?.photoPosition || null,
      photoFit: local?.photoFit || 'cover',
    }
  }

  const toggleExpand = (name) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }))

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
          {/* Dismissible soft nudge — revealed only when user interacts */}
          {!nudgeDismissed && (
            <div className="sched-nudge">
              <span className="sched-nudge-text">Need to speak with someone sooner?</span>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="sched-nudge-link">
                Message us →
              </a>
              <button className="sched-nudge-dismiss" onClick={() => setNudgeDismissed(true)} aria-label="Dismiss">✕</button>
            </div>
          )}
          {Object.entries(grouped).map(([proName, slots]) => {
            const info = getMergedInfo(proName)
            const isOpen = !!expanded[proName]
            const nextSlot = slots[0]

            return (
              <div key={proName} className={`pro-card ${isOpen ? 'pro-card--open' : ''}`}>

                {/* Top: photo + identity + toggle */}
                <div className="pro-card-top">
                  <div className="pro-card-avatar">
                    {info.photo
                      ? <img
                        src={info.photo}
                        alt={proName}
                        className="pro-card-avatar-img"
                        style={{
                          objectFit: info.photoFit || 'cover',
                          objectPosition: info.photoPosition || 'top center',
                        }}
                      />
                      : <span>{proName.charAt(0)}</span>
                    }
                  </div>

                  <div className="pro-card-info">
                    <h2 className="pro-card-name">{proName}</h2>
                    <p className="pro-card-role">
                      {info.role}{info.exp ? ` · ${info.exp}` : ''}
                    </p>
                    {info.languages && <p className="pro-card-lang">🗣 {info.languages}</p>}
                    {info.price && <p className="pro-card-lang">₹{info.price} / session</p>}
                  </div>

                  <button
                    className="pro-card-toggle"
                    onClick={() => toggleExpand(proName)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${proName}'s profile`}
                  >
                    <span>{isOpen ? '−' : '+'}</span>
                  </button>
                </div>

                {/* Area chips */}
                {info.areas.length > 0 && (
                  <div className="pro-card-areas">
                    {info.areas.map(a => <span key={a} className="pro-card-chip">{a}</span>)}
                  </div>
                )}

                {/* Approach (expanded) */}
                {isOpen && info.approach.length > 0 && (
                  <div className="pro-card-approach">
                    <p className="pro-card-approach-label">Therapeutic approach</p>
                    <div className="pro-card-approach-tags">
                      {info.approach.map(a => <span key={a} className="pro-card-approach-tag">{a}</span>)}
                    </div>
                  </div>
                )}

                {/* All slots grid */}
                {slots.length > 1 && (
                  <div className="pro-card-slots">
                    <span className="pro-card-slots-label">All available slots</span>
                    <div className="pro-card-slots-grid">
                      {slots.map(slot => (
                        <button key={slot.id} className="slot-pill" onClick={() => handleBookNow(slot)}>
                          <span className="slot-pill-date">{slot.date}</span>
                          <span className="slot-pill-time">{slot.time}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer: next slot + BOOK NOW */}
                {nextSlot && (
                  <div className="pro-card-footer">
                    <div className="pro-card-next">
                      <span className="pro-card-next-label">Next available</span>
                      <span className="pro-card-next-slot">{nextSlot.date} · {nextSlot.time}</span>
                    </div>
                    <button className="pro-book-btn" onClick={() => handleBookNow(nextSlot)}>
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
