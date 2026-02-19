/**
 * AvailabilitySlot model — multi-professional, Google Sheets backed
 *
 * Each slot: { id, professional, date, time, available, bookedBy, bookedAt }
 */

let slots = []
let lastUploadedBy = null
let lastUploadedAt = null

class AvailabilitySlot {

  static getAll() {
    return slots.filter((s) => s.available)
  }

  static getAllIncludingBooked() {
    return slots
  }

  static getById(id) {
    return slots.find((s) => s.id === id)
  }

  static findByDateTime(date, time) {
    return slots.find((s) => s.date === date && s.time === time)
  }

  /**
   * Find by professional + date + time (stricter match for multi-pro)
   */
  static findByProfessionalDateTime(professional, date, time) {
    return slots.find((s) => s.professional === professional && s.date === date && s.time === time)
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

  static releaseSlot(id) {
    const slot = this.getById(id)
    if (slot) {
      slot.available = true
      slot.bookedBy = null
      slot.bookedAt = null
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

    slots = parsedSlots.map((s, i) => {
      const key = `${s.professional || 'General'}|${s.date}|${s.time}`
      const wasBooked = bookedKeys.has(key)
      return {
        id: `slot-${Date.now()}-${i}`,
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
   * Dev seed — only used when no Google Sheet is configured.
   */
  static seedDevSlots() {
    if (slots.length > 0) return

    const professionals = ['Dr. Priya', 'Dr. Arjun', 'Dr. Meera', 'Dr. Rohan']
    const times = ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM']
    const today = new Date()

    professionals.forEach((professional, pIdx) => {
      for (let i = 1; i <= 5; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        if (date.getDay() === 0) continue // Skip Sunday

        const dateStr = date.toLocaleDateString('en-IN', {
          weekday: 'long', month: 'short', day: 'numeric',
        })

        // Each professional gets 2-3 time slots per day (staggered)
        const myTimes = times.slice(pIdx % 2, (pIdx % 2) + 3)
        myTimes.forEach((time, tIdx) => {
          slots.push({
            id: `dev-${pIdx}-${i}-${tIdx}`,
            professional,
            date: dateStr,
            time,
            available: true,
            bookedBy: null,
            bookedAt: null,
          })
        })
      }
    })

    console.log(`[Slots] Seeded ${slots.length} dev slots across ${professionals.length} professionals (no Sheet configured)`)
    lastUploadedBy = 'dev-seed'
    lastUploadedAt = null
  }

  static initialize() { this.seedDevSlots() }
}

AvailabilitySlot.initialize()

module.exports = AvailabilitySlot
