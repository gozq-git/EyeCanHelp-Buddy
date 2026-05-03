import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import OnboardingScreen from '../components/OnboardingScreen'

describe('OnboardingScreen', () => {
  it('renders the "You AI Assistant" heading', () => {
    render(<OnboardingScreen onContinue={() => {}} />)
    expect(screen.getByRole('heading')).toHaveTextContent('You AI Assistant')
  })

  it('renders a Continue button', () => {
    render(<OnboardingScreen onContinue={() => {}} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('calls onContinue when Continue is clicked', async () => {
    const onContinue = vi.fn()
    render(<OnboardingScreen onContinue={onContinue} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('renders the robot illustration SVG', () => {
    const { container } = render(<OnboardingScreen onContinue={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
