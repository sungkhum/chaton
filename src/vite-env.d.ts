/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NODE_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_PROFILE_URL: string;
  readonly VITE_IDENTITY_URL: string;
  readonly VITE_IS_TESTNET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
