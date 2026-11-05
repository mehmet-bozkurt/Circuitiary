// Where the app is served from, and whether this build is the online demo.
//
// BASE is '/' for a normal deployment and '/Circuitiary/' on the GitHub Pages project site
// (CIRCUITIARY_BASE, validated in vite.config.ts; always starts and ends with '/').
// DEMO is true only in the build the Pages workflow makes (VITE_DEMO=1): it has no local data endpoint.
// With the default base every function below returns its input unchanged, so a root deployment behaves exactly as before.

export const BASE: string = import.meta.env.BASE_URL
export const DEMO: boolean = import.meta.env.VITE_DEMO === '1'

/** Turns an app path ('/ogren/sozluk', '/') into an address under the base ('/Circuitiary/ogren/sozluk'). */
export function withBase(path: string, base: string = BASE): string {
  return base + path.replace(/^\//, '')
}

/** The inverse: the part of a location's pathname after the base, always starting with '/'. A pathname outside the base is returned as it is. */
export function appPath(pathname: string, base: string = BASE): string {
  if (base === '/') return pathname
  if (pathname === base.slice(0, -1)) return '/'
  return pathname.startsWith(base) ? pathname.slice(base.length - 1) : pathname
}

/** The local-only data endpoint served by the Vite dev and preview servers (vite.local-data.ts). */
export const LOCAL_DATA_URL: string = withBase('/api/local-connectome')

/** Shown instead of the "local data not found" states in the online demo, which never has the data. */
export const DEMO_DATA_NOTICE = 'Bu çevrimiçi demoda gerçek veri yoktur: veri kümesinin dağıtım lisansı doğrulanmadığı için depoya konmaz. Yerel kurulumda kendi indirdiğin dosyalarla çalışır (README).'
