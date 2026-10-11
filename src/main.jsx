import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices embarquées (pas de Google Fonts : le LAN du restaurant n'a pas forcément Internet)
import '@fontsource-variable/libre-franklin'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource/archivo-black/latin.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
