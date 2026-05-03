import React, { useEffect } from 'react'
import EyeLogoSVG from './EyeLogoSVG'

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#3B6EF8',
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #ffffff 60%, #ddeeff)',
        borderRadius: '40px',
        padding: '40px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
      }}>
        <EyeLogoSVG size={120} />
      </div>
    </div>
  )
}
