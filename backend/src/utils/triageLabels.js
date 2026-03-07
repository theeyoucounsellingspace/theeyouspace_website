/**
 * Shared triage label maps — used by email.service.js and sheetWriteback.service.js
 * Single source of truth. Add new concern/duration/impact IDs here only.
 */

const CONCERN_LABELS = {
    anxiety_stress: 'Anxiety & Stress',
    depression_mood: 'Low Mood',
    relationship_family: 'Relationships & Family',
    work_academics: 'Work & Academics',
    grief_loss: 'Grief & Loss',
    trauma_regret: 'Trauma & Regret',
    self_identity: 'Self & Identity',
    general: 'Exploring / Not sure yet',
}

const DURATION_LABELS = {
    days: 'Just started (a few days)',
    weeks: 'A few weeks (2–6 weeks)',
    months: 'A few months (2–6 months)',
    longer: 'Over 6 months',
}

const IMPACT_LABELS = {
    sleep: 'Sleep',
    work_school: 'Work or studies',
    relationships: 'Relationships',
    daily_routine: 'Daily routine',
    physical: 'Body & health',
    mood: 'Mood',
}

/**
 * Humanise a single triage value using the provided label map.
 * Falls back to the raw ID if not found, and '' if null/undefined.
 */
function label(map, id) {
    if (!id) return ''
    return map[id] || id
}

/**
 * Humanise an array of triage values (impacts).
 */
function labelList(map, ids) {
    if (!Array.isArray(ids) || ids.length === 0) return ''
    return ids.map(id => map[id] || id).join(', ')
}

module.exports = { CONCERN_LABELS, DURATION_LABELS, IMPACT_LABELS, label, labelList }
