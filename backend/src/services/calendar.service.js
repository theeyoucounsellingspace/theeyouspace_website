const AvailabilitySlot = require('../models/AvailabilitySlot')

/**
 * Get available time slots
 * @returns {Array} Available slots
 */
function getAvailableSlots() {
  return AvailabilitySlot.getAll()
}

/**
 * Check if a specific slot is still available.
 * Always pass professional when known — avoids matching a different person's slot.
 * @param {string} date
 * @param {string} time
 * @param {string} [professional] — use this, always
 * @returns {boolean}
 */
function isSlotAvailable(date, time, professional) {
  const slot = professional
    ? AvailabilitySlot.findByProfessionalDateTime(professional, date, time)
    : AvailabilitySlot.findByDateTime(date, time) // fallback: hope there's no clash
  return !!(slot && slot.available)
}

/**
 * Book a slot — always match by professional + date + time when possible.
 * @param {string} date
 * @param {string} time
 * @param {string} bookingId
 * @param {string} [professional]
 * @returns {boolean} Success status
 */
function bookSlot(date, time, bookingId, professional) {
  const slot = professional
    ? AvailabilitySlot.findByProfessionalDateTime(professional, date, time)
    : AvailabilitySlot.findByDateTime(date, time) // fallback only
  if (slot && slot.available) {
    return AvailabilitySlot.bookSlot(slot.id, bookingId)
  }
  return false
}

/**
 * Release a booked slot — always pass professional to avoid releasing the wrong row.
 * @param {string} date
 * @param {string} time
 * @param {string} [professional]
 * @returns {boolean} Success status
 */
function releaseSlot(date, time, professional) {
  const slot = AvailabilitySlot.findByProfessionalDateTime(professional, date, time)
  if (slot) {
    return AvailabilitySlot.releaseSlot(slot.id)
  }
  return false
}

function lockSlot(date, time, professional) {
  const slot = AvailabilitySlot.findByProfessionalDateTime(professional, date, time)
  if (slot) {
    return AvailabilitySlot.lockSlot(slot.id, 10)
  }
  return false
}

module.exports = {
  getAvailableSlots,
  isSlotAvailable,
  bookSlot,
  releaseSlot,
  lockSlot,
}
