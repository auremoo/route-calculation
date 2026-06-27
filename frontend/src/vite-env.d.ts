/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_GH_PAGES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
