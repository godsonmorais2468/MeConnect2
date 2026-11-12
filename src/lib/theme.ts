/* Colour themes: an accent (sets the whole palette) plus a mode, dark or light.
   Both are kept on this device and set on <html data-theme="..." data-mode="...">. */
export type ThemeId = 'ocean' | 'emerald' | 'violet' | 'rose' | 'amber' | 'teal' | 'sunset' | 'magenta' | 'lime' | 'graphite'
export type Mode = 'dark' | 'light'

export const THEMES: { id: ThemeId; label: string; swatch: string; swatchHi: string }[] = [
  { id: 'ocean', label: 'Ocean', swatch: '#2563EB', swatchHi: '#84ADFF' },
  { id: 'emerald', label: 'Emerald', swatch: '#079455', swatchHi: '#6CE9A6' },
  { id: 'violet', label: 'Violet', swatch: '#7C3AED', swatchHi: '#B79CFF' },
  { id: 'rose', label: 'Rose', swatch: '#E11D48', swatchHi: '#FDA4AF' },
  { id: 'amber', label: 'Amber', swatch: '#D97706', swatchHi: '#FCD34D' },
  { id: 'teal', label: 'Teal', swatch: '#0D9488', swatchHi: '#5EEAD4' },
  { id: 'sunset', label: 'Sunset', swatch: '#EA580C', swatchHi: '#FDBA74' },
  { id: 'magenta', label: 'Magenta', swatch: '#C026D3', swatchHi: '#F0ABFC' },
  { id: 'lime', label: 'Lime', swatch: '#65A30D', swatchHi: '#BEF264' },
  { id: 'graphite', label: 'Graphite', swatch: '#475569', swatchHi: '#CBD5E1' },
]

const KEY = 'mc.theme'
const MODE_KEY = 'mc.mode'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null /* storage blocked: fall back to the defaults */
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* not saved, still applied for this visit */
  }
}

export function getTheme(): ThemeId {
  const v = read(KEY)
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'ocean'
}

export function getMode(): Mode {
  /* an earlier version stored "light" as a theme of its own */
  return read(MODE_KEY) === 'light' || read(KEY) === 'light' ? 'light' : 'dark'
}

export function initTheme() {
  const root = document.documentElement
  root.setAttribute('data-theme', getTheme())
  root.setAttribute('data-mode', getMode())
}

export function setTheme(id: ThemeId) {
  document.documentElement.setAttribute('data-theme', id)
  write(KEY, id)
}

export function setMode(mode: Mode) {
  document.documentElement.setAttribute('data-mode', mode)
  write(MODE_KEY, mode)
}
