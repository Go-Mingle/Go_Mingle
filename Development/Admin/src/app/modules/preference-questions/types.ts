export type PreferenceQuestionType = 'SINGLE_SELECT' | 'MULTI_SELECT'

// List item — no options array, has optionsCount
export interface PreferenceQuestionListItem {
  id: string
  question: string
  type: PreferenceQuestionType
  questionOrder: number
  optionsCount: number
  createdAt: string
}

// Option with ID — returned by GET /:id and used in PATCH body
export interface PreferenceQuestionOption {
  id: string
  text: string
  displayOrder: number
}

// Full detail — returned by GET /:id for Edit modal
export interface PreferenceQuestionDetail {
  id: string
  question: string
  type: PreferenceQuestionType
  questionOrder: number
  options: PreferenceQuestionOption[]
  createdAt: string
  updatedAt: string | null
}

// Option input for Create
export interface CreatePreferenceQuestionOptionInput {
  text: string
}

// Option input for Update (id = existing, no id = new)
export interface UpdatePreferenceQuestionOptionInput {
  id?: string
  text: string
}

// Create request body
export interface CreatePreferenceQuestionInput {
  question: string
  type: PreferenceQuestionType
  questionOrder: number
  options: CreatePreferenceQuestionOptionInput[]
}

// Update request body (all fields optional)
export interface UpdatePreferenceQuestionInput {
  question?: string
  type?: PreferenceQuestionType
  questionOrder?: number
  options?: UpdatePreferenceQuestionOptionInput[]
}

// Mutation result (create 201 / update 200)
export interface PreferenceQuestionMutationResult {
  id: string
  question: string
  type: PreferenceQuestionType
  questionOrder: number
  optionsCount: number
  createdAt?: string
  updatedAt?: string | null
}

// Pagination metadata
export interface PreferenceQuestionsPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

// List response (API envelope unwrapped)
export interface PreferenceQuestionsListData {
  items: PreferenceQuestionListItem[]
  pagination: PreferenceQuestionsPagination
}

// List query params
export interface ListPreferenceQuestionsParams {
  page?: number
  pageSize?: number
  sortBy?: 'order' | 'question'
  sortOrder?: 'asc' | 'desc'
  q?: string
}
