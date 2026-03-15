import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES } from '../utils/constants'
import { verifyPayment, reportPaymentFailure } from '../utils/api'
import { openCheckout } from '../utils/razorpay'
import './DetailsPayment.css'

const TERMS_TEXT = `(Standard Service Agreement Apply - See Website for Details)`

function PriorityCheckout() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [slotInfo, setSlotInfo] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    isFirstTimer: null,
  })

  useEffect(() => {
    validateToken()
  }, [token])

  const validateToken = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/priority/validate/${token}`)
      const data = await resp.json()
      if (data.success) {
        setSlotInfo(data)
      } else {
        setError(data.error || 'Invalid or expired priority link.')
      }
    } catch (err) {
      setError('Connection error. Please check your internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckout = async () => {
    if (!formData.name || !formData.email || !formData.phone || formData.isFirstTimer === null) {
      setError('Please fill all required fields.')
      return
    }
    if (!consentGiven) {
        setError('Please agree to the service agreement.')
        return
    }

    setSubmitting(true)
    setError(null)

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/priority/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...formData,
          triageData: { isFirstTimer: formData.isFirstTimer }
        })
      })

      const data = await resp.json()
      if (!data.success) throw new Error(data.error || 'Checkout failed')

      await openCheckout(
        { id: data.orderId, amount: data.amount, currency: data.currency },
        { name: formData.name, email: formData.email, phone: formData.phone },
        {
          onSuccess: async (paymentData) => {
            const verified = await verifyPayment(paymentData)
            navigate(ROUTES.CONFIRMATION, { state: { booking: verified } })
          },
          onFailure: async () => {
            await reportPaymentFailure(data.orderId)
            setError('Payment failed. Please try again.')
            setSubmitting(false)
          },
          onDismiss: () => {
            setSubmitting(false)
          }
        }
      )
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) return <CalmContainer centered><p>Validating your secure priority link...</p></CalmContainer>
  if (error && !slotInfo) return <CalmContainer centered><div className="error-box"><p>{error}</p><Button onClick={() => navigate('/')}>Back to Home</Button></div></CalmContainer>

  const { slot, professional } = slotInfo

  return (
    <CalmContainer>
      <div className="details-payment priority-checkout">
        <h2 className="details-payment-title">Priority Checkout</h2>
        <p className="details-payment-subtitle">
            This is a secure, private booking page for your session with {professional.name}.
        </p>

        <div className="pricing-summary priority-pricing">
          <div className="pro-info-mini">
            {professional.photoUrl && <img src={professional.photoUrl} alt={professional.name} className="pro-mini-thumb" />}
            <div>
              <h3>{professional.name}</h3>
              <p className="pro-title-mini">{professional.title}</p>
            </div>
          </div>
          <p><strong>Scheduled Time:</strong> {slot.date} at {slot.time}</p>
          <div className="pricing-row pricing-total">
            <strong>Priority Rate:</strong>
            <strong>₹1020 <span className="pricing-tax-note">(fixed)</span></strong>
          </div>
        </div>

        <div className="details-payment-form">
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input name="name" className="form-input" value={formData.name} onChange={handleInputChange} placeholder="Full name" disabled={submitting} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" name="email" className="form-input" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" disabled={submitting} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleInputChange} placeholder="Phone number" disabled={submitting} />
          </div>

          <div className="first-timer-question">
            <p className="first-timer-label">First time at Thee You Space?</p>
            <div className="first-timer-options">
                <button type="button" className={`first-timer-btn ${formData.isFirstTimer === false ? 'selected' : ''}`} onClick={() => setFormData(p => ({ ...p, isFirstTimer: false }))} disabled={submitting}>Yes</button>
                <button type="button" className={`first-timer-btn ${formData.isFirstTimer === true ? 'selected' : ''}`} onClick={() => setFormData(p => ({ ...p, isFirstTimer: true }))} disabled={submitting}>No</button>
            </div>
          </div>
        </div>

        <div className="tc-section">
            <label className="tc-consent">
                <input type="checkbox" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} disabled={submitting} />
                <span>I agree to the service guidelines and privacy policy.</span>
            </label>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="details-payment-actions">
          <Button variant="primary" onClick={handleCheckout} disabled={submitting || !consentGiven}>
            {submitting ? 'Processing...' : 'Complete Priority Booking'}
          </Button>
        </div>
      </div>
    </CalmContainer>
  )
}

export default PriorityCheckout
