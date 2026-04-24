/// <reference types="vite/client" />

type ViteTypeOptions = Record<string, never>;

interface ImportMetaEnv {
  readonly VITE_REMIX_URL: string;
  readonly VITE_REMIX_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
