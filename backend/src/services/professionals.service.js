/**
 * Professionals Service — In-Memory Cache
 *
 * Populated automatically by googleSheets.service.js on every sync.
 * The Google Sheet is the single source of truth — no hardcoding here.
 *
 * Sheet columns (Professional, Date, Time are required):
 *   Professional | Date | Time | Title | Bio | Specializations | Areas
 *
 * Edge cases handled:
 *  - Missing optional columns → graceful defaults
 *  - Duplicate names (case-insensitive) → last-seen row wins
 *  - Sheet offline → cache from last successful sync persists
 *  - Unknown professional (slot with no bio row) → safe fallback returned
 */

/** @type {Map<string, Object>} key = lowercased name for O(1) lookup */
let _cache = new Map()
/** timestamp of last successful sync */
let _lastSyncAt = null

/**
 * Replace the entire professionals cache (called by googleSheets.service.js)
 * @param {Array<{name, title, bio, specializations, areas}>} professionals
 */
function setProfessionals(professionals) {
    const next = new Map()
    for (const p of professionals) {
        if (!p.name || !p.name.trim()) continue
        next.set(p.name.trim().toLowerCase(), {
            name: p.name.trim(),
            title: p.title || 'Counselling Psychologist',
            bio: p.bio || '',
            specializations: Array.isArray(p.specializations) ? p.specializations : [],
            areas: Array.isArray(p.areas) ? p.areas : [],
            // Card display fields
            experience: p.experience || '',
            languages: p.languages || '',
            mode: p.mode || '',
            price: p.price || '',
        })
    }
    _cache = next
    _lastSyncAt = new Date().toISOString()
    console.log(`[Professionals] Cache updated — ${next.size} professional(s) loaded from sheet`)
}

/**
 * Get all professionals as an array (sorted A-Z by name)
 * @returns {Array<Object>}
 */
function getAllProfessionals() {
    return [..._cache.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get one professional by name (case-insensitive)
 * Returns a safe fallback if not in cache.
 * @param {string} name
 * @returns {Object}
 */
function getProfessional(name) {
    if (!name) return _fallback('Unknown')
    const hit = _cache.get(name.trim().toLowerCase())
    return hit || _fallback(name.trim())
}

/**
 * Returns true if the cache has been populated at least once.
 */
function isLoaded() {
    return _cache.size > 0
}

function getLastSyncAt() {
    return _lastSyncAt
}

/** Safe fallback so the frontend never crashes on an unknown professional */
function _fallback(name) {
    return {
        name,
        title: 'Counselling Psychologist',
        bio: '',
        specializations: [],
        areas: [],
        _isFallback: true,
    }
}

module.exports = { setProfessionals, getAllProfessionals, getProfessional, isLoaded, getLastSyncAt }
