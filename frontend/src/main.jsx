import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import App from './App.jsx'

const cognitoAuthConfig = {
  authority: 'https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_nDlvUcu1z',
  client_id: '75uuuhrigm4f2ntp6dlehq2ha7',
  redirect_uri: 'https://d3el92ejjxmmtz.cloudfront.net/',
  response_type: 'code',
  scope: 'email openid phone',
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
