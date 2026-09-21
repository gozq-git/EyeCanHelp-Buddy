import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import OnboardingScreen from '../components/OnboardingScreen'

describe('OnboardingScreen', () => {
  it('renders the "EyeCanHelp Buddy" heading', () => {
    render(<OnboardingScreen onContinue={() => {}} />)
    expect(screen.getByRole('heading')).toHaveTextContent('EyeCanHelp Buddy')
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

  it('reports the picked language and marks it pressed', async () => {
    const onLanguageChange = vi.fn()
    render(<OnboardingScreen language="en" onLanguageChange={onLanguageChange} onContinue={() => {}} />)

    const chinese = screen.getByRole('button', { pressed: false, name: /中文/ })
    await userEvent.click(chinese)

    expect(onLanguageChange).toHaveBeenCalledWith('zh')
    // The active language is exposed via aria-pressed for assistive tech.
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument()
  })

  it('does not throw when no language handler is supplied', async () => {
    render(<OnboardingScreen language="en" onContinue={() => {}} />)

    await userEvent.click(screen.getByRole('button', { pressed: false, name: /中文/ }))
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument()
  })
})
