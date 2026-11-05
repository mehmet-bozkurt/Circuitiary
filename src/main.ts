import { createApp } from 'vue'
import Shell from './Shell.vue'
import './style.css'
import './theme.css'
import './print'
import { withBase } from './siteBase'

createApp(Shell).mount('#app')

// Offline use (public/sw.js): production builds only, and only where service workers
// exist. The dev server never registers one; a failed registration changes nothing.
// The worker and its scope sit under the deployment base (siteBase.ts), e.g. /Circuitiary/ on GitHub Pages.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = () => { navigator.serviceWorker.register(withBase('/sw.js'), { scope: withBase('/'), updateViaCache: 'none' }).catch(() => {}) }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
