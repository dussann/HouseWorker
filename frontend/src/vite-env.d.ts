/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly EXPO_PUBLIC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
