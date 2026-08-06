interface ImportMetaEnv {
    DEV: boolean;
    VITE_API_URL: string;
    VITE_HEALTH_URL?: string;
    VITE_THEMES_URL: string;
    /** Tenor v2 client key; the composer's GIF picker hides without it. */
    VITE_TENOR_KEY: string;
    BASE_URL: string;
}

interface ImportMeta {
    env: ImportMetaEnv;
}
