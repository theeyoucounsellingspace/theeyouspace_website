// This file can be used to route concerns to appropriate counselors
// For now, it's a placeholder for future routing logic

export const getConcernCategory = (answers) => {
  // Placeholder logic - can be expanded based on triage answers
  if (answers[1]?.includes('overwhelmed') || answers[1]?.includes('anxiety')) {
    return 'anxiety'
  }
  if (answers[1]?.includes('loss') || answers[1]?.includes('grief')) {
    return 'grief'
  }
  return 'general'
}

export const getRecommendedCounselor = (category) => {
  // Placeholder - would match with actual counselor data
  return {
    id: 'counselor-1',
    name: 'Counselor',
    specialization: category,
  }
}
