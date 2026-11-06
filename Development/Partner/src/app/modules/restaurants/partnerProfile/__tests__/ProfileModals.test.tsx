import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import {
  NameLocationModal,
  PaymentsReturnNotice,
  RestaurantImageModal,
  SetUpPaymentsModal,
} from '../components/ProfileModals'
import { PROFILE_LIMITS } from '../constants'
import type { useProfilePage } from '../hooks/useProfilePage'
import type { PartnerRestaurantProfile } from '../types'

type ProfileController = ReturnType<typeof useProfilePage>

function profileFixture(
  overrides: Partial<PartnerRestaurantProfile> = {},
): PartnerRestaurantProfile {
  return {
    id: 'r-1',
    name: 'Aurelia',
    status: 'DRAFT',
    coverPhotoUrl: null,
    paymentConfigured: false,
    editable: true,
    location: { fullAddress: null, areaDistrict: 'Korangi', city: 'Karachi' },
    restaurant: {},
    owner: {},
    rules: {},
    rejections: [],
    ...overrides,
  } as PartnerRestaurantProfile
}

function controller(overrides: Partial<ProfileController> = {}): ProfileController {
  return {
    profile: profileFixture(),
    isPending: false,
    isError: false,
    error: null,
    status: 'DRAFT',
    editable: true,
    readiness: undefined,
    rejections: [],
    nameOpen: false,
    openNameModal: vi.fn(),
    closeNameModal: vi.fn(),
    nameForm: { name: 'Aurelia', areaDistrict: 'Korangi', city: 'Karachi' },
    setNameForm: vi.fn(),
    nameErrors: {},
    nameBlocked: false,
    saveNameLocation: vi.fn(),
    imageOpen: false,
    openImageModal: vi.fn(),
    closeImageModal: vi.fn(),
    paymentsOpen: false,
    openPayments: vi.fn(),
    closePayments: vi.fn(),
    launchPayments: vi.fn(),
    launchingPayments: false,
    paymentsError: null,
    paymentsReturnState: 'none',
    dismissPaymentsReturn: vi.fn(),
    checkPaymentsAgain: vi.fn(),
    checkingPayments: false,
    toggleVisibility: vi.fn(),
    handleSubmit: vi.fn(),
    submitting: false,
    blockers: null,
    cardsNeedingAttention: new Set(),
    clearBlockers: vi.fn(),
    saving: false,
    showError: vi.fn(),
    wirePhone: (value: string) => value,
    ...overrides,
  } as ProfileController
}

function modalInputs() {
  const modal = document.querySelector('.ant-modal') as HTMLElement
  return Array.from(modal.querySelectorAll('input'))
}

