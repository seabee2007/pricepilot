/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EBAY_CLIENT_ID: string
  readonly VITE_EBAY_CLIENT_SECRET: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly ELEVEN_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
