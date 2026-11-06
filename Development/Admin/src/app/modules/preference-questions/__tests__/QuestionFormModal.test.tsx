import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { QuestionFormModal } from '../components/QuestionFormModal'

vi.mock('../hooks/usePreferenceQuestionsQuery', () => ({
  useGetPreferenceQuestionQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  usePreferenceQuestionsQuery: vi.fn(),
  useCreatePreferenceQuestionMutation: vi.fn(),
  useUpdatePreferenceQuestionMutation: vi.fn(),
  useDeletePreferenceQuestionMutation: vi.fn(),
}))

// Import the mocked module to access the mocked function
import { useGetPreferenceQuestionQuery } from '../hooks/usePreferenceQuestionsQuery'
const mockUseGetPreferenceQuestionQuery = vi.mocked(useGetPreferenceQuestionQuery)

const defaultProps = {
  editing: null,
  totalCount: 0,
  onClose: vi.fn(),
  onFinish: vi.fn(),
}

describe('QuestionFormModal', () => {
  beforeEach(() => {
    // Reset mock to default behavior: no loading, no data
    vi.clearAllMocks()
    mockUseGetPreferenceQuestionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useGetPreferenceQuestionQuery>)
  })

  it('resets all fields when reopened in create mode after being closed', async () => {
    const user = userEvent.setup()

    const { rerender } = renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)

    // Fill in the question
    const questionInput = screen.getByPlaceholderText('e.g. How often do you eat out?')
    await user.type(questionInput, 'abc')
    expect(questionInput).toHaveValue('abc')

    // Add a second option and fill both
    const addOptionBtn = screen.getByText('Add option')
    await user.click(addOptionBtn)
    const optionInputsBefore = screen.getAllByPlaceholderText('Option text')
    await user.type(optionInputsBefore[0], '222')
    await user.type(optionInputsBefore[1], '333')

    // Simulate close after successful creation
    rerender(<QuestionFormModal {...defaultProps} open={false} />)

    // Reopen in create mode
    rerender(<QuestionFormModal {...defaultProps} open={true} />)

    // Question field must be empty
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. How often do you eat out?')).toHaveValue('')
    })

    // Options must be reset to a single empty field
    const optionInputsAfter = screen.getAllByPlaceholderText('Option text')
    expect(optionInputsAfter).toHaveLength(1)
    expect(optionInputsAfter[0]).toHaveValue('')
  })

  it('shows empty fields on first open in create mode', () => {
    renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)

    expect(screen.getByPlaceholderText('e.g. How often do you eat out?')).toHaveValue('')
    const optionInputs = screen.getAllByPlaceholderText('Option text')
    expect(optionInputs).toHaveLength(1)
    expect(optionInputs[0]).toHaveValue('')
  })

  describe('Question input', () => {
    it('accepts text input for question field', async () => {
      const user = userEvent.setup()

      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)

      const questionInput = screen.getByPlaceholderText(
        'e.g. How often do you eat out?',
      ) as HTMLInputElement
      await user.type(questionInput, 'My Test Question')

      expect(questionInput.value).toBe('My Test Question')
    })
  })

  describe('Option inputs', () => {
    it('allows entering text for multiple options', async () => {
      const user = userEvent.setup()

      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)

      const optionInputs = screen.getAllByPlaceholderText('Option text') as HTMLInputElement[]
      await user.type(optionInputs[0], 'First Option')

      const addBtn = screen.getByText('Add option')
      await user.click(addBtn)

      const allOptionInputs = screen.getAllByPlaceholderText('Option text') as HTMLInputElement[]
      await user.type(allOptionInputs[1], 'Second Option')

      expect(allOptionInputs[0].value).toBe('First Option')
      expect(allOptionInputs[1].value).toBe('Second Option')
    })
  })

  describe('Create mode: validation', () => {
    it('prevents submission with duplicate options', async () => {
      const user = userEvent.setup()
      const onFinish = vi.fn()

      const { container } = renderWithProviders(
        <QuestionFormModal {...defaultProps} open={true} onFinish={onFinish} />,
      )

      const questionInput = screen.getByPlaceholderText('e.g. How often do you eat out?')
      await user.type(questionInput, 'What is your preference?')

      const addBtn = screen.getByText('Add option')
      await user.click(addBtn)

      const optionInputs = screen.getAllByPlaceholderText('Option text')
      await user.type(optionInputs[0], 'Same')
      await user.type(optionInputs[1], 'Same')

      const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement
      await user.click(submitBtn)

      // onFinish should not be called due to duplicate validation
      expect(onFinish).not.toHaveBeenCalled()
    })
  })

  describe('Create mode: add option', () => {
    it('adds a new option field when Add button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)

      let optionInputs = screen.getAllByPlaceholderText('Option text')
      expect(optionInputs).toHaveLength(1)

      const addBtn = screen.getByText('Add option')
      await user.click(addBtn)

      optionInputs = screen.getAllByPlaceholderText('Option text')
      expect(optionInputs).toHaveLength(2)

      await user.click(addBtn)

      optionInputs = screen.getAllByPlaceholderText('Option text')
      expect(optionInputs).toHaveLength(3)
    })
  })

  describe('Create mode: form structure', () => {
    it('renders form with question input and option fields', () => {
      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)

      // Check that all expected form elements are present
      expect(screen.getByPlaceholderText('e.g. How often do you eat out?')).toBeInTheDocument()
      const optionInputs = screen.getAllByPlaceholderText('Option text')
      expect(optionInputs.length).toBeGreaterThan(0)
      expect(screen.getByText('Add option')).toBeInTheDocument()
    })
  })

  describe('Validation: question and options', () => {
    it('requires both question text and options to be filled', async () => {
      const user = userEvent.setup()
      const onFinish = vi.fn()

      const { container } = renderWithProviders(
        <QuestionFormModal {...defaultProps} open={true} onFinish={onFinish} />,
      )

      // Try to submit without filling anything
      const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement
      await user.click(submitBtn)

      // onFinish should not be called due to validation
      expect(onFinish).not.toHaveBeenCalled()
    })
  })

  describe('Form reset', () => {
    it('preserves form data across render cycles', async () => {
      const user = userEvent.setup()

      const { rerender } = renderWithProviders(
        <QuestionFormModal {...defaultProps} open={true} totalCount={5} />,
      )

      // Fill in question
      const questionInput = screen.getByPlaceholderText('e.g. How often do you eat out?')
      await user.type(questionInput, 'My Question')
      expect(questionInput).toHaveValue('My Question')

      // Rerender with same props
      rerender(<QuestionFormModal {...defaultProps} open={true} totalCount={5} />)

      // Data should still be there (form wasn't reset because editing is still null)
      const questionInputAfter = screen.getByPlaceholderText('e.g. How often do you eat out?')
      expect(questionInputAfter).toHaveValue('My Question')
    })
  })

  describe('Modal props', () => {
    it('renders modal with correct initial state', () => {
      const onClose = vi.fn()
      renderWithProviders(
        <QuestionFormModal {...defaultProps} open={true} onClose={onClose} totalCount={3} />,
      )

      // Verify modal content is visible
      expect(screen.getByPlaceholderText('e.g. How often do you eat out?')).toBeInTheDocument()
      expect(screen.getByText('Add option')).toBeInTheDocument()
    })
  })

  describe('Create mode: successful submission', () => {
    it('calls onFinish with create payload when the form is valid', async () => {
      const user = userEvent.setup()
      const onFinish = vi.fn()

      renderWithProviders(
        <QuestionFormModal {...defaultProps} open={true} totalCount={2} onFinish={onFinish} />,
      )

      const questionInput = screen.getByPlaceholderText('e.g. How often do you eat out?')
      fireEvent.change(questionInput, { target: { value: '  How often?  ' } })
      await user.click(screen.getByText('Add option'))
      const optionInputs = screen.getAllByPlaceholderText('Option text')
      fireEvent.change(optionInputs[0], { target: { value: '  Daily  ' } })
      fireEvent.change(optionInputs[1], { target: { value: 'Weekly' } })

      await user.click(screen.getByRole('button', { name: /create question/i }))

      await waitFor(() => expect(onFinish).toHaveBeenCalled(), { timeout: 4000 })
      const [payload, mode] = onFinish.mock.calls[0]
      expect(mode).toBe('create')
      // Values are trimmed before being handed to onFinish.
      expect(payload.question).toBe('How often?')
      expect(payload.options).toEqual([{ text: 'Daily' }, { text: 'Weekly' }])
    })

    it('blocks submission when fewer than two options are filled', async () => {
      const user = userEvent.setup()
      const onFinish = vi.fn()

      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} onFinish={onFinish} />)

      fireEvent.change(screen.getByPlaceholderText('e.g. How often do you eat out?'), {
        target: { value: 'Only one option here' },
      })
      const optionInputs = screen.getAllByPlaceholderText('Option text')
      fireEvent.change(optionInputs[0], { target: { value: 'Lonely' } })

      await user.click(screen.getByRole('button', { name: /create question/i }))

      // The min-two-options validator rejects, so onFinish never fires.
      await waitFor(() =>
        expect(document.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
      )
      expect(onFinish).not.toHaveBeenCalled()
    })

    it('rejects case-insensitive duplicate options', async () => {
      const user = userEvent.setup()
      const onFinish = vi.fn()

      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} onFinish={onFinish} />)

      fireEvent.change(screen.getByPlaceholderText('e.g. How often do you eat out?'), {
        target: { value: 'Dup check' },
      })
      await user.click(screen.getByText('Add option'))
      const optionInputs = screen.getAllByPlaceholderText('Option text')
      fireEvent.change(optionInputs[0], { target: { value: 'Yes' } })
      fireEvent.change(optionInputs[1], { target: { value: 'yes' } })

      await user.click(screen.getByRole('button', { name: /create question/i }))

      // The uniqueness branch rejects, so onFinish never fires.
      await waitFor(() =>
        expect(document.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
      )
      expect(onFinish).not.toHaveBeenCalled()
    })
  })

  describe('Create mode: remove option', () => {
    it('removes an option field when its remove button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)

      await user.click(screen.getByText('Add option'))
      expect(screen.getAllByPlaceholderText('Option text')).toHaveLength(2)

      const removeBtns = screen.getAllByRole('button', { name: 'Remove' })
      await user.click(removeBtns[0])

      expect(screen.getAllByPlaceholderText('Option text')).toHaveLength(1)
    })

    it('disables the remove button when only one option remains', () => {
      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)
      const removeBtns = screen.getAllByRole('button', { name: 'Remove' })
      expect(removeBtns[0]).toBeDisabled()
    })
  })

  describe('Submit button hover styling', () => {
    it('swaps background colour on mouse enter and leave', () => {
      renderWithProviders(<QuestionFormModal {...defaultProps} open={true} />)
      const submitBtn = screen.getByRole('button', { name: /create question/i })
      fireEvent.mouseEnter(submitBtn)
      expect(submitBtn.style.background).toBe('var(--color-accent-dark)')
      fireEvent.mouseLeave(submitBtn)
      expect(submitBtn.style.background).toBe('var(--color-accent)')
    })
  })

  describe('Edit mode', () => {
    const editing = {
      id: 'q1',
      question: 'Existing question',
      type: 'MULTI_SELECT' as const,
      questionOrder: 2,
      optionsCount: 2,
      createdAt: '2026-01-01T00:00:00Z',
    }

    const detail = {
      id: 'q1',
      question: 'Existing question',
      type: 'MULTI_SELECT' as const,
      questionOrder: 2,
      options: [
        { id: 'o1', text: 'Alpha', displayOrder: 1 },
        { id: 'o2', text: 'Beta', displayOrder: 2 },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    }

    it('shows a spinner while the detail query is loading', () => {
      mockUseGetPreferenceQuestionQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as unknown as ReturnType<typeof useGetPreferenceQuestionQuery>)

      renderWithProviders(
        <QuestionFormModal {...defaultProps} open={true} editing={editing} totalCount={3} />,
      )

      expect(document.querySelector('.ant-spin')).not.toBeNull()
      // The form fields should not render while loading.
      expect(screen.queryByPlaceholderText('e.g. How often do you eat out?')).toBeNull()
    })

    it('prefills the form from detail data and submits an edit payload', async () => {
      const user = userEvent.setup()
      const onFinish = vi.fn()

      mockUseGetPreferenceQuestionQuery.mockReturnValue({
        data: detail,
        isLoading: false,
      } as unknown as ReturnType<typeof useGetPreferenceQuestionQuery>)

      renderWithProviders(
        <QuestionFormModal
          {...defaultProps}
          open={true}
          editing={editing}
          totalCount={3}
          onFinish={onFinish}
        />,
      )

      // Title reflects edit mode and fields are prefilled from the detail query.
      expect(screen.getByText('Edit preference question')).toBeInTheDocument()
      const questionInput = screen.getByPlaceholderText(
        'e.g. How often do you eat out?',
      ) as HTMLInputElement
      await waitFor(() => expect(questionInput.value).toBe('Existing question'))
      const optionInputs = screen.getAllByPlaceholderText('Option text') as HTMLInputElement[]
      expect(optionInputs.map((i) => i.value)).toEqual(['Alpha', 'Beta'])

      await user.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(onFinish).toHaveBeenCalled(), { timeout: 4000 })
      const [payload, mode] = onFinish.mock.calls[0]
      expect(mode).toBe('edit')
      // Existing option ids are preserved on edit.
      expect(payload.options).toEqual([
        { id: 'o1', text: 'Alpha' },
        { id: 'o2', text: 'Beta' },
      ])
    })

    it('invokes onClose from the cancel button in edit mode', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      mockUseGetPreferenceQuestionQuery.mockReturnValue({
        data: detail,
        isLoading: false,
      } as unknown as ReturnType<typeof useGetPreferenceQuestionQuery>)

      renderWithProviders(
        <QuestionFormModal
          {...defaultProps}
          open={true}
          editing={editing}
          totalCount={3}
          onClose={onClose}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onClose).toHaveBeenCalled()
    })
  })
})
