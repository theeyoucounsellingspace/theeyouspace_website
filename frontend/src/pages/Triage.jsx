import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '../utils/constants'
import './Triage.css'

// ── Step 1: Primary concern ──────────────────────────────────────────────────
const CONCERNS = [
  { id: 'anxiety_stress', label: 'Anxiety & Stress', desc: 'Worry, racing thoughts, panic' },
  { id: 'depression_mood', label: 'Low Mood', desc: 'Feeling empty, low, or unmotivated' },
  { id: 'relationship_family', label: 'Relationships & Family', desc: 'Conflict, communication, dynamics' },
  { id: 'work_academics', label: 'Work & Academics', desc: 'Burnout, pressure, career decisions' },
  { id: 'grief_loss', label: 'Grief & Loss', desc: 'Bereavement, endings, big changes' },
  { id: 'trauma_regret', label: 'Trauma & Regret', desc: 'Past events, guilt, moving forward' },
  { id: 'self_identity', label: 'Self & Identity', desc: 'Self-worth, purpose, growth' },
  { id: 'general', label: 'Not sure yet', desc: 'Exploring, or just need to talk' },
]

// ── Step 2: Duration ─────────────────────────────────────────────────────────
const DURATIONS = [
  { id: 'days', label: 'Just started', desc: 'A few days or this week' },
  { id: 'weeks', label: 'A few weeks', desc: '2–6 weeks' },
  { id: 'months', label: 'A few months', desc: '2–6 months' },
  { id: 'longer', label: 'Over 6 months', desc: 'This has been going on a long time' },
]

// ── Step 3: Impact areas (multi-select) ──────────────────────────────────────
const IMPACTS = [
  { id: 'sleep', label: 'Sleep' },
  { id: 'work_school', label: 'Work or studies' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'daily_routine', label: 'Daily routine' },
  { id: 'physical', label: 'Body & health' },
  { id: 'mood', label: 'My mood' },
]

// Pre-filled WhatsApp message — number stays in the URL, never shown on screen
const WA_LINK = `${import.meta.env.VITE_WHATSAPP_LINK || 'https://wa.me/917358154022'}?text=${encodeURIComponent('Hi, I need to speak with a counsellor urgently.')}`

const TOTAL = 4

