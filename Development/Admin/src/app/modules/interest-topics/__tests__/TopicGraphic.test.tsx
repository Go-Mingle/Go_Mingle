import { describe, it, expect } from 'vitest'
import { screen, fireEvent, renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { TopicGraphic } from '../components/TopicGraphic'

describe('TopicGraphic', () => {
  it('renders the image when a graphicUrl is provided', () => {
    renderWithProviders(
      <TopicGraphic graphicUrl="https://cdn.example.test/topics/a.png" name="Wine & Dine" />,
    )
    const img = screen.getByRole('img', { name: 'Wine & Dine' })
    expect(img).toHaveAttribute('src', 'https://cdn.example.test/topics/a.png')
  })

  it('falls back to a letter avatar when the image fails to load', () => {
    renderWithProviders(
      <TopicGraphic graphicUrl="https://cdn.example.test/expired.png" name="Wine & Dine" />,
    )
    fireEvent.error(screen.getByRole('img'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('W')).toBeInTheDocument()
  })

  it('renders a letter avatar when there is no graphicUrl', () => {
    renderWithProviders(<TopicGraphic graphicUrl={null} name="dummy topic" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('renders a "?" when the name is empty', () => {
    renderWithProviders(<TopicGraphic graphicUrl={null} name="   " />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
