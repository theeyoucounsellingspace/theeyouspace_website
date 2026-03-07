import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import CalmContainer from '../components/CalmContainer'
import { API_BASE_URL, CONTACT_EMAIL } from '../utils/constants'
import './Reschedule.css'

const STEPS = { EMAIL: 'email', SLOTS: 'slots', DONE: 'done', CLOSED: 'closed', ERROR: 'error' }

function Reschedule() {
    const [searchParams] = useSearchParams()
    const bid = searchParams.get('bid') || ''

    const [step, setStep] = useState(STEPS.EMAIL)
    const [email, setEmail] = useState('')
    const [emailError, setEmailErr] = useState('')
    const [loading, setLoading] = useState(false)
    const [checkData, setCheckData] = useState(null)   // { name, professional, currentSlot, availableSlots }
    const [chosen, setChosen] = useState(null)   // { date, time }
    const [submitErr, setSubmitErr] = useState('')
    const [serverError, setServerError] = useState('')

    // If no bid in URL, show error immediately
    useEffect(() => {
        if (!bid) setStep(STEPS.ERROR)
    }, [bid])

    // ── Step 1: Verify email ──────────────────────────────────────────────────

    const handleVerify = async (e) => {
        e.preventDefault()
        if (!email.trim()) { setEmailErr('Please enter your email'); return }
        setEmailErr('')
        setLoading(true)
        try {
            const res = await fetch(
                `${API_BASE_URL}/booking/${encodeURIComponent(bid)}/reschedule-check?email=${encodeURIComponent(email.trim())}`,
                { method: 'GET', headers: { 'Content-Type': 'application/json' } }
            )
            const data = await res.json()
            if (!res.ok) {
                if (res.status === 403) { setEmailErr('Email does not match this booking. Please check and try again.'); return }
                if (res.status === 404) { setStep(STEPS.ERROR); setServerError('Booking not found.'); return }
                setEmailErr(data.error || 'Something went wrong. Please try again.')
                return
            }
            if (!data.eligible) {
                setCheckData(data)
                setStep(STEPS.CLOSED)
                return
            }
            setCheckData(data)
            setStep(STEPS.SLOTS)
        } catch {
            setEmailErr('Could not connect to the server. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ── Step 2: Confirm new slot ──────────────────────────────────────────────

    const handleConfirm = async () => {
        if (!chosen) return
        setLoading(true)
        setSubmitErr('')
        try {
            const res = await fetch(`${API_BASE_URL}/booking/${encodeURIComponent(bid)}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), newSlotDate: chosen.date, newSlotTime: chosen.time }),
            })
            const data = await res.json()
            if (!res.ok) {
                if (res.status === 409) { setSubmitErr('That slot was just taken. Please pick another.'); setChosen(null); return }
                setSubmitErr(data.error || 'Something went wrong. Please try again.')
                return
            }
            setStep(STEPS.DONE)
        } catch {
            setSubmitErr('Could not connect. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    if (step === STEPS.ERROR) return (
        <CalmContainer>
            <div className="rs-wrap">
                <p className="rs-eyebrow">Reschedule</p>
                <h1 className="rs-title">Link not valid</h1>
                <p className="rs-body">This reschedule link is invalid or has expired. Please use the link from your original booking confirmation email.</p>
                <a className="rs-contact" href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
            </div>
        </CalmContainer>
    )

    if (step === STEPS.EMAIL) return (
        <CalmContainer>
            <div className="rs-wrap">
                <p className="rs-eyebrow">Reschedule</p>
                <h1 className="rs-title">Let's move your session</h1>
                <p className="rs-body">Enter the email address you used when booking to continue.</p>
                <form className="rs-form" onSubmit={handleVerify} noValidate>
                    <input
                        id="rs-email"
                        type="email"
                        className={`rs-input ${emailError ? 'rs-input--err' : ''}`}
                        placeholder="Your email address"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={loading}
                    />
                    {emailError && <p className="rs-field-err">{emailError}</p>}
                    <button className="rs-btn-primary" type="submit" disabled={loading}>
                        {loading ? 'Checking…' : 'Continue →'}
                    </button>
                </form>
            </div>
        </CalmContainer>
    )

    if (step === STEPS.CLOSED) return (
        <CalmContainer>
            <div className="rs-wrap">
                <p className="rs-eyebrow">Reschedule</p>
                <h1 className="rs-title">Window has closed</h1>
                <p className="rs-body">
                    The 24-hour reschedule window for your session on{' '}
                    <strong>{checkData?.currentSlot?.date}</strong> at{' '}
                    <strong>{checkData?.currentSlot?.time}</strong> has passed.
                </p>
                <p className="rs-body">Please contact us directly and we'll do our best to help.</p>
                <a className="rs-contact" href={`mailto:${CONTACT_EMAIL}`}>Email us →</a>
            </div>
        </CalmContainer>
    )

    if (step === STEPS.SLOTS) return (
        <CalmContainer>
            <div className="rs-wrap rs-wrap--wide">
                <p className="rs-eyebrow">Reschedule</p>
                <h1 className="rs-title">Pick a new slot</h1>
                <div className="rs-current">
                    <span className="rs-current-label">Current session</span>
                    <span className="rs-current-val">
                        {checkData.currentSlot.date} · {checkData.currentSlot.time}
                        {checkData.professional ? ` · ${checkData.professional}` : ''}
                    </span>
                </div>

                {checkData.availableSlots?.length === 0 ? (
                    <p className="rs-body rs-body--center">
                        No other slots are available for your counsellor right now.
                        Please <a className="rs-link" href={`mailto:${CONTACT_EMAIL}`}>contact us</a> to arrange a time.
                    </p>
                ) : (
                    <>
                        <p className="rs-body">Available slots with <strong>{checkData.professional}</strong>:</p>
                        <div className="rs-slot-grid">
                            {checkData.availableSlots.map(s => (
                                <button
                                    key={s.id}
                                    className={`rs-slot ${chosen?.date === s.date && chosen?.time === s.time ? 'rs-slot--chosen' : ''}`}
                                    onClick={() => setChosen({ date: s.date, time: s.time })}
                                >
                                    <span className="rs-slot-date">{s.date}</span>
                                    <span className="rs-slot-time">{s.time}</span>
                                </button>
                            ))}
                        </div>

                        {submitErr && <p className="rs-field-err rs-field-err--center">{submitErr}</p>}

                        <button
                            className="rs-btn-primary"
                            onClick={handleConfirm}
                            disabled={!chosen || loading}
                        >
                            {loading ? 'Confirming…' : chosen ? `Confirm — ${chosen.date} at ${chosen.time}` : 'Select a slot above'}
                        </button>
                    </>
                )}
            </div>
        </CalmContainer>
    )

    if (step === STEPS.DONE) return (
        <CalmContainer>
            <div className="rs-wrap">
                <div className="rs-success-icon">✓</div>
                <p className="rs-eyebrow">Done</p>
                <h1 className="rs-title">Session rescheduled</h1>
                <p className="rs-body">
                    Your session has been moved to <strong>{chosen?.date}</strong> at <strong>{chosen?.time}</strong>.
                    A confirmation has been sent to your email.
                </p>
            </div>
        </CalmContainer>
    )

    return null
}

export default Reschedule
