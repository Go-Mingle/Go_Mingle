export interface SignUpQuestion {
  id: string
  label: string
}

export const SIGN_UP_QUESTIONS: SignUpQuestion[] = [
  { id: 'q1', label: 'What type of dining experiences do you enjoy most?' },
  { id: 'q2', label: 'How often do you dine out per month?' },
  { id: 'q3', label: 'Do you have any dietary preferences or restrictions?' },
  { id: 'q4', label: 'What is your preferred dining time?' },
  { id: 'q5', label: 'How did you hear about GoMingle?' },
]
