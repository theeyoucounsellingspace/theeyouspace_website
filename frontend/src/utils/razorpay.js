import { RAZORPAY_KEY_ID } from './constants'

/**
 * Razorpay Checkout Integration
 * Handles loading Razorpay script and opening checkout modal
 */

/**
 * Load Razorpay checkout script
 * @returns {Promise<boolean>} True if loaded successfully
 */
export function loadRazorpayScript() {
    return new Promise((resolve) => {
        // Check if already loaded
        if (window.Razorpay) {
            resolve(true)
            return
        }

        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

/**
 * Open Razorpay checkout modal
 * @param {Object} orderData - { id, amount, currency, key }
 * @param {Object} customerData - { name, email, phone }
 * @param {Object} handlers - { onSuccess, onFailure, onDismiss }
 * @returns {Promise<void>}
 */
export async function openCheckout(orderData, customerData, handlers) {
    // Load Razorpay script if not already loaded
    const loaded = await loadRazorpayScript()
    if (!loaded) {
        throw new Error('Failed to load Razorpay checkout')
    }

    const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Thee You Space',
        description: 'Counselling Session Booking',
        order_id: orderData.id,
        prefill: {
            name: customerData.name,
            email: customerData.email,
            contact: customerData.phone || '',
        },
        theme: {
            color: '#A68B6F', // Primary color from theme
        },
        handler: function (response) {
            // Payment successful
            handlers.onSuccess({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
            })
        },
        modal: {
            ondismiss: function () {
                // User closed the modal
                handlers.onDismiss?.()
            },
            escape: true,
            backdropclose: false,
        },
    }

    const razorpay = new window.Razorpay(options)

    razorpay.on('payment.failed', function (response) {
        // Payment failed
        handlers.onFailure?.(response.error)
    })

    razorpay.open()
}
