export const REPO = 'sefi-uzan/owltrack'
export const GITHUB_URL = `https://github.com/${REPO}`
export const RELEASES_URL = `${GITHUB_URL}/releases/latest`
export const ISSUES_URL = `${GITHUB_URL}/issues`

/** The landing page is a separate app; point VITE_WEB_URL at wherever it's deployed. */
export const WEB_URL = import.meta.env.VITE_WEB_URL ?? (import.meta.env.DEV ? 'http://localhost:5173/' : '../')
