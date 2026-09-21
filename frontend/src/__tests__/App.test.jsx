import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('react-oidc-context', () => ({ useAuth: mocks.useAuth }))
vi.mock('../AppShell', () => ({ default: () => <div>app shell</div> }))

import App from '../App'

// The four states App can be in are driven entirely by the useAuth() result.
const authState = (overrides = {}) => ({
  isLoading: false,
  error: null,
  isAuthenticated: false,
  signinRedirect: vi.fn(),
  ...overrides,
})

describe('App — Cognito auth gate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows a loading placeholder while the session resolves', () => {
    const auth = authState({ isLoading: true })
    mocks.useAuth.mockReturnValue(auth)

    render(<App />)

    expect(screen.getByText(/Loading/)).toBeInTheDocument()
    // Nothing to redirect to yet — the session is still being restored.
    expect(auth.signinRedirect).not.toHaveBeenCalled()
  })

  it('surfaces a sign-in error instead of retrying the redirect', () => {
    const auth = authState({ error: new Error('state mismatch') })
    mocks.useAuth.mockReturnValue(auth)

    render(<App />)

    expect(screen.getByText(/Sign-in error: state mismatch/)).toBeInTheDocument()
    expect(auth.signinRedirect).not.toHaveBeenCalled()
  })

  it('redirects to sign in when unauthenticated', async () => {
    const auth = authState()
    mocks.useAuth.mockReturnValue(auth)

    render(<App />)

    expect(screen.getByText(/Redirecting to sign in/)).toBeInTheDocument()
    await waitFor(() => expect(auth.signinRedirect).toHaveBeenCalledOnce())
    expect(screen.queryByText('app shell')).not.toBeInTheDocument()
  })

  it('renders the app shell once authenticated', async () => {
    const auth = authState({ isAuthenticated: true })
    mocks.useAuth.mockReturnValue(auth)

    render(<App />)

    expect(screen.getByText('app shell')).toBeInTheDocument()
    expect(auth.signinRedirect).not.toHaveBeenCalled()
  })
})
