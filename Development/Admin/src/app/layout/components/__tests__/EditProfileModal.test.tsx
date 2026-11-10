import { describe, it, expect, vi, afterEach } from 'vitest'
import { message } from 'antd'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { EditProfileModal } from '../EditProfileModal'

// EditProfileModal calls the static `message.error(...)` API, which renders
// into a portal outside the component tree and isn't cleaned up by RTL's
// per-test unmount — clear it so one test's toast can't leak into the next.
afterEach(() => {
  message.destroy()
})

function setup(overrides: Partial<React.ComponentProps<typeof EditProfileModal>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    initials: 'SA',
    userName: 'Sam Admin',
    userEmail: 'sam@example.com',
    ...overrides,
  }
  renderWithProviders(<EditProfileModal {...props} />)
  return props
}

function getFileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

describe('EditProfileModal', () => {
  it('renders prefilled name and email fields', () => {
    setup()
    expect(screen.getByDisplayValue('Sam Admin')).toBeInTheDocument()
    expect(screen.getByDisplayValue('sam@example.com')).toBeInTheDocument()
  })

  it('previews a valid non-SVG image upload', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:preview-url')
    Object.assign(URL, { createObjectURL })

    setup()
    const file = new File(['fake-image-bytes'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    expect(createObjectURL).toHaveBeenCalledWith(file)
  })

  it('rejects an SVG containing an embedded <script> tag as unsafe, only once Save is pressed', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:preview-url')
    Object.assign(URL, { createObjectURL })

    const props = setup()
    const user = userEvent.setup()
    const malicious = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      'evil.svg',
      { type: 'image/svg+xml' },
    )
    fireEvent.change(getFileInput(), { target: { files: [malicious] } })

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled(), { timeout: 5000 })
    // No preview was ever created for the corrupt file — before or after Save.
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(props.onSave).not.toHaveBeenCalled()

    await user.click(saveBtn)

    // antd's static message API doesn't tear its portal down synchronously
    // between tests, so a prior test's toast can still be in the DOM —
    // assert at least one match rather than exactly one.
    await waitFor(() =>
      expect(
        screen.getAllByText('The selected file is unsafe, please upload another.').length,
      ).toBeGreaterThan(0),
    )
    expect(createObjectURL).not.toHaveBeenCalled()
    // Save was intercepted — the parent's onSave (and therefore onClose) never fires.
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('rejects an SVG containing an external xlink:href reference as unsafe, only once Save is pressed', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:preview-url')
    Object.assign(URL, { createObjectURL })

    const props = setup()
    const user = userEvent.setup()
    const malicious = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="https://evil.example.com/payload.svg"></use></svg>',
      ],
      'evil.svg',
      { type: 'image/svg+xml' },
    )
    fireEvent.change(getFileInput(), { target: { files: [malicious] } })

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled(), { timeout: 5000 })
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(props.onSave).not.toHaveBeenCalled()

    await user.click(saveBtn)

    // antd's static message API doesn't tear its portal down synchronously
    // between tests, so a prior test's toast can still be in the DOM —
    // assert at least one match rather than exactly one.
    await waitFor(() =>
      expect(
        screen.getAllByText('The selected file is unsafe, please upload another.').length,
      ).toBeGreaterThan(0),
    )
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('disables the Save button while a selected SVG is still being read', async () => {
    setup()
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()

    await waitFor(
      () => expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled(),
      { timeout: 5000 },
    )
  })

  it('calls onClose and onSave from footer buttons', async () => {
    const props = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(props.onClose).toHaveBeenCalled()
    expect(props.onSave).toHaveBeenCalled()
  })
})
