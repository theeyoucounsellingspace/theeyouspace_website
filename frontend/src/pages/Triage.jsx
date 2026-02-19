import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Card from '../components/Card'
import CalmContainer from '../components/CalmContainer'
import { ROUTES } from '../utils/constants'
import './Triage.css'

// ─── Step 1: What's the primary concern ────────────────────────────────────
const CONCERNS = [
  { id: 'anxiety_stress', icon: '🌊', label: 'Anxiety & Stress', desc: 'Constant worry, racing thoughts, panic, overwhelm' },
  { id: 'depression_mood', icon: '🌧️', label: 'Low Mood & Depression', desc: 'Feeling empty, hopeless, loss of interest or motivation' },
  { id: 'relationship_family', icon: '🤝', label: 'Relationships & Family', desc: 'Conflict, communication issues, breakups, family dynamics' },
  { id: 'work_academics', icon: '💼', label: 'Work & Academics', desc: 'Burnout, performance pressure, career decisions, student stress' },
  { id: 'grief_loss', icon: '🕯️', label: 'Grief & Loss', desc: 'Bereavement, loss of a relationship, major life change' },
  { id: 'trauma_regret', icon: '🪞', label: 'Trauma & Regret', desc: 'Past events, guilt, unresolved experiences, moving forward' },
  { id: 'self_identity', icon: '🌱', label: 'Self & Identity', desc: 'Self-worth, purpose, personal growth, life direction' },
  { id: 'general', icon: '💬', label: 'Not Sure Yet', desc: 'Exploring, or just need someone to talk to' },
]

// ─── Step 2: How long has this been going on ───────────────────────────────
const DURATIONS = [
  { id: 'days', label: 'Just started', desc: 'A few days or this week' },
  { id: 'weeks', label: 'A few weeks', desc: '2–6 weeks' },
  { id: 'months', label: 'A few months', desc: '2–6 months' },
  { id: 'longer', label: 'Over 6 months', desc: 'This has been going on a long time' },
]

// ─── Step 3: Impact areas (multi-select) ───────────────────────────────────
const IMPACT_AREAS = [
  { id: 'sleep', label: 'Sleep', desc: 'Sleeping too much, too little, or restlessly' },
  { id: 'work_school', label: 'Work / Studies', desc: 'Hard to concentrate, missing deadlines' },
  { id: 'relationships', label: 'Relationships', desc: 'Withdrawing, conflict with people close to you' },
  { id: 'daily_routine', label: 'Daily Life', desc: 'Basic tasks feel difficult or pointless' },
  { id: 'physical', label: 'Body & Health', desc: 'Headaches, fatigue, appetite changes, tension' },
  { id: 'mood', label: 'Mood', desc: 'Irritable, numb, sad, or emotionally swinging' },
]

// ─── Step 4: Previous experience ───────────────────────────────────────────
const PREVIOUS = [
  { id: 'first_time', label: 'First time', desc: 'I have never spoken to a counsellor before' },
  { id: 'helped', label: 'Yes, it helped', desc: 'I have, and I found it useful' },
  { id: 'not_helped', label: 'Yes, but mixed', desc: 'I have, but I did not find it very helpful' },
  { id: 'prefer_not', label: 'Prefer not to say', desc: '' },
]

// ─── Step 5: Urgency / session type ────────────────────────────────────────
const URGENCY = [
  {
    id: 'routine',
    label: 'Routine check-in',
    desc: 'I want to start talking — nothing urgent right now',
    sessionType: 'normal',
    badge: null,
  },
  {
    id: 'moderate',
    label: 'Need support this week',
    desc: 'This is affecting my daily life and I need help',
    sessionType: 'normal',
    badge: null,
  },
  {
    id: 'priority',
    label: 'Priority — sooner the better',
    desc: 'I need to speak to someone as soon as possible',
    sessionType: 'priority',
    badge: '⚡ Priority',
  },
  {
    id: 'urgent',
    label: 'Crisis — immediate support',
    desc: 'I am in a crisis situation and need immediate help',
    sessionType: 'priority',
    badge: '🔴 Immediate',
  },
]

const TOTAL_STEPS = 5

function ProgressBar({ step }) {
  return (
    <div className="triage-progress" role="progressbar" aria-valuenow={step} aria-valuemax={TOTAL_STEPS}>
      <div className="triage-progress-track">
        <div
          className="triage-progress-fill"
          style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
        />
      </div>
      <div className="triage-progress-dots">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`triage-progress-dot ${i + 1 <= step ? 'active' : ''} ${i + 1 === step ? 'current' : ''}`}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>
      <p className="triage-progress-label">Step {step} of {TOTAL_STEPS}</p>
    </div>
  )
}

