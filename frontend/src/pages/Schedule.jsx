import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import Card from '../components/Card'
import CalmContainer from '../components/CalmContainer'
import { ROUTES } from '../utils/constants'
import { fetchSlots } from '../utils/api'
import './Schedule.css'

function Schedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const professional = location.state?.professional
  const triageData = location.state?.triageData

  const [selectedSlot, setSelectedSlot] = useState(null)
  const [grouped, setGrouped] = useState({}) // { "Dr. Priya": [...], "Dr. Arjun": [...] }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSlots()
  }, [])

  const loadSlots = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSlots()
      // API returns { slots, grouped }
      if (data.grouped && Object.keys(data.grouped).length > 0) {
        setGrouped(data.grouped)
      } else if (data.slots) {
        // Fallback: group manually from flat list
        const manual = {}
        data.slots.forEach((slot) => {
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
        state: {
          selectedSlot: slot,
          professional: slot.professional || professional,
          triageData,
        },
      })
    }, 300)
  }

  const totalSlots = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <CalmContainer>
      <div className="schedule">
        {/* Back button */}
        <div className="schedule-back">
          <Button variant="secondary" onClick={() => navigate(-1)} className="back-button">
            ← Back
          </Button>
        </div>

        <div className="schedule-header">
          <h2 className="schedule-title">Choose your session time</h2>
          <p className="schedule-subtitle">
            Select a time that works best for you
          </p>
        </div>

        {loading && (
          <div className="schedule-loading">
            <p>Loading available times...</p>
          </div>
        )}

        {error && (
          <div className="schedule-error">
            <p className="error-message">{error}</p>
            <Button variant="secondary" onClick={loadSlots}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && totalSlots === 0 && (
          <div className="schedule-empty">
            <p>No available slots at the moment. Please check back later.</p>
          </div>
        )}

        {/* Grouped by professional */}
        {!loading && !error && totalSlots > 0 && (
          <div className="schedule-professionals">
            {Object.entries(grouped).map(([professionalName, slots]) => (
              <div key={professionalName} className="professional-group">
                <div className="professional-header">
                  <div className="professional-avatar" aria-hidden="true">
                    {professionalName.charAt(0)}
                  </div>
                  <div className="professional-info">
                    <h3 className="professional-name">{professionalName}</h3>
                    <span className="professional-slots-count">
                      {slots.length} slot{slots.length !== 1 ? 's' : ''} available
                    </span>
                  </div>
                </div>

                <div className="schedule-slots">
                  {slots.map((slot) => (
                    <Card
                      key={slot.id}
                      className={`schedule-slot ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                      selected={selectedSlot?.id === slot.id}
                      onClick={() => handleSlotClick(slot)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${professionalName} — ${slot.date} at ${slot.time}`}
                      onKeyDown={(e) => e.key === 'Enter' && handleSlotClick(slot)}
                    >
                      <div className="slot-date">{slot.date}</div>
                      <div className="slot-time">{slot.time}</div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CalmContainer>
  )
}

export default Schedule
