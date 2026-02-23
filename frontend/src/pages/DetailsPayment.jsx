import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES, SESSION_TYPES } from '../utils/constants'
import { fetchPricing, createBooking, verifyPayment, reportPaymentFailure } from '../utils/api'
import { openCheckout } from '../utils/razorpay'
import './DetailsPayment.css'

// ─── Terms & Conditions text (from client's service agreement) ───────────────
const TERMS_TEXT = `1. Therapeutic Approach
Therapy is a collaborative partnership. Our professionals use evidence-based practices to help you navigate life's challenges. Your active participation and openness influence the effectiveness of therapy.

2. Privacy & Confidentiality
All information shared is strictly confidential, except in specific cases: imminent risk of harm to self or others; court-ordered subpoena; or suspected abuse or neglect of a child or vulnerable adult. We will discuss necessary disclosures with you first, prioritising safety.

3. Emergency Support
Thee You Space is an outpatient service. For crises, please contact national helplines or visit the nearest emergency room.

4. Session Structure
Sessions are 50–60 minutes for individual sessions and up to 90 minutes for specialised sessions. Sessions end at the scheduled time regardless of start time.

5. Financial Terms
Pre-payment is required for booking. Cancellations require 24-hour notice for rescheduling. No-shows or late cancellations are subject to the full session fee.

6. Records & Supervision
Your therapist maintains secure, encrypted session notes. Anonymised case discussions may occur in clinical supervision to ensure quality of care.

7. Referrals
If your needs exceed talk therapy or clinical therapy, we will provide referrals to appropriate specialised professionals.

8. Governing Law
This agreement is governed by Indian law. Disputes should be addressed first with your therapist or our management team at theeyoucounsellingspace@gmail.com.`

