export const REPO = 'sefi-uzan/owltrack'
export const GITHUB_URL = `https://github.com/${REPO}`
export const RELEASES_URL = `${GITHUB_URL}/releases/latest`

/** The docs are a separate app; point VITE_DOCS_URL at wherever it's deployed. */
export const DOCS_URL = import.meta.env.VITE_DOCS_URL ?? (import.meta.env.DEV ? 'http://localhost:5174/' : './docs/')
