export interface Category {
  id: string
  name: string
  commissionRate: number
  interestTablesPerMonth: number
  restaurantsCount: number
  createdAt: string
  updatedAt?: string
}

export interface CreateCategoryDto {
  name: string
  commissionRate: number
}

export type UpdateCategoryDto = Partial<CreateCategoryDto>

export interface CategoryFormValues {
  name: string
  commissionRate: number
}
