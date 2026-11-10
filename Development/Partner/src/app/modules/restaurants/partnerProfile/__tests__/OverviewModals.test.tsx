import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { OverviewModals } from '../components/OverviewModals'
import type { useOverviewCards } from '../hooks/useOverviewCards'
import { PROFILE_LIMITS } from '../constants'

type Cards = ReturnType<typeof useOverviewCards>

/** A plain stand-in, so each card's modal can be opened on its own. */
function controller(overrides: Partial<Cards> = {}): Cards {
  return {
    openCard: null,
    openCardModal: vi.fn(),
    closeCard: vi.fn(),
    saving: false,
    errors: {},
    blocked: false,
    filled: { details: true, location: true, owner: true, rules: true },
    details: { cuisine: 'Levantine', description: 'A courtyard kitchen.' },
    setDetails: vi.fn(),
    saveDetails: vi.fn(),
    location: {
      fullAddress: '12 North Nazimabad St',
      areaDistrict: 'Korangi',
      city: 'Karachi',
      latitude: '24.7977',
      longitude: '67.0306',
      phone: '+923001234567',
      email: 'hello@aurelia.pk',
      website: 'aurelia.pk',
    },
    setLocation: vi.fn(),
    saveLocation: vi.fn(),
    owner: { name: 'Nadia Rahman', email: 'nadia@aurelia.pk', phone: '+923009876543' },
    setOwner: vi.fn(),
    saveOwner: vi.fn(),
    rules: { houseRules: 'No smoking indoors.', dressCode: 'Smart casual', servesAlcohol: true },
    setRules: vi.fn(),
    saveRules: vi.fn(),
    ...overrides,
  } as Cards
}

function renderModals(overrides: Partial<Cards> = {}) {
  const cards = controller(overrides)
  return { cards, ...renderWithProviders(<OverviewModals cards={cards} />) }
}

/**
 * Inputs are read from the open modal. All four modals live in one fragment, but
 * `destroyOnHidden` means only the open one is mounted.
 */
/** By accessible name: `LabelledInput` sets `aria-label` from its label. */
const fieldFor = (label: string) =>
  document.querySelector(`.ant-modal [aria-label="${label}"]`) as HTMLElement

function fields() {
  const modal = document.querySelector('.ant-modal') as HTMLElement
  // The Select renders a hidden input of its own; only real text controls count.
  return Array.from(modal.querySelectorAll('input, textarea')).filter(
    (node) => !node.closest('.ant-select'),
  )
}

function saveButton() {
  return screen.getByRole('button', { name: /^save$/i })
}

describe('OverviewModals visibility', () => {
  it('shows nothing while no card is open', () => {
    renderModals()
    expect(document.querySelector('.ant-modal-content')).toBeNull()
  })

  it.each([
    ['details', 'Restaurant Details'],
    ['location', 'Location'],
    ['owner', 'Owner'],
    ['rules', 'Rules'],
  ])('opens only the %s modal', (openCard, title) => {
    renderModals({ openCard: openCard as Cards['openCard'] })
    const titles = Array.from(document.querySelectorAll('.ant-modal-title')).map(
      (node) => node.textContent,
    )
    expect(titles).toHaveLength(1)
    expect(titles[0]).toMatch(new RegExp(title, 'i'))
  })
})

describe('OverviewModals details', () => {
  it('prefills cuisine and description', () => {
    renderModals({ openCard: 'details' })
    const [cuisine, description] = Array.from(fields()) as HTMLInputElement[]
    expect(cuisine.value).toBe('Levantine')
    expect(description.value).toBe('A courtyard kitchen.')
  })

  /**
   * Cuisine is free text: there is no cuisine catalogue on the platform, so the
   * spec's "single-select from the admin list" described a picker that does not
   * exist (BR-06a).
   */
  it('takes cuisine as free text rather than a picker', () => {
    renderModals({ openCard: 'details' })
    const [cuisine] = Array.from(fields()) as HTMLInputElement[]
    expect(cuisine.tagName).toBe('INPUT')
    expect(cuisine).toHaveAttribute('maxlength', String(PROFILE_LIMITS.cuisine))
  })

  it.each([
    [0, 'cuisine', 'Pakistani'],
    [1, 'description', 'A rooftop kitchen.'],
  ])('reports an edit to %s without dropping the other field', (index, field, value) => {
    const { cards } = renderModals({ openCard: 'details' })
    fireEvent.change(fields()[index as number], { target: { value } })
    expect(cards.setDetails).toHaveBeenCalledWith({
      cuisine: 'Levantine',
      description: 'A courtyard kitchen.',
      [field]: value,
    })
  })

  it('saves and cancels through the card own handlers', async () => {
    const { cards } = renderModals({ openCard: 'details' })
    const user = userEvent.setup()
    await user.click(saveButton())
    expect(cards.saveDetails).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(cards.closeCard).toHaveBeenCalled()
  })
})