function DetailsPayment() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedSlot = location.state?.selectedSlot
  const professional = location.state?.professional
  const triageData = location.state?.triageData

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    paymentMethod: 'card',
    isFirstTimer: false,   // "Have you been to therapy before?" — flipped: true = never been
  })

  const [consentGiven, setConsentGiven] = useState(false)

  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(true)
  const [pricingError, setPricingError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!selectedSlot) navigate(ROUTES.SCHEDULE)
  }, [selectedSlot, navigate])

  useEffect(() => { loadPricing() }, [])

  const loadPricing = async () => {
    setLoadingPricing(true)
    setPricingError(null)
    try {
      const sessionType = triageData?.sessionType || SESSION_TYPES.NORMAL
      const pricingData = await fetchPricing(sessionType)
      setPricing(pricingData)
    } catch (err) {
      console.error('Error loading pricing:', err)
      setPricingError(err.message)
    } finally {
      setLoadingPricing(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) { setError('Please enter your name'); return false }
    if (!formData.email.trim()) { setError('Please enter your email'); return false }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) { setError('Please enter a valid email address'); return false }
    if (!consentGiven) { setError('Please read and agree to the Service Agreement to continue'); return false }
    return true
  }

  const handleContinue = async () => {
    setError(null)
    if (!validateForm() || submitting) return
    setSubmitting(true)

    try {
      const sessionType = triageData?.sessionType || SESSION_TYPES.NORMAL
      const bookingData = {
        sessionType,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        selectedSlot,
        paymentMethod: formData.paymentMethod,
        professional,
        triageData: {
          ...triageData,
          isFirstTimer: formData.isFirstTimer,
        },
      }

      const { booking, order } = await createBooking(bookingData)

      await openCheckout(
        order,
        { name: formData.name, email: formData.email, phone: formData.phone },
        {
          onSuccess: async (paymentData) => {
            try {
              const verifiedBooking = await verifyPayment(paymentData)
              navigate(ROUTES.CONFIRMATION, {
                state: {
                  booking: verifiedBooking,
                  isFirstTimer: formData.isFirstTimer,
                }
              })
            } catch (verificationError) {
              console.error('Payment verification failed:', verificationError)
              setError('Payment verification failed. Please contact support with your payment details.')
              setSubmitting(false)
            }
          },
          onFailure: async (errorData) => {
            console.error('Payment failed:', errorData)
            await reportPaymentFailure(order.id)
            setError('Payment failed. You can try again.')
            setSubmitting(false)
          },
          onDismiss: () => {
            setError('Payment was cancelled. You can try again when ready.')
            setSubmitting(false)
          },
        }
      )
    } catch (err) {
      console.error('Error during booking:', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (!selectedSlot) return null

  return (
    <CalmContainer>
      <div className="details-payment">
        <h2 className="details-payment-title">A few details</h2>
        <p className="details-payment-subtitle">
          We'll use this to confirm your session and send you a reminder.
        </p>

        {loadingPricing && <div className="pricing-loading"><p>Loading pricing...</p></div>}

        {pricingError && (
          <div className="pricing-error">
            <p className="error-message">{pricingError}</p>
            <Button variant="secondary" onClick={loadPricing}>Retry</Button>
          </div>
        )}

        {!loadingPricing && !pricingError && pricing && (
          <>
            {/* Session summary */}
            <div className="pricing-summary">
              <h3>Session Details</h3>
              <p><strong>Date:</strong> {selectedSlot.date}</p>
              <p><strong>Time:</strong> {selectedSlot.time}</p>
              {professional && <p><strong>Professional:</strong> {professional.name || professional}</p>}
              <div className="pricing-breakdown">
                <div className="pricing-row">
                  <span>Session fee:</span><span>₹{pricing.baseAmount.toFixed(2)}</span>
                </div>
                <div className="pricing-row">
                  <span>Processing fee:</span><span>₹{pricing.platformFee.toFixed(2)}</span>
                </div>
                <div className="pricing-row pricing-total">
                  <strong>Total:</strong><strong>₹{pricing.totalAmount.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Personal details */}
            <div className="details-payment-form">
              <div className="form-group">
                <label htmlFor="name" className="form-label">Name</label>
                <input type="text" id="name" name="name" className="form-input"
                  value={formData.name} onChange={handleInputChange}
                  placeholder="Your name" disabled={submitting} required aria-required="true" />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <input type="email" id="email" name="email" className="form-input"
                  value={formData.email} onChange={handleInputChange}
                  placeholder="your.email@example.com" disabled={submitting} required aria-required="true" />
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">Phone (optional)</label>
                <input type="tel" id="phone" name="phone" className="form-input"
                  value={formData.phone} onChange={handleInputChange}
                  placeholder="Your phone number" disabled={submitting} />
              </div>

              {/* First-timer toggle */}
              <label className="first-timer-toggle">
                <input
                  type="checkbox"
                  name="isFirstTimer"
                  checked={formData.isFirstTimer}
                  onChange={handleInputChange}
                  disabled={submitting}
                />
                <span>This is my first time seeing a counsellor</span>
              </label>

              {/* Payment method */}
              <div className="form-group">
                <label className="form-label">Payment method</label>
                <div className="payment-options">
                  <label className="payment-option">
                    <input type="radio" name="paymentMethod" value="card"
                      checked={formData.paymentMethod === 'card'} onChange={handleInputChange} disabled={submitting} />
                    <div className="payment-option-content">
                      <span className="payment-option-title">Debit / Credit Card</span>
                      <span className="payment-option-subtitle">Visa, Mastercard, RuPay</span>
                    </div>
                  </label>
                  <label className="payment-option">
                    <input type="radio" name="paymentMethod" value="upi"
                      checked={formData.paymentMethod === 'upi'} onChange={handleInputChange} disabled={submitting} />
                    <div className="payment-option-content">
                      <span className="payment-option-title">UPI</span>
                      <span className="payment-option-subtitle">PhonePe, Google Pay, Paytm</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Terms & Conditions ── */}
            <div className="tc-section">
              <h4 className="tc-title">Client Service Agreement</h4>
              <div className="tc-scroll" tabIndex="0" role="region" aria-label="Terms and Conditions">
                <pre className="tc-text">{TERMS_TEXT}</pre>
              </div>
              <label className="tc-consent">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentGiven}
                  onChange={e => setConsentGiven(e.target.checked)}
                  disabled={submitting}
                  aria-required="true"
                />
                <span>
                  I have read and understood the Client Service Agreement, and I consent to
                  engage in therapy under these guidelines. I understand I may withdraw at any time.
                </span>
              </label>
            </div>

            {error && (
              <div className="error-message" role="alert" aria-live="polite">{error}</div>
            )}

            <div className="details-payment-actions">
              <Button
                variant="primary"
                onClick={handleContinue}
                disabled={submitting || !consentGiven}
              >
                {submitting ? 'Processing...' : 'Continue to payment'}
              </Button>
            </div>
          </>
        )}
      </div>
    </CalmContainer>
  )
}

export default DetailsPayment
