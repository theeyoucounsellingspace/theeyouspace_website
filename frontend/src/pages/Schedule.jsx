import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '../utils/constants'
import { fetchSlots, fetchProfessionals } from '../utils/api'
import './Schedule.css'

function Schedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const triageData = location.state?.triageData

  const [grouped, setGrouped] = useState({})
  const [profMap, setProfMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [slotData, profList] = await Promise.allSettled([
        fetchSlots(),
        fetchProfessionals(),
      ])

      // Slots — required
      if (slotData.status === 'rejected') throw new Error(slotData.reason?.message || 'Failed to load slots')
      const data = slotData.value
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

      // Professionals — best-effort
      if (profList.status === 'fulfilled' && Array.isArray(profList.value)) {
        const map = {}
        profList.value.forEach(p => { if (p.name) map[p.name.toLowerCase()] = p })
        setProfMap(map)
      }
    } catch (err) {
      console.error('Error loading schedule data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getProInfo = (name) => {
    if (!name) return null
    return profMap[name.toLowerCase()] || { name, title: 'Counselling Psychologist', bio: '', specializations: [], areas: [] }
  }

  // Get the earliest (first) slot for a professional
  const getNextSlot = (slots) => slots?.[0] || null

  const handleBookNow = (slot) => {
    navigate(ROUTES.DETAILS_PAYMENT, {
      state: { selectedSlot: slot, professional: slot.professional, triageData },
    })
  }

  const totalSlots = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <h1 className="schedule-title">Choose your professional</h1>
        <p className="schedule-subtitle">Select a counsellor and book your first session.</p>
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
            const bio = getProInfo(proName)
            const nextSlot = getNextSlot(slots)

            return (
              <div key={proName} className="pro-card">
                {/* Top row: title + name + avatar */}
                <div className="pro-card-top">
                  <div className="pro-card-info">
                    <span className="pro-card-title">{bio?.title || 'Counselling Psychologist'}</span>
                    <h2 className="pro-card-name">{proName}</h2>
                    {bio?.experience && (
                      <p className="pro-card-exp">{bio.experience} of experience</p>
                    )}
                  </div>
                  <div className="pro-card-avatar" aria-hidden="true">
                    <span>{proName.charAt(0)}</span>
                  </div>
                </div>

                {/* Details rows */}
                <div className="pro-card-details">
                  {bio?.languages && (
                    <div className="pro-card-row">
                      <span className="pro-card-label">Speaks</span>
                      <span className="pro-card-value">{bio.languages}</span>
                    </div>
                  )}
                  {bio?.specializations?.length > 0 && (
                    <div className="pro-card-row pro-card-row--top">
                      <span className="pro-card-label">Expertise</span>
                      <div className="pro-card-tags">
                        {bio.specializations.map(s => (
                          <span key={s} className="pro-card-tag">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {bio?.price && (
                    <div className="pro-card-row">
                      <span className="pro-card-label">Price</span>
                      <span className="pro-card-value pro-card-price">₹{bio.price} / 60 min session</span>
                    </div>
                  )}
                </div>

                {/* All available slots */}
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

                {/* Footer: next slot + book now */}
                {nextSlot && (
                  <div className="pro-card-footer">
                    <div className="pro-card-next">
                      <span className="pro-card-next-label">Next available slot:</span>
                      <span className="pro-card-next-slot">{nextSlot.date} {nextSlot.time}</span>
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
