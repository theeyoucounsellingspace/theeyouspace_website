// In-memory store for demo purposes
// In production, replace with actual database (MongoDB, PostgreSQL, etc.)

const bookings = []
let bookingIdCounter = 1

class Booking {
  constructor(data) {
    this.id = `TYS-${String(bookingIdCounter++).padStart(6, '0')}`
    this.sessionType = data.sessionType // 'normal' or 'priority'
    this.name = data.name
    this.email = data.email
    this.phone = data.phone || null
    // professional — pulled from slot data or top-level field, normalised to string
    this.professional = data.selectedSlot?.professional || data.professional || null
    this.selectedSlot = data.selectedSlot // { date, time, professional }
    this.pricing = data.pricing // { displayAmount, totalAmount, currency }
    this.paymentMethod = data.paymentMethod // 'card' or 'upi'
    this.razorpayOrderId = data.razorpayOrderId || null
    this.razorpayPaymentId = data.razorpayPaymentId || null
    this.paymentStatus = data.paymentStatus || 'pending'
    this.bookingStatus = data.bookingStatus || 'pending'
    // Triage data — stored as-is, used for session prep email and counsellor notes
    this.triageData = data.triageData || null
    this.meetUrl = data.meetUrl || null              // Google Meet link (set post-payment)
    this.sessionReminderSent = false   // set true after 24hr reminder fires
    this.rescheduledFrom = data.rescheduledFrom || null  // original bookingId if rescheduled
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  static create(data) {
    const booking = new Booking(data)
    bookings.push(booking)
    return booking
  }

  /**
   * Restore a booking from persistent storage (Google Sheet) with a pre-set ID.
   * Does NOT call the constructor (avoids auto-incrementing the counter for this ID).
   * DOES advance the counter past this ID to prevent future collisions.
   */
  static restore(data) {
    // Build the object without calling the constructor
    const booking = Object.create(Booking.prototype)
    booking.id = data.id
    booking.sessionType = data.sessionType || 'normal'
    booking.name = data.name || ''
    booking.email = data.email || ''
    booking.phone = data.phone || null
    booking.professional = data.professional || null
    booking.selectedSlot = data.selectedSlot || null
    booking.pricing = data.pricing || null
    booking.paymentMethod = data.paymentMethod || 'unknown'
    booking.razorpayOrderId = data.razorpayOrderId || null
    booking.razorpayPaymentId = data.razorpayPaymentId || null
    booking.paymentStatus = data.paymentStatus || 'paid'
    booking.bookingStatus = data.bookingStatus || 'confirmed'
    booking.triageData = data.triageData || null
    booking.meetUrl = data.meetUrl || null
    booking.sessionReminderSent = data.sessionReminderSent || false
    booking.rescheduledFrom = data.rescheduledFrom || null
    booking.createdAt = data.createdAt || new Date().toISOString()
    booking.updatedAt = data.updatedAt || new Date().toISOString()

    bookings.push(booking)

    // Advance counter past this ID — e.g. "TYS-000042" → counter becomes 43
    const num = parseInt((data.id || '').replace('TYS-', ''), 10)
    if (!isNaN(num) && num >= bookingIdCounter) {
      bookingIdCounter = num + 1
    }

    return booking
  }


  static findById(id) {
    return bookings.find((b) => b.id === id)
  }

  static findByRazorpayOrderId(orderId) {
    return bookings.find((b) => b.razorpayOrderId === orderId)
  }

  static findByEmail(email) {
    return bookings.filter((b) => b.email === email)
  }

  static updateById(id, updates) {
    const booking = this.findById(id)
    if (booking) {
      Object.assign(booking, updates)
      booking.updatedAt = new Date().toISOString()
      return booking
    }
    return null
  }

  static getAll() {
    return bookings
  }

  toJSON() {
    return {
      id: this.id,
      sessionType: this.sessionType,
      name: this.name,
      email: this.email,
      phone: this.phone,
      professional: this.professional,
      selectedSlot: this.selectedSlot,
      pricing: this.pricing,
      paymentMethod: this.paymentMethod,
      paymentStatus: this.paymentStatus,
      bookingStatus: this.bookingStatus,
      triageData: this.triageData,
      meetUrl: this.meetUrl,
      sessionReminderSent: this.sessionReminderSent,
      rescheduledFrom: this.rescheduledFrom,
      razorpayOrderId: this.razorpayOrderId,
      razorpayPaymentId: this.razorpayPaymentId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}

module.exports = Booking
