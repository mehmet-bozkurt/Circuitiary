import { createApp } from 'vue'
import Shell from './Shell.vue'
import './style.css'
import './theme.css'
import './print'

createApp(Shell).mount('#app')

// Offline use (public/sw.js): production builds only, and only where service workers
// exist. The dev server never registers one; a failed registration changes nothing.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = () => { navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {}) }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
