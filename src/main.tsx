import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()))
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
}