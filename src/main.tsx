import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './design/index.css'
import { initPerf } from './lib/perf'
import { initTheme } from './lib/theme'
import App from './App.tsx'
import Splash from './components/Splash'
import { reloadForNewVersion } from './lib/staleBuild'

/* Installable app: the service worker is registered on the live site only, so development is never served from a cache. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* no worker: the site still works, it just cannot be installed or opened offline */
    })
  })
}

/* A page file that has gone missing (a new version went live while this tab was open): load the new version once instead of leaving a blank page. */
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadForNewVersion()
})

initPerf()
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    <Splash />
  </StrictMode>,
)
