import React, { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import AppShell from './AppShell'

const fullScreenCenter = {
  height: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  background: '#fff',
  color: '#555',
}

export default function App() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.isLoading && !auth.error && !auth.isAuthenticated) {
      auth.signinRedirect()
    }
  }, [auth.isLoading, auth.error, auth.isAuthenticated])

  if (auth.isLoading) {
    return <div style={fullScreenCenter}>Loading…</div>
  }

  if (auth.error) {
    return <div style={fullScreenCenter}>Sign-in error: {auth.error.message}</div>
  }

  if (!auth.isAuthenticated) {
    return <div style={fullScreenCenter}>Redirecting to sign in…</div>
  }

  return <AppShell />
}