function Triage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialUrgency = location.state?.urgency || 'normal'
  const [step, setStep] = useState(1)
  const [concern, setConcern] = useState(null)
  const [duration, setDuration] = useState(null)
  const [impacts, setImpacts] = useState([])
  // Whether the user has clicked "Can't even wait?" — reveals WA button
  const [showWaGate, setShowWaGate] = useState(false)

  const goBack = () => {
    if (step === 1) navigate(ROUTES.HOME)
    else { setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }

  const next = () => { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const pick1 = (id) => { setConcern(id); setTimeout(next, 240) }
  const pick2 = (id) => { setDuration(id); setTimeout(next, 240) }

  const toggleImpact = (id) =>
    setImpacts(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])

  const handleUrgency = (sessionType) => {
    const triageData = {
      concern,
      duration,
      impacts,
      urgencyLevel: sessionType,
      sessionType,
    }
    // Go straight to Schedule — all professionals shown by availability.
    // triageData travels with the booking so the counsellor is prepared.
    navigate(ROUTES.SCHEDULE, { state: { triageData } })
  }

  return (
    <div className="triage-page">
      {/* Back */}
      <button className="triage-back" onClick={goBack} aria-label="Go back">←</button>

      {/* Progress dots */}
      <div className="triage-dots" role="progressbar" aria-valuenow={step} aria-valuemax={TOTAL}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={`triage-dot ${i + 1 <= step ? 'done' : ''} ${i + 1 === step ? 'current' : ''}`} />
        ))}
      </div>

      <div className="triage-content" key={step}>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <>
            <h2 className="triage-q">What brings you here today?</h2>
            <p className="triage-hint">Choose the area that feels closest to what you're experiencing.</p>
            <div className="triage-list">
              {CONCERNS.map(c => (
                <button
                  key={c.id}
                  className={`triage-option ${concern === c.id ? 'selected' : ''}`}
                  onClick={() => pick1(c.id)}
                >
                  <span className="opt-label">{c.label}</span>
                  <span className="opt-desc">{c.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <>
            <h2 className="triage-q">How long has this been going on?</h2>
            <p className="triage-hint">Knowing the timeline helps us understand your situation.</p>
            <div className="triage-list">
              {DURATIONS.map(d => (
                <button
                  key={d.id}
                  className={`triage-option ${duration === d.id ? 'selected' : ''}`}
                  onClick={() => pick2(d.id)}
                >
                  <span className="opt-label">{d.label}</span>
                  <span className="opt-desc">{d.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 3 — multi-select ── */}
        {step === 3 && (
          <>
            <h2 className="triage-q">How is it affecting you?</h2>
            <p className="triage-hint">Select all that apply — you can pick more than one.</p>
            <div className="triage-chips">
              {IMPACTS.map(area => (
                <button
                  key={area.id}
                  className={`triage-chip ${impacts.includes(area.id) ? 'selected' : ''}`}
                  onClick={() => toggleImpact(area.id)}
                  role="checkbox"
                  aria-checked={impacts.includes(area.id)}
                >
                  {area.label}
                </button>
              ))}
            </div>
            <button className="triage-continue" onClick={next}>
              {impacts.length === 0 ? 'Skip for now' : 'Continue  →'}
            </button>
          </>
        )}

        {/* ── Step 4 — urgency ── */}
        {step === 4 && (
          <>
            <h2 className="triage-q">
              {initialUrgency === 'priority' ? "Since you need support soon..." : "How soon do you need support?"}
            </h2>
            <p className="triage-hint">Both paths lead to a real session with a trained counsellor.</p>

            {/* Option 1 — Standard */}
            <button
              className="triage-option urgency-option"
              onClick={() => handleUrgency('normal')}
            >
              <div className="urgency-header">
                <span className="opt-label">At my convenience</span>
                <span className="urgency-badge urgency-badge--standard">Standard rate</span>
              </div>
              <span className="opt-desc">Find a time that fits into your week. A slot will be confirmed once you book.</span>
            </button>

            {/* Option 2 — Priority */}
            <button
              className={`triage-option urgency-option urgency-option--priority ${initialUrgency === 'priority' ? 'recommended' : ''}`}
              onClick={() => handleUrgency('priority')}
            >
              <div className="urgency-header">
                <span className="opt-label">I need to speak with someone sooner</span>
                <span className="urgency-badge urgency-badge--priority">Higher rate · Faster</span>
              </div>
              <span className="opt-desc">
                {initialUrgency === 'priority'
                  ? "As you requested, we'll move you to the front of the queue and reach out quickly to confirm your slot."
                  : "Move up the queue. We'll reach out quickly to confirm your slot."}
              </span>
              {initialUrgency === 'priority' && <span className="recommended-tag">Requested by you</span>}
            </button>

            {/* WhatsApp gate — repositioned as "Help/Emergency" instead of "Bypass" */}
            <div className="urgency-wa-gate">
              {!showWaGate ? (
                <button
                  className="urgency-wa-trigger"
                  onClick={() => setShowWaGate(true)}
                  aria-expanded="false"
                >
                  Technical issues or need help? →
                </button>
              ) : (
                <div className="urgency-wa-panel" role="region" aria-label="WhatsApp contact">
                  <p className="urgency-wa-text">
                    Facing trouble with the website? Send us a "Hi" on WhatsApp and we'll help you out manually.
                  </p>
                  <a
                    href={WA_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="urgency-wa-btn"
                    aria-label="Open WhatsApp to message us"
                  >
                    Help via WhatsApp
                  </a>
                  <p className="urgency-wa-disclaimer">
                    This is not a crisis helpline. If you are in immediate danger, please call 112.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default Triage
