/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where "Home" points. Defaults to the web dev server in dev and `../` in builds. */
  readonly VITE_WEB_URL?: string
}
