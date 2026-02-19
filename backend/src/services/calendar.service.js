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
 * Book a slot
 * @param {string} date
 * @param {string} time
 * @param {string} bookingId
 * @returns {boolean} Success status
 */
function bookSlot(date, time, bookingId) {
  const slot = AvailabilitySlot.findByDateTime(date, time)
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
