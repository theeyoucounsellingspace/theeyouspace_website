import { useState } from 'react'

export function useTriage(questions) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState({})

  const currentQuestion = questions[currentStep]
  const isLastStep = currentStep === questions.length - 1
  const totalSteps = questions.length

  const handleOptionSelect = (option) => {
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: option
    }
    setAnswers(newAnswers)
    return newAnswers
  }

  const goToNextStep = () => {
    if (!isLastStep) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const reset = () => {
    setCurrentStep(0)
    setAnswers({})
  }

  return {
    currentStep,
    currentQuestion,
    answers,
    isLastStep,
    totalSteps,
    handleOptionSelect,
    goToNextStep,
    goToPreviousStep,
    reset,
  }
}
