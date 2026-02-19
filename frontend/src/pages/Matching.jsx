import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES } from '../utils/constants'
import './Matching.css'

// Maps concern ID → display label + specialty
const CONCERN_MAP = {
  anxiety_stress: { label: 'Anxiety & Stress', specialty: 'Anxiety & Stress Specialist' },
  depression_mood: { label: 'Low Mood & Depression', specialty: 'Depression & Mood Specialist' },
  relationship_family: { label: 'Relationships & Family', specialty: 'Relationship Counsellor' },
  work_academics: { label: 'Work & Academics', specialty: 'Work & Academic Counsellor' },
  grief_loss: { label: 'Grief & Loss', specialty: 'Grief Counsellor' },
  trauma_regret: { label: 'Trauma & Regret', specialty: 'Trauma & Regret Counsellor' },
  self_identity: { label: 'Self & Identity', specialty: 'Personal Growth Counsellor' },
  general: { label: 'General Support', specialty: 'General Support Counsellor' },
  // Legacy concern keys (backward compat)
  work_life_balance: { label: 'Work-Life Balance', specialty: 'Work-Life Balance Specialist' },
  academics_career: { label: 'Academics & Career', specialty: 'Academic & Career Advisor' },
  anxiety_depression: { label: 'Anxiety & Depression', specialty: 'Anxiety & Depression Specialist' },
  regret_management: { label: 'Regret Management', specialty: 'Regret Management Counsellor' },
  general_support: { label: 'General Support', specialty: 'General Support Counsellor' },
}

const DURATION_LABELS = {
  days: 'a few days',
  weeks: 'a few weeks',
  months: 'a few months',
  longer: 'over 6 months',
}

function Matching() {
  const navigate = useNavigate()
  const location = useLocation()
  const triageData = location.state?.triageData

  const [loading, setLoading] = useState(true)
  const [matched, setMatched] = useState(null)

  useEffect(() => {
    if (!triageData) {
      navigate(ROUTES.TRIAGE)
      return
    }

    // Resolve concern key (new: concern, legacy: primaryConcern)
    const concernKey = triageData.concern || triageData.primaryConcern || 'general'
    const info = CONCERN_MAP[concernKey] || CONCERN_MAP.general

    setTimeout(() => {
      setMatched({ specialty: info.specialty, concernLabel: info.label })
      setLoading(false)
    }, 1400)
  }, [triageData, navigate])

  const handleContinue = () => {
    navigate(ROUTES.SCHEDULE, {
      state: { triageData, professional: matched },
    })
  }

  const sessionType = triageData?.sessionType || 'normal'
  const isPriority = sessionType === 'priority'

  if (loading) {
    return (
      <CalmContainer centered>
        <div className="matching">
          <div className="matching-loading">
            <div className="loading-spinner" aria-hidden="true" />
            <h2 className="matching-title">Finding the right match for you</h2>
            <p className="matching-subtitle">
              We're connecting you with a specialist who understands your needs.
            </p>
          </div>
        </div>
      </CalmContainer>
    )
  }

  return (
    <CalmContainer centered>
      <div className="matching">
        <div className="matching-content">
          <div className="matching-back">
            <Button variant="secondary" onClick={() => navigate(ROUTES.TRIAGE)} className="back-button">
              ← Back
            </Button>
          </div>

          {isPriority && (
            <div className="matching-priority-badge">⚡ Priority Session</div>
          )}

          <div className="matching-icon" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <h2 className="matching-title">We've found your match</h2>
          <p className="matching-professional-name">{matched?.specialty}</p>
          <p className="matching-subtitle">
            Specialised in <strong>{matched?.concernLabel}</strong>.{' '}
            Your responses helped us find the right fit.
          </p>

          {/* Triage summary tags */}
          <div className="matching-summary">
            {triageData.duration && (
              <span className="matching-tag">
                {DURATION_LABELS[triageData.duration] || triageData.duration}
              </span>
            )}
            {triageData.impacts?.length > 0 && (
              <span className="matching-tag">
                {triageData.impacts.length} area{triageData.impacts.length > 1 ? 's' : ''} affected
              </span>
            )}
            <span className={`matching-tag${isPriority ? ' matching-tag--priority' : ''}`}>
              {isPriority ? '⚡ Priority session' : '✓ Normal session'}
            </span>
          </div>

          <div className="matching-actions">
            <Button variant="primary" onClick={handleContinue}>
              Choose a time
            </Button>
          </div>
        </div>
      </div>
    </CalmContainer>
  )
}

export default Matching
