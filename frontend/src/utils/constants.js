export const APP_NAME = 'Thee You Space'
export const APP_TAGLINE = 'where You Open Up'

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

// Session Types
export const SESSION_TYPES = {
  NORMAL: 'normal',
  PRIORITY: 'priority',
}

export const ROUTES = {
  HOME: '/',
  TRIAGE: '/triage',
  MATCHING: '/matching',
  SCHEDULE: '/schedule',
  DETAILS_PAYMENT: '/details-payment',
  CONFIRMATION: '/confirmation',
  PRIORITY: '/priority',
  SAFETY: '/safety',
  ABOUT: '/about',
}

// Updated with Indian Emergency Contacts
export const EMERGENCY_CONTACTS = [
  { name: 'KIRAN (Mental Health Rehabilitation)', number: '1800-599-0019' },
  { name: 'Vandrevala Foundation', number: '1860-266-2345 / 1800-233-3330' },
  { name: 'Emergency Services (India)', number: '112' },
]

export const WHATSAPP_LINK = 'https://wa.me/917358154022'
export const CONTACT_EMAIL = 'theeyoucounsellingspace@gmail.com'
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID
