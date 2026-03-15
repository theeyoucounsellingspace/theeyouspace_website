/**
 * AvailabilitySlot model — multi-professional, Google Sheets backed
 *
 * Each slot: { id, professional, date, time, available, bookedBy, bookedAt }
 */

let slots = []
let lastUploadedBy = null
let lastUploadedAt = null
let _slotCounter = 0 // monotonic counter — avoids Date.now() collisions when slots load fast

const norm = (s) => (s || '').trim().toLowerCase()

class AvailabilitySlot {

  static getAll() {
    const now = Date.now()
    return slots.filter((s) => s.available && (!s.pendingUntil || s.pendingUntil < now))
  }

  static getAllIncludingBooked() {
    return slots
  }

  static getById(id) {
    return slots.find((s) => s.id === id)
  }

  /**
   * Find by professional + date + time (stricter match for multi-pro)
   * Also used by isSlotAvailable — ALWAYS prefer this over findByDateTime
   * when a professional is known.
   */
  static findByProfessionalDateTime(professional, date, time) {
    return slots.find(
      (s) => norm(s.professional) === norm(professional) &&
        norm(s.date) === norm(date) &&
        norm(s.time) === norm(time)
    )
  }

  /**
   * Find by date + time only — used as fallback when professional is unknown.
   * Prefer findByProfessionalDateTime when professional is available.
   */
  static findByDateTime(date, time) {
    return slots.find((s) => norm(s.date) === norm(date) && norm(s.time) === norm(time))
  }

  static bookSlot(id, bookingId) {
    const slot = this.getById(id)
    if (slot && slot.available) {
      slot.available = false
      slot.bookedBy = bookingId
      slot.bookedAt = new Date().toISOString()
      return true
    }
    return false
  }

  static lockSlot(id, minutes = 10) {
    const slot = slots.find(s => s.id === id)
    if (slot && slot.available) {
      slot.pendingUntil = Date.now() + (minutes * 60 * 1000)
      return true
    }
    return false
  }

  static releaseSlot(id) {
    const slot = slots.find(s => s.id === id)
    if (slot) {
      slot.available = true
      slot.bookedBy = null
      slot.bookedAt = null
      slot.pendingUntil = null
      return true
    }
    return false
  }

  /**
   * Load slots from Google Sheets sync or CSV upload.
   * Preserves already-booked slots across re-uploads.
   * @param {Array<{professional, date, time}>} parsedSlots
   * @param {string} uploadedBy
   */
  static loadFromUpload(parsedSlots, uploadedBy = 'admin') {
    // Keep track of what's already booked so we don't double-book after re-sync
    const bookedKeys = new Set(
      slots.filter((s) => !s.available).map((s) => `${s.professional}|${s.date}|${s.time}`)
    )

    slots = parsedSlots.map((s) => {
      const key = `${s.professional || 'General'}|${s.date}|${s.time}`
      const wasBooked = bookedKeys.has(key)
      return {
        id: `slot-${++_slotCounter}`, // monotonic counter — no collisions
        professional: s.professional || 'General',
        date: s.date,
        time: s.time,
        available: !wasBooked,
        bookedBy: wasBooked ? 'preserved' : null,
        bookedAt: null,
      }
    })

    lastUploadedBy = uploadedBy
    lastUploadedAt = new Date().toISOString()
    console.log(`[Slots] Loaded ${slots.length} slots from ${uploadedBy}`)

    return slots.length
  }

  static getUploadStatus() {
    const professionals = [...new Set(slots.map((s) => s.professional))]
    return {
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.available).length,
      bookedSlots: slots.filter((s) => !s.available).length,
      professionals,
      lastUploadedBy,
      lastUploadedAt,
      hasData: slots.length > 0,
    }
  }

  /**
   * Returns slots grouped by professional: { "Dr. Priya": [{...}], "Dr. Arjun": [{...}] }
   */
  static getGroupedByProfessional() {
    const available = slots.filter((s) => s.available)
    const grouped = {}
    for (const slot of available) {
      const pro = slot.professional || 'General'
      if (!grouped[pro]) grouped[pro] = []
      grouped[pro].push(slot)
    }
    return grouped
  }

  /**
   * No dev seed — slots only come from the Google Sheet (via syncSlotsFromSheet).
   * If the Sheet is not configured, the slot pool stays empty and the schedule
   * page shows an empty state. That is correct and expected.
   */
  static initialize() {
    console.log('[Slots] Initialized — waiting for Google Sheet sync')
  }
}

AvailabilitySlot.initialize()

module.exports = AvailabilitySlot
