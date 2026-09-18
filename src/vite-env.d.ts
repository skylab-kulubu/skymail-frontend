/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ADMIN_URL?: string;
  readonly VITE_FORMS_ADMIN_URL?: string;
  readonly VITE_MAIL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
