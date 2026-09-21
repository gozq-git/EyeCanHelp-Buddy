import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

// AppShell owns only the screen/language state. The three screens are stubbed so the
// transitions can be asserted without dragging in ChatWindow's whole API layer.
vi.mock('../components/SplashScreen', () => ({
  default: ({ onDone }) => <button onClick={onDone}>finish splash</button>,
}))
vi.mock('../components/OnboardingScreen', () => ({
  default: ({ language, onLanguageChange, onContinue }) => (
    <div>
      <span>onboarding language: {language}</span>
      <button onClick={() => onLanguageChange('zh')}>choose zh</button>
      <button onClick={onContinue}>continue</button>
    </div>
  ),
}))
vi.mock('../components/ChatWindow', () => ({
  default: ({ language, onBack }) => (
    <div>
      <span>chat language: {language}</span>
      <button onClick={onBack}>back</button>
    </div>
  ),
}))

import AppShell from '../AppShell'

describe('AppShell', () => {
  it('opens on the splash screen', () => {
    render(<AppShell />)

    expect(screen.getByRole('button', { name: 'finish splash' })).toBeInTheDocument()
    expect(screen.queryByText(/onboarding language/)).not.toBeInTheDocument()
  })

  it('advances splash → onboarding → chat', async () => {
    render(<AppShell />)

    await userEvent.click(screen.getByRole('button', { name: 'finish splash' }))
    expect(screen.getByText('onboarding language: en')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(screen.getByText('chat language: en')).toBeInTheDocument()
  })

  it('carries the chosen language from onboarding into chat', async () => {
    render(<AppShell />)

    await userEvent.click(screen.getByRole('button', { name: 'finish splash' }))
    await userEvent.click(screen.getByRole('button', { name: 'choose zh' }))
    expect(screen.getByText('onboarding language: zh')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(screen.getByText('chat language: zh')).toBeInTheDocument()
  })

  it('returns from chat to onboarding, keeping the language', async () => {
    render(<AppShell />)

    await userEvent.click(screen.getByRole('button', { name: 'finish splash' }))
    await userEvent.click(screen.getByRole('button', { name: 'choose zh' }))
    await userEvent.click(screen.getByRole('button', { name: 'continue' }))

    await userEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.getByText('onboarding language: zh')).toBeInTheDocument()
    expect(screen.queryByText(/chat language/)).not.toBeInTheDocument()
  })
})
