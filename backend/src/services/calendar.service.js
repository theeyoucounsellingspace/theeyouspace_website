const AvailabilitySlot = require('../models/AvailabilitySlot')

/**
 * Get available time slots
 * @returns {Array} Available slots
 */
function getAvailableSlots() {
  return AvailabilitySlot.getAll()
}

/**
 * Check if a slot is available
 * @param {string} date
 * @param {string} time
 * @returns {boolean}
 */
function isSlotAvailable(date, time) {
  const slot = AvailabilitySlot.findByDateTime(date, time)
  return slot && slot.available
}

/**
 * Book a slot — matches by professional + date + time
 * @param {string} date
 * @param {string} time
 * @param {string} bookingId
 * @param {string} [professional]
 * @returns {boolean} Success status
 */
function bookSlot(date, time, bookingId, professional) {
  const slot = professional
    ? AvailabilitySlot.findByProfessionalDateTime(professional, date, time)
    : AvailabilitySlot.findByDateTime(date, time)
  if (slot && slot.available) {
    return AvailabilitySlot.bookSlot(slot.id, bookingId)
  }
  return false
}

/**
 * Release a booked slot
 * @param {string} date
 * @param {string} time
 * @returns {boolean} Success status
 */
function releaseSlot(date, time) {
  const slot = AvailabilitySlot.findByDateTime(date, time)
  if (slot) {
    return AvailabilitySlot.releaseSlot(slot.id)
  }
  return false
}

module.exports = {
  getAvailableSlots,
  isSlotAvailable,
  bookSlot,
  releaseSlot,
}
