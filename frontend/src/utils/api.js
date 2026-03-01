import { API_BASE_URL } from './constants'

/**
 * API Client for Thee You Space Backend
 * Handles all HTTP requests with proper error handling
 */

/**
 * Fetch pricing for a session type
 * @param {string} sessionType - 'normal' or 'priority'
 * @returns {Promise<Object>} { baseAmount, platformFee, totalAmount, currency }
 */
export async function fetchPricing(sessionType) {
    const response = await fetch(`${API_BASE_URL}/booking/pricing?sessionType=${sessionType}`)

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch pricing' }))
        throw new Error(error.error || 'Failed to fetch pricing')
    }

    const data = await response.json()
    return data.pricing
}

/**
 * Fetch available time slots grouped by professional
 * @returns {Promise<Object>} { slots: Array, grouped: Object }
 */
export async function fetchSlots() {
    const response = await fetch(`${API_BASE_URL}/booking/slots`)

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch slots' }))
        throw new Error(error.error || 'Failed to fetch available slots')
    }

    const data = await response.json()
    // Return full response so Schedule can access both flat and grouped
    return data
}

/**
 * Create a booking and payment order
 * @param {Object} bookingData - { sessionType, name, email, phone, selectedSlot, paymentMethod }
 * @returns {Promise<Object>} { booking, order }
 */
export async function createBooking(bookingData) {
    const response = await fetch(`${API_BASE_URL}/booking/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create booking' }))
        throw new Error(error.error || error.errors?.[0]?.msg || 'Failed to create booking')
    }

    const data = await response.json()
    return data
}

/**
 * Verify payment after Razorpay checkout
 * @param {Object} paymentData - { orderId, paymentId, signature }
 * @returns {Promise<Object>} Updated booking
 */
export async function verifyPayment(paymentData) {
    const response = await fetch(`${API_BASE_URL}/payment/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Payment verification failed' }))
        throw new Error(error.error || 'Payment verification failed')
    }

    const data = await response.json()
    return data.booking
}

/**
 * Report payment failure
 * @param {string} orderId - Razorpay order ID
 * @returns {Promise<Object>} Updated booking
 */
export async function reportPaymentFailure(orderId) {
    const response = await fetch(`${API_BASE_URL}/payment/failure`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to report payment failure' }))
        throw new Error(error.error || 'Failed to report payment failure')
    }

    const data = await response.json()
    return data.booking
}

/**
 * Fetch professionals list (populated from Google Sheet sync)
 * @returns {Promise<Array>} Array of professional objects
 */
export async function fetchProfessionals() {
    const response = await fetch(`${API_BASE_URL}/professionals`)

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch professionals' }))
        throw new Error(error.error || 'Failed to fetch professionals')
    }

    const data = await response.json()
    return data.professionals || []
}
