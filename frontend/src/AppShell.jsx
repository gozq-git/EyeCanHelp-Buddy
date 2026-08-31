import React, { useState } from 'react'
import SplashScreen from './components/SplashScreen'
import OnboardingScreen from './components/OnboardingScreen'
import ChatWindow from './components/ChatWindow'

export default function AppShell() {
  const [screen, setScreen] = useState('splash')
  const [language, setLanguage] = useState('en')

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