describe('NameLocationModal', () => {
  const render = (overrides: Partial<ProfileController> = {}) => {
    const c = controller({ nameOpen: true, ...overrides })
    renderWithProviders(<NameLocationModal c={c} />)
    return c
  }

  it('stays closed until asked', () => {
    const c = controller()
    renderWithProviders(<NameLocationModal c={c} />)
    expect(document.querySelector('.ant-modal')).toBeNull()
  })

  it('prefills name, area and city', () => {
    render()
    expect(modalInputs().map((node) => node.value)).toEqual(['Aurelia', 'Korangi', 'Karachi'])
  })

  it.each([
    [0, 'name', PROFILE_LIMITS.name],
    [1, 'areaDistrict', PROFILE_LIMITS.areaDistrict],
    [2, 'city', PROFILE_LIMITS.city],
  ])('caps %s (%s) at its contract limit', (index, _field, limit) => {
    render()
    expect(modalInputs()[index as number]).toHaveAttribute('maxlength', String(limit))
  })

  it.each([
    [0, 'name', 'Aurelia Rooftop'],
    [1, 'areaDistrict', 'Shahrah-e-Faisal'],
    [2, 'city', 'Lahore'],
  ])('reports an edit to %s (%s) without dropping the others', (index, field, value) => {
    const c = render()
    fireEvent.change(modalInputs()[index as number], { target: { value } })
    expect(c.setNameForm).toHaveBeenCalledWith({
      name: 'Aurelia',
      areaDistrict: 'Korangi',
      city: 'Karachi',
      [field]: value,
    })
  })

  /** Name is the only required field here. */
  it('disables Save while the card holds errors', () => {
    render({ nameBlocked: true })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('renders an inline error against its field', () => {
    render({ nameErrors: { name: 'Restaurant name is required.' } })
    expect(screen.getByText('Restaurant name is required.')).toBeInTheDocument()
  })

  it('disables Save while a save is in flight', () => {
    render({ saving: true })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('saves through the controller', async () => {
    const c = render()
    await userEvent.setup().click(screen.getByRole('button', { name: /^save$/i }))
    expect(c.saveNameLocation).toHaveBeenCalled()
  })

  it('cancels without saving', async () => {
    const c = render()
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(c.closeNameModal).toHaveBeenCalled()
    expect(c.saveNameLocation).not.toHaveBeenCalled()
  })
})

describe('RestaurantImageModal', () => {
  const render = (overrides: Partial<ProfileController> = {}) => {
    const c = controller({ imageOpen: true, ...overrides })
    renderWithProviders(<RestaurantImageModal c={c} />)
    return c
  }

  it('shows the placeholder when there is no cover photo', () => {
    render()
    expect(screen.getByText(/no cover photo yet/i)).toBeInTheDocument()
    expect(document.querySelector('.ant-modal img')).toBeNull()
  })

  it('shows the cover photo when there is one', () => {
    render({ profile: profileFixture({ coverPhotoUrl: 'https://cdn.example/cover.jpg' }) })
    expect(document.querySelector('.ant-modal img')).toHaveAttribute(
      'src',
      'https://cdn.example/cover.jpg',
    )
  })

  /**
   * The cover is not editable here. J6B owns photo upload and cover designation,
   * and there is no separate cover store — the cover is whichever photo
   * `main_photo_key` points at — so this modal previews and redirects.
   *
   * Asserted rather than merely commented (MET-1251). BR-08 asks for a Replace
   * action in this modal and the build deliberately has none, so QA reads the
   * absence as the defect it filed. Pinning it here makes the decision visible
   * to the next person in the file: re-adding an upload would fail this test,
   * which is where the reasoning lives. The type and size rules BR-08 attaches
   * to that action are covered in the J6B suite instead — see
   * `useMediaUpload.test.ts` and `usePhotosVideosTab.test.ts`.
   */
  it('offers no upload control, by design', () => {
    render({ profile: profileFixture({ coverPhotoUrl: 'https://cdn.example/cover.jpg' }) })
    const modal = document.querySelector('.ant-modal') as HTMLElement

    expect(modal.querySelectorAll('input[type=file]')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /replace/i })).not.toBeInTheDocument()
  })

  /**
   * The footer is gone so the image gets the whole modal. The dialog's own X is
   * the only close affordance, and the tooltip is the only pointer to the gallery.
   */
  it('gives the image the whole modal, with no footer buttons', () => {
    render({ profile: profileFixture({ coverPhotoUrl: 'https://cdn.example/cover.jpg' }) })

    expect(document.querySelector('.app-modal-footer')).toBeNull()
    expect(screen.queryByRole('button', { name: /go to photos & videos/i })).not.toBeInTheDocument()
    // AntD's own dismiss X is also named "Close", so the footer's absence is the
    // assertion — not the absence of anything called close.
    expect(document.querySelector('.ant-modal-close')).toBeInTheDocument()
  })

  /** Capped against the viewport rather than forced into a ratio, so nothing crops. */
  it('renders the cover at its own aspect ratio', () => {
    render({ profile: profileFixture({ coverPhotoUrl: 'https://cdn.example/cover.jpg' }) })

    const image = document.querySelector('.ant-modal img') as HTMLElement
    expect(image.className).toContain('object-contain')
    expect(image.className).toContain('max-h-[70vh]')
    expect(image.className).not.toContain('object-cover')
  })

  /**
   * The explanation moved out of a block under the preview and into an info
   * tooltip on the title, so it is no longer on-screen text. The trigger carries
   * it as an `aria-label` too — a tooltip alone would leave the copy reachable
   * only by pointer.
   */
  it('explains where the cover is managed through a title tooltip', async () => {
    render()

    expect(document.querySelector('.ant-alert')).toBeNull()

    const info = screen.getByRole('button', { name: /display picture/i })
    expect(info).toBeInTheDocument()

    await userEvent.setup().hover(info)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /first photo you upload becomes your display picture/i,
    )
  })

  /** The dialog's own X is now the only way out. */
  it('closes through the controller', async () => {
    const c = render()
    const dismiss = document.querySelector('.ant-modal-close') as HTMLElement
    await userEvent.setup().click(dismiss)
    expect(c.closeImageModal).toHaveBeenCalled()
  })

  it('renders nothing while closed', () => {
    const c = controller()
    renderWithProviders(<RestaurantImageModal c={c} />)
    expect(document.querySelector('.ant-modal')).toBeNull()
  })
})

describe('SetUpPaymentsModal', () => {
  const render = (overrides: Partial<ProfileController> = {}) => {
    const c = controller({ paymentsOpen: true, ...overrides })
    renderWithProviders(<SetUpPaymentsModal c={c} />)
    return c
  }

  it('renders nothing while closed', () => {
    const c = controller()
    renderWithProviders(<SetUpPaymentsModal c={c} />)
    expect(document.querySelector('.ant-modal')).toBeNull()
  })

  it('proceeds to the hand-off', async () => {
    const c = render()
    await userEvent.setup().click(screen.getByRole('button', { name: /add payout account/i }))
    expect(c.launchPayments).toHaveBeenCalled()
  })

  /** A second click would mint a second single-use link and waste the first. */
  it('blocks a second proceed while a link is being minted', () => {
    render({ launchingPayments: true })
    expect(screen.getByRole('button', { name: /add payout account/i })).toBeDisabled()
  })

  it('shows nothing alarming before anything has been tried', () => {
    render()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(document.querySelector('.ant-alert-error')).toBeNull()
  })

  /**
   * MET-1254. The dialog used to close the instant Proceed was pressed, so a 502
   * from the onboarding endpoint read as success. A failure now stays on screen
   * and says what happened.
   */
  it('surfaces a failed hand-off inline', () => {
    render({ paymentsError: "Couldn't start payment setup. Please try again." })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/couldn't start payment setup/i)
    // Still on screen — the dialog is not dismissed by the failure.
    expect(document.querySelector('.ant-modal')).toBeInTheDocument()
  })

  /** Holding the dialog open is only useful if there is a way to try again. */
  it('offers a retry rather than a dead end', async () => {
    const c = render({ paymentsError: 'Safepay is unavailable.' })

    const retry = screen.getByRole('button', { name: /try again/i })
    expect(retry).toBeEnabled()
    expect(screen.queryByRole('button', { name: /add payout account/i })).not.toBeInTheDocument()

    await userEvent.setup().click(retry)
    expect(c.launchPayments).toHaveBeenCalled()
  })

  it('blocks the retry while the next link is being minted', () => {
    render({ paymentsError: 'Safepay is unavailable.', launchingPayments: true })
    expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled()
  })

  it('still cancels out of a failed hand-off', async () => {
    const c = render({ paymentsError: 'Safepay is unavailable.' })
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(c.closePayments).toHaveBeenCalled()
  })

  it('cancels without launching', async () => {
    const c = render()
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(c.closePayments).toHaveBeenCalled()
    expect(c.launchPayments).not.toHaveBeenCalled()
  })
})

describe('PaymentsReturnNotice', () => {
  const render = (overrides: Partial<ProfileController> = {}) => {
    const c = controller(overrides)
    const view = renderWithProviders(<PaymentsReturnNotice c={c} />)
    return { c, ...view }
  }

  it.each(['none', 'refreshing'] as const)('renders nothing while %s', (paymentsReturnState) => {
    const { container } = render({ paymentsReturnState })
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * `paymentConfigured` can still be false right after a return — it flips only
   * when Safepay's webhook lands — so this reads as verifying, never as failed.
   */
  it('reads as verifying while the webhook has not landed', () => {
    render({
      paymentsReturnState: 'returned',
      profile: profileFixture({ paymentConfigured: false }),
    })
    expect(screen.getByText(/still verifying/i)).toBeInTheDocument()
    expect(screen.queryByText(/fail/i)).not.toBeInTheDocument()
  })

  it('confirms once the webhook has landed', () => {
    render({
      paymentsReturnState: 'returned',
      profile: profileFixture({ paymentConfigured: true }),
    })
    expect(screen.getByText(/payment account is set up/i)).toBeInTheDocument()
  })

  it('dismisses through the controller', async () => {
    const { c } = render({ paymentsReturnState: 'returned' })
    await userEvent.setup().click(document.querySelector('.ant-alert-close-icon') as HTMLElement)
    expect(c.dismissPaymentsReturn).toHaveBeenCalled()
  })
})