describe('OverviewModals location', () => {
  /**
   * Queried by accessible name rather than by DOM position: the coordinate pair
   * became a map picker, whose search box is another input in the same modal, and
   * index-based lookups shifted every field after it.
   */
  it('prefills the six text fields across both contract groups', () => {
    renderModals({ openCard: 'location' })

    expect(fieldFor('Full Address')).toHaveValue('12 North Nazimabad St')
    expect(fieldFor('Area / District')).toHaveValue('Korangi')
    expect(fieldFor('City')).toHaveValue('Karachi')
    expect(fieldFor('Restaurant Phone')).toHaveValue('+923001234567')
    expect(fieldFor('Restaurant Email')).toHaveValue('hello@aurelia.pk')
    expect(fieldFor('Website')).toHaveValue('aurelia.pk')
  })

  /**
   * The numeric latitude/longitude inputs are gone — they asked a partner to know
   * their own coordinates. Both axes now come from the map picker together.
   */
  it('offers no coordinate inputs', () => {
    renderModals({ openCard: 'location' })

    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Longitude')).not.toBeInTheDocument()
    expect(screen.queryByText(/both values are needed/i)).not.toBeInTheDocument()
  })

  it.each([
    ['Full Address', 'fullAddress', '9 Clifton Boardwalk'],
    ['Area / District', 'areaDistrict', 'Shahrah-e-Faisal'],
    ['City', 'city', 'Lahore'],
    ['Restaurant Phone', 'phone', '+923000000000'],
    ['Restaurant Email', 'email', 'hi@aurelia.pk'],
    ['Website', 'website', 'https://aurelia.pk'],
  ])('reports an edit to %s (%s)', (label, field, value) => {
    const { cards } = renderModals({ openCard: 'location' })
    fireEvent.change(fieldFor(label), { target: { value } })
    expect(cards.setLocation).toHaveBeenCalledWith(
      expect.objectContaining({ [field]: value, city: field === 'city' ? value : 'Karachi' }),
    )
  })

  it('caps the address at the contract limit', () => {
    renderModals({ openCard: 'location' })
    expect(fieldFor('Full Address')).toHaveAttribute(
      'maxlength',
      String(PROFILE_LIMITS.fullAddress),
    )
  })

  it('saves through the location handler', async () => {
    const { cards } = renderModals({ openCard: 'location' })
    await userEvent.setup().click(saveButton())
    expect(cards.saveLocation).toHaveBeenCalled()
  })
})

describe('OverviewModals owner', () => {
  it('prefills the three owner fields', () => {
    renderModals({ openCard: 'owner' })
    const values = Array.from(fields()).map((node) => (node as HTMLInputElement).value)
    expect(values).toEqual(['Nadia Rahman', 'nadia@aurelia.pk', '+923009876543'])
  })

  it.each([
    [0, 'name', 'Laiba Hassan'],
    [1, 'email', 'laiba@aurelia.pk'],
    [2, 'phone', '+923001112222'],
  ])('reports an edit to %s (%s)', (index, field, value) => {
    const { cards } = renderModals({ openCard: 'owner' })
    fireEvent.change(fields()[index as number], { target: { value } })
    expect(cards.setOwner).toHaveBeenCalledWith(expect.objectContaining({ [field]: value }))
  })

  it('saves through the owner handler', async () => {
    const { cards } = renderModals({ openCard: 'owner' })
    await userEvent.setup().click(saveButton())
    expect(cards.saveOwner).toHaveBeenCalled()
  })
})

describe('OverviewModals rules', () => {
  it('prefills house rules and dress code', () => {
    renderModals({ openCard: 'rules' })
    const values = Array.from(fields()).map((node) => (node as HTMLInputElement).value)
    expect(values.slice(0, 2)).toEqual(['No smoking indoors.', 'Smart casual'])
  })

  /** 200, the limit the spec fixes in both the field table and the contract. */
  it('caps dress code at the specified 200', () => {
    renderModals({ openCard: 'rules' })
    expect(fields()[1]).toHaveAttribute('maxlength', '200')
    expect(PROFILE_LIMITS.dressCode).toBe(200)
  })

  it.each([
    [0, 'houseRules', 'No outside food.'],
    [1, 'dressCode', 'Formal'],
  ])('reports an edit to %s (%s)', (index, field, value) => {
    const { cards } = renderModals({ openCard: 'rules' })
    fireEvent.change(fields()[index as number], { target: { value } })
    expect(cards.setRules).toHaveBeenCalledWith(expect.objectContaining({ [field]: value }))
  })

  /** Opens the dropdown and resolves once its labels are on screen. */
  const openAlcoholSelect = async () => {
    fireEvent.mouseDown(screen.getByRole('combobox'))
    await screen.findAllByRole('option')
  }

  // Unanswered, so neither label is also mirrored in the closed-select display.
  it('offers exactly two answers for alcohol', async () => {
    renderModals({
      openCard: 'rules',
      rules: { houseRules: '', dressCode: '', servesAlcohol: undefined },
    })
    await openAlcoholSelect()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  /** Answering "no" is a real value and must arrive as boolean false. */
  it('reports a No answer as false, not a string', async () => {
    const { cards } = renderModals({ openCard: 'rules' })
    await openAlcoholSelect()
    fireEvent.click(screen.getByText('No'))
    expect(cards.setRules).toHaveBeenCalledWith(expect.objectContaining({ servesAlcohol: false }))
  })

  it('reports a Yes answer as true', async () => {
    const { cards } = renderModals({
      openCard: 'rules',
      rules: { houseRules: '', dressCode: '', servesAlcohol: undefined },
    })
    await openAlcoholSelect()
    fireEvent.click(screen.getByText('Yes'))
    expect(cards.setRules).toHaveBeenCalledWith(expect.objectContaining({ servesAlcohol: true }))
  })

  it('prompts for a choice while alcohol is unanswered', () => {
    renderModals({
      openCard: 'rules',
      rules: { houseRules: '', dressCode: '', servesAlcohol: undefined },
    })
    expect(screen.getByText('Select one')).toBeInTheDocument()
  })

  it('saves through the rules handler', async () => {
    const { cards } = renderModals({ openCard: 'rules' })
    await userEvent.setup().click(saveButton())
    expect(cards.saveRules).toHaveBeenCalled()
  })
})

describe('OverviewModals saving', () => {
  it('blocks a second save while one is in flight', () => {
    renderModals({ openCard: 'details', saving: true })
    expect(saveButton()).toBeDisabled()
  })
})
