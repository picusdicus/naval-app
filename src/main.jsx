import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
// La captura de `beforeinstallprompt` debe registrarse antes de que el
// navegador lo emita (puede ser antes de montar React) — ver lib/instalacion.js.
import './lib/instalacion.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Registrar service worker para PWA — solo en producción: su cache-first
// sobre los módulos JS de Vite servía bundles rancios durante el desarrollo.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}
