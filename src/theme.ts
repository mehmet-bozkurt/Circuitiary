import { onBeforeUnmount, onMounted, ref } from 'vue'

type ThemePreference = 'system' | 'light' | 'dark'
const storageKey = 'circuitiary-theme'
const isPreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark'

export function useTheme() {
  const initial = document.documentElement.dataset.themePreference
  const preference = ref<ThemePreference>(isPreference(initial) ? initial : 'system')
  const system = window.matchMedia('(prefers-color-scheme: dark)')

  function apply() {
    const dark = preference.value === 'dark' || (preference.value === 'system' && system.matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.themePreference = preference.value
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121d19' : '#f5f4ed')
  }

  function changeTheme(event: Event) {
    const value = (event.target as HTMLSelectElement).value
    if (!isPreference(value)) return
    preference.value = value
    apply()
    try { localStorage.setItem(storageKey, value) } catch { /* The theme still works when storage is unavailable. */ }
  }

  function syncStorage(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return
    preference.value = isPreference(event.newValue) ? event.newValue : 'system'
    apply()
  }

  apply()
  onMounted(() => {
    system.addEventListener('change', apply)
    window.addEventListener('storage', syncStorage)
  })
  onBeforeUnmount(() => {
    system.removeEventListener('change', apply)
    window.removeEventListener('storage', syncStorage)
  })
  return { preference, changeTheme }
}