function Triage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Accumulated answers
  const [concern, setConcern] = useState(null)
  const [duration, setDuration] = useState(null)
  const [impacts, setImpacts] = useState([])
  const [previous, setPrevious] = useState(null)

  // Navigation helpers
  const goBack = () => {
    if (step === 1) navigate(ROUTES.HOME)
    else { setStep(s => s - 1); window.scrollTo(0, 0) }
  }

  const advance = () => { setStep(s => s + 1); window.scrollTo(0, 0) }

  // ── Step 1 handler ─────────────────────────────────────────────────────
  const handleConcern = (id) => {
    setConcern(id)
    setTimeout(advance, 280)
  }

  // ── Step 2 handler ─────────────────────────────────────────────────────
  const handleDuration = (id) => {
    setDuration(id)
    setTimeout(advance, 280)
  }

  // ── Step 3 handler (multi-select) ──────────────────────────────────────
  const toggleImpact = (id) => {
    setImpacts(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // ── Step 4 handler ─────────────────────────────────────────────────────
  const handlePrevious = (id) => {
    setPrevious(id)
    setTimeout(advance, 280)
  }

  // ── Step 5 handler — final step, route based on urgency ────────────────
  const handleUrgency = (option) => {
    const triageData = {
      concern,
      duration,
      impacts,
      previousCounselling: previous,
      urgencyLevel: option.id,
      sessionType: option.sessionType,
    }

    if (option.id === 'urgent') {
      // Crisis → Priority/Safety route — WhatsApp + immediate help
      navigate(ROUTES.PRIORITY, { state: { triageData } })
    } else {
      navigate(ROUTES.MATCHING, { state: { triageData } })
    }
  }

  return (
    <CalmContainer>
      <div className="triage">
        {/* Fixed back button */}
        <div className="triage-back">
          <Button variant="secondary" onClick={goBack} className="back-button">
            ← Back
          </Button>
        </div>

        <ProgressBar step={step} />

        {/* ── Step 1: Primary concern ── */}
        {step === 1 && (
          <>
            <div className="triage-header">
              <h2 className="triage-title">What brings you here today?</h2>
              <p className="triage-subtitle">
                Choose the area that best describes what you're going through.
              </p>
            </div>
            <div className="triage-options triage-options--grid">
              {CONCERNS.map(c => (
                <Card
                  key={c.id}
                  selected={concern === c.id}
                  onClick={() => handleConcern(c.id)}
                  className="triage-option triage-option--icon"
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleConcern(c.id)}
                  aria-label={c.label}
                >
                  <span className="option-icon" aria-hidden="true">{c.icon}</span>
                  <div className="option-label">{c.label}</div>
                  <div className="option-description">{c.desc}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Duration ── */}
        {step === 2 && (
          <>
            <div className="triage-header">
              <h2 className="triage-title">How long has this been going on?</h2>
              <p className="triage-subtitle">
                Knowing the timeline helps us understand your experience better.
              </p>
            </div>
            <div className="triage-options">
              {DURATIONS.map(d => (
                <Card
                  key={d.id}
                  selected={duration === d.id}
                  onClick={() => handleDuration(d.id)}
                  className="triage-option"
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleDuration(d.id)}
                  aria-label={d.label}
                >
                  <div className="option-label">{d.label}</div>
                  <div className="option-description">{d.desc}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ── Step 3: Impact areas (multi-select) ── */}
        {step === 3 && (
          <>
            <div className="triage-header">
              <h2 className="triage-title">How is it affecting you?</h2>
              <p className="triage-subtitle">
                Select all that apply. You can pick more than one.
              </p>
            </div>
            <div className="triage-options triage-options--grid">
              {IMPACT_AREAS.map(area => (
                <Card
                  key={area.id}
                  selected={impacts.includes(area.id)}
                  onClick={() => toggleImpact(area.id)}
                  className={`triage-option triage-option--checkbox ${impacts.includes(area.id) ? 'selected' : ''}`}
                  role="checkbox"
                  aria-checked={impacts.includes(area.id)}
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleImpact(area.id)}
                >
                  <div className="option-check" aria-hidden="true">
                    {impacts.includes(area.id) ? '✓' : ''}
                  </div>
                  <div>
                    <div className="option-label">{area.label}</div>
                    <div className="option-description">{area.desc}</div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="triage-continue">
              <Button variant="primary" onClick={advance}>
                {impacts.length === 0 ? 'Skip for now' : `Continue (${impacts.length} selected)`}
              </Button>
            </div>
          </>
        )}

        {/* ── Step 4: Previous counselling ── */}
        {step === 4 && (
          <>
            <div className="triage-header">
              <h2 className="triage-title">Have you spoken to a counsellor before?</h2>
              <p className="triage-subtitle">
                This helps us understand where you are in your journey.
              </p>
            </div>
            <div className="triage-options">
              {PREVIOUS.map(p => (
                <Card
                  key={p.id}
                  selected={previous === p.id}
                  onClick={() => handlePrevious(p.id)}
                  className="triage-option"
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handlePrevious(p.id)}
                  aria-label={p.label}
                >
                  <div className="option-label">{p.label}</div>
                  {p.desc && <div className="option-description">{p.desc}</div>}
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ── Step 5: Urgency ── */}
        {step === 5 && (
          <>
            <div className="triage-header">
              <h2 className="triage-title">How soon do you need support?</h2>
              <p className="triage-subtitle">
                This helps us match you to the right type of session.
              </p>
            </div>
            <div className="triage-options">
              {URGENCY.map(u => (
                <Card
                  key={u.id}
                  onClick={() => handleUrgency(u)}
                  className={`triage-option triage-option--urgency ${u.id === 'urgent' ? 'triage-option--crisis' : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleUrgency(u)}
                  aria-label={u.label}
                >
                  <div className="option-urgency-row">
                    <div className="option-label">{u.label}</div>
                    {u.badge && <span className="option-badge">{u.badge}</span>}
                  </div>
                  <div className="option-description">{u.desc}</div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </CalmContainer>
  )
}

export default Triage
