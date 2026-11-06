/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the Docs link points. Defaults to the docs dev server in dev and `./docs/` in builds. */
  readonly VITE_DOCS_URL?: string
}
