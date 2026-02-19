/**
 * Professional Matching Service
 * Maps user concerns to appropriate professionals
 * 
 * "Talk is cheap. Show me the code." - Linus Torvalds
 * Simple, direct, no fluff.
 */

// Professional specialties and their identifiers
const PROFESSIONALS = {
    WORK_LIFE: {
        id: 'work_life_balance',
        name: 'Work-Life Balance Specialist',
        specialties: ['work_life_balance', 'burnout', 'stress_management', 'time_management'],
    },
    RELATIONSHIP: {
        id: 'relationship_family',
        name: 'Relationship & Family Counselor',
        specialties: ['relationship', 'family', 'communication', 'conflict_resolution'],
    },
    ACADEMICS: {
        id: 'academics_career',
        name: 'Academic & Career Advisor',
        specialties: ['academics', 'career', 'student_stress', 'performance_anxiety'],
    },
    ANXIETY: {
        id: 'anxiety_depression',
        name: 'Anxiety & Depression Specialist',
        specialties: ['anxiety', 'depression', 'panic', 'mood_disorders'],
    },
    REGRET: {
        id: 'regret_management',
        name: 'Regret Management Counselor',
        specialties: ['regret', 'past_trauma', 'guilt', 'decision_making'],
    },
    GENERAL: {
        id: 'general_support',
        name: 'General Support Counselor',
        specialties: ['general', 'other', 'exploratory', 'unsure'],
    },
}

// Category mapping from triage responses
const CATEGORY_MAP = {
    work_life_balance: PROFESSIONALS.WORK_LIFE,
    relationship_family: PROFESSIONALS.RELATIONSHIP,
    academics_career: PROFESSIONALS.ACADEMICS,
    anxiety_depression: PROFESSIONALS.ANXIETY,
    regret_management: PROFESSIONALS.REGRET,
    general_support: PROFESSIONALS.GENERAL,
}

/**
 * Match user to appropriate professional based on triage responses
 * @param {Object} triageData - { primaryConcern, urgencyLevel }
 * @returns {Object} Professional assignment
 */
function matchProfessional(triageData) {
    const { primaryConcern } = triageData

    // Direct mapping - no complex algorithm needed
    const professional = CATEGORY_MAP[primaryConcern] || PROFESSIONALS.GENERAL

    return {
        professionalId: professional.id,
        professionalName: professional.name,
        assignedAt: new Date().toISOString(),
    }
}

module.exports = {
    PROFESSIONALS,
    matchProfessional,
}
