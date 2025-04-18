/// <reference types="vite/client" />

interface ViteTypeOptions {
  // 添加这行代码，你就可以将 ImportMetaEnv 的类型设为严格模式，
  // 这样就不允许有未知的键值了。
  // strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_REMIX_URL: string;
  readonly VITE_REMIX_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
