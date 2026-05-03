import React, { useState } from 'react'
import SplashScreen from './components/SplashScreen'
import OnboardingScreen from './components/OnboardingScreen'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const [screen, setScreen] = useState('splash')

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
        <OnboardingScreen onContinue={() => setScreen('chat')} />
      )}
      {screen === 'chat' && (
        <ChatWindow />
      )}
    </div>
  )
}
