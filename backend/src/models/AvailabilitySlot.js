/**
 * AvailabilitySlot model — multi-professional, Google Sheets backed
 *
 * Each slot: { id, professional, date, time, available, bookedBy, bookedAt }
 */

let slots = []
let lastUploadedBy = null
let lastUploadedAt = null
let _slotCounter = 0 // monotonic counter — avoids Date.now() collisions when slots load fast

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

  /**
   * Find by professional + date + time (stricter match for multi-pro)
   * Also used by isSlotAvailable — ALWAYS prefer this over findByDateTime
   * when a professional is known.
   */
  static findByProfessionalDateTime(professional, date, time) {
    return slots.find(
      (s) => s.professional === professional && s.date === date && s.time === time
    )
  }

  /**
   * Find by date + time only — used as fallback when professional is unknown.
   * Prefer findByProfessionalDateTime when professional is available.
   */
  static findByDateTime(date, time) {
    return slots.find((s) => s.date === date && s.time === time)
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
   * Dev seed — only used when no Google Sheet is configured (local dev without .env).
   * Uses REAL professional names and staggered times so the Schedule page looks correct.
   */
  static seedDevSlots() {
    if (slots.length > 0) return

    // Real professionals with distinct time slots (mirrors seed-slots.js config)
    const PROFESSIONALS = [
      { name: 'Jeevan KJ', times: ['10:00 AM', '12:00 PM', '4:00 PM'], days: [1, 2, 3, 4, 6] },
      { name: 'Leaskar Paulraj DJ', times: ['11:00 AM', '3:00 PM', '6:00 PM'], days: [1, 3, 5, 6] },
      { name: 'Abijith KB', times: ['9:00 AM', '11:00 AM', '5:00 PM'], days: [2, 3, 4, 5] },
      { name: 'Mohammed Muhaiyadeen M', times: ['10:00 AM', '2:00 PM', '5:00 PM'], days: [1, 2, 4, 6] },
      { name: 'Joan Ana', times: ['9:30 AM', '12:00 PM', '3:30 PM'], days: [1, 2, 3, 5, 6] },
    ]

    const today = new Date()
    let slotId = 0

    PROFESSIONALS.forEach(pro => {
      for (let d = 1; d <= 14; d++) {
        const date = new Date(today)
        date.setDate(today.getDate() + d)
        const dow = date.getDay() // 0=Sun…6=Sat
        if (!pro.days.includes(dow)) continue

        // Format as D/M/YYYY to match the real sheet format the parser expects
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`

        pro.times.forEach(time => {
          slots.push({
            id: `dev-${++slotId}`,
            professional: pro.name,
            date: dateStr,
            time,
            available: true,
            bookedBy: null,
            bookedAt: null,
          })
        })
      }
    })

    console.log(`[Slots] Seeded ${slots.length} dev slots across ${PROFESSIONALS.length} real professionals (no Sheet configured)`)
    lastUploadedBy = 'dev-seed'
    lastUploadedAt = null
  }

  static initialize() { this.seedDevSlots() }
}

AvailabilitySlot.initialize()

module.exports = AvailabilitySlot
