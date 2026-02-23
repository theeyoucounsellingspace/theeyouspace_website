/**
 * Professionals data — Thee You Space
 * These bios are shown contextually on the Schedule page (when choosing a slot)
 * NOT on the About page (which focuses on the collective vision)
 *
 * Key = exact name as it appears in the Google Sheet "Professional" column
 */

export const PROFESSIONALS = {
    'Mohammed Muhaiyadeen M': {
        name: 'Mohammed Muhaiyadeen M',
        gender: 'Male',
        experience: '2+ years',
        title: 'Counseling Psychologist',
        approach: 'Providing evidence-based psychological support for relationships, academics, and professional growth. Supporting clarity, balance, and meaningful change.',
        specializations: ['CBT', 'Person-Centered Therapy', 'Couple Counselling'],
        areas: ['Relationships', 'Academics', 'Professional growth'],
    },

    'Leaskar Paulraj DJ': {
        name: 'Leaskar Paulraj DJ',
        gender: 'Male',
        experience: '2+ years',
        title: 'Counselling Psychologist',
        approach: 'Providing evidence-based psychological support for family concerns, coping with disability, and general stress.',
        specializations: ['CBT', 'Person-Centered Therapy', 'Family Counselling'],
        areas: ['Family concerns', 'Disability coping', 'General stress'],
    },

    'Jeevan KJ': {
        name: 'Jeevan KJ',
        gender: 'Male',
        experience: '2+ years',
        title: 'Counseling Psychologist',
        approach: 'Using person-centered support and strengths-based career mapping to help individuals build confidence and direction.',
        specializations: ['Person-Centered Therapy', 'Strengths-Based Career Mapping'],
        areas: ['School counseling', 'Career guidance'],
    },

    'Abijith KB': {
        name: 'Abijith KB',
        gender: 'Male',
        experience: '2+ years',
        title: 'Counseling Psychologist',
        approach: 'Providing evidence-based psychological support for psychological distress, work-life balance, work stress, relationship problems, academics, and professional growth.',
        specializations: ['CBT', 'Person-Centered Therapy', 'Psychoanalytic Therapy'],
        areas: ['Work-life balance', 'Relationships', 'Academic & professional growth'],
    },

    'Joan Ana': {
        name: 'Joan Ana',
        gender: 'Female',
        experience: '1.5+ years',
        title: 'Counselling Psychologist',
        approach: 'Supporting individuals with emotion regulation, identity concerns, social anxiety, grief, and life transitions through trauma-informed care, resilience training, and motivation enhancement.',
        specializations: ['CBT', 'Person-Centered Therapy', 'Mindfulness', 'Motivational Interviewing'],
        areas: ['Emotion regulation', 'Social anxiety', 'Grief', 'Life transitions', 'Identity'],
    },
}

/**
 * Get professional info by name. Falls back to null if not found.
 * @param {string} name
 * @returns {Object|null}
 */
export function getProfessional(name) {
    if (!name) return null
    // Exact match first
    if (PROFESSIONALS[name]) return PROFESSIONALS[name]
    // Case-insensitive match (handles sheet name casing differences)
    const key = Object.keys(PROFESSIONALS).find(
        k => k.toLowerCase() === name.toLowerCase()
    )
    return key ? PROFESSIONALS[key] : null
}
