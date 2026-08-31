import React, { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import SplashScreen from './components/SplashScreen'
import OnboardingScreen from './components/OnboardingScreen'
import ChatWindow from './components/ChatWindow'

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
  const [screen, setScreen] = useState('splash')
  const [language, setLanguage] = useState('en')

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

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#fff',
    }}>
      {screen === 'splash' && (
        <SplashScreen onDone={() => setScreen('onboarding')} />
      )}
      {screen === 'onboarding' && (
        <OnboardingScreen
          language={language}
          onLanguageChange={setLanguage}
          onContinue={() => setScreen('chat')}
        />
      )}
      {screen === 'chat' && (
        <ChatWindow onBack={() => setScreen('onboarding')} language={language} />
      )}
    </div>
  )
}
