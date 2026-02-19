import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES, SESSION_TYPES } from '../utils/constants'
import { fetchPricing, createBooking, verifyPayment, reportPaymentFailure } from '../utils/api'
import { openCheckout } from '../utils/razorpay'
import './DetailsPayment.css'

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
    paymentMethod: 'card'
  })

  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(true)
  const [pricingError, setPricingError] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Redirect if no slot selected
  useEffect(() => {
    if (!selectedSlot) {
      navigate(ROUTES.SCHEDULE)
    }
  }, [selectedSlot, navigate])

  // Fetch pricing on mount
  useEffect(() => {
    loadPricing()
  }, [])

  const loadPricing = async () => {
    setLoadingPricing(true)
    setPricingError(null)

    try {
      // Use session type from triage (normal or priority). Default to normal if not set.
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
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Please enter your name')
      return false
    }

    if (!formData.email.trim()) {
      setError('Please enter your email')
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }

    return true
  }

  const handleContinue = async () => {
    setError(null)

    if (!validateForm()) {
      return
    }

    // Prevent double submission
    if (submitting) {
      return
    }

    setSubmitting(true)

    try {
      // Create booking and payment order
      const sessionType = triageData?.sessionType || SESSION_TYPES.NORMAL
      const bookingData = {
        sessionType,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        selectedSlot: selectedSlot,
        paymentMethod: formData.paymentMethod,
        professional: professional, // Include assigned professional
        triageData: triageData, // Include triage responses
      }

      console.log('Creating booking...')
      const { booking, order } = await createBooking(bookingData)
      console.log('Booking created:', booking.id, 'Order:', order.id)

      // Open Razorpay checkout
      await openCheckout(
        order,
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        },
        {
          onSuccess: async (paymentData) => {
            console.log('Payment successful, verifying...')
            try {
              const verifiedBooking = await verifyPayment(paymentData)
              console.log('Payment verified, booking confirmed:', verifiedBooking.id)

              // Navigate to confirmation with booking details
              navigate(ROUTES.CONFIRMATION, {
                state: { booking: verifiedBooking }
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
            console.log('Payment cancelled by user')
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

  if (!selectedSlot) {
    return null
  }

  return (
    <CalmContainer>
      <div className="details-payment">
        <h2 className="details-payment-title">A few details</h2>
        <p className="details-payment-subtitle">
          We'll use this to confirm your session and send you a reminder.
        </p>

        {loadingPricing && (
          <div className="pricing-loading">
            <p>Loading pricing...</p>
          </div>
        )}

        {pricingError && (
          <div className="pricing-error">
            <p className="error-message">{pricingError}</p>
            <Button variant="secondary" onClick={loadPricing}>
              Retry
            </Button>
          </div>
        )}

        {!loadingPricing && !pricingError && pricing && (
          <>
            <div className="pricing-summary">
              <h3>Session Details</h3>
              <p><strong>Date:</strong> {selectedSlot.date}</p>
              <p><strong>Time:</strong> {selectedSlot.time}</p>
              {professional && (
                <p><strong>Professional:</strong> {professional.name}</p>
              )}
              <div className="pricing-breakdown">
                <div className="pricing-row">
                  <span>Session fee:</span>
                  <span>₹{pricing.baseAmount.toFixed(2)}</span>
                </div>
                <div className="pricing-row">
                  <span>Processing fee:</span>
                  <span>₹{pricing.platformFee.toFixed(2)}</span>
                </div>
                <div className="pricing-row pricing-total">
                  <strong>Total:</strong>
                  <strong>₹{pricing.totalAmount.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="details-payment-form">
              <div className="form-group">
                <label htmlFor="name" className="form-label">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Your name"
                  disabled={submitting}
                  required
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your.email@example.com"
                  disabled={submitting}
                  required
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">Phone (optional)</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="form-input"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Your phone number"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment method</label>
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={formData.paymentMethod === 'card'}
                      onChange={handleInputChange}
                      disabled={submitting}
                    />
                    <div className="payment-option-content">
                      <span className="payment-option-title">Debit / Credit Card</span>
                      <span className="payment-option-subtitle">Visa, Mastercard, RuPay</span>
                    </div>
                  </label>
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="upi"
                      checked={formData.paymentMethod === 'upi'}
                      onChange={handleInputChange}
                      disabled={submitting}
                    />
                    <div className="payment-option-content">
                      <span className="payment-option-title">UPI</span>
                      <span className="payment-option-subtitle">PhonePe, Google Pay, Paytm</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="payment-note">
                <p>Your payment information is secure and encrypted. We'll process your payment only after you confirm your session details.</p>
              </div>
            </div>

            {error && (
              <div className="error-message" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <div className="details-payment-actions">
              <Button
                variant="primary"
                onClick={handleContinue}
                disabled={submitting}
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
