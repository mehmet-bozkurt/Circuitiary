// Printing: every collapsed <details> is opened for the print job and put back afterwards.
// The page's own look for paper (hidden controls, forced light palette) lives in @media print.

/** Each <details> opened for printing, with the state it had before. */
const previous = new Map<HTMLDetailsElement, boolean>()

/** Opens every <details>, remembering each one's own state. A repeated call keeps the first remembered state. */
export function openDetailsForPrint(root: ParentNode = document): void {
  root.querySelectorAll('details').forEach(details => {
    if (!previous.has(details)) previous.set(details, details.open)
    details.open = true
  })
}

/** Puts every <details> opened by openDetailsForPrint back as it was. Also runs when the print dialog is cancelled. */
export function restoreDetailsAfterPrint(): void {
  previous.forEach((wasOpen, details) => { details.open = wasOpen })
  previous.clear()
}

/**
 * The 2D connection map is drawn into canvases sized for the screen layout; a narrower print layout would clip them.
 * Each one is copied into a single canvas that scales to the page (shown only in @media print), the live one is hidden.
 */
const snapshots: HTMLCanvasElement[] = []

export function addCanvasSnapshotsForPrint(root: ParentNode = document): void {
  // A second beforeprint without an afterprint in between must not stack copies.
  removeCanvasSnapshots()
  root.querySelectorAll<HTMLElement>('.circuit-canvas').forEach(container => {
    const layers = [...container.querySelectorAll('canvas')]
    // A hidden page or an inactive view has nothing to print. The container itself is already hidden when printing is emulated, so its parent is checked.
    if (!layers.length || !container.parentElement?.checkVisibility()) return
    const flat = document.createElement('canvas')
    flat.width = Math.max(...layers.map(layer => layer.width))
    flat.height = Math.max(...layers.map(layer => layer.height))
    const context = flat.getContext('2d')
    if (!context) return
    layers.forEach(layer => context.drawImage(layer, 0, 0))
    flat.className = 'print-snapshot'
    flat.setAttribute('aria-hidden', 'true')
    container.after(flat)
    snapshots.push(flat)
  })
}

export function removeCanvasSnapshots(): void {
  snapshots.forEach(snapshot => snapshot.remove())
  snapshots.length = 0
}

window.addEventListener('beforeprint', () => { openDetailsForPrint(); addCanvasSnapshotsForPrint() })
window.addEventListener('afterprint', () => { restoreDetailsAfterPrint(); removeCanvasSnapshots() })
