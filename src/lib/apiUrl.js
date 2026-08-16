import { resolveApiUrl } from "./apiUrlCore";

export { isRevoltApiUrl } from "./apiUrlCore";

// The marketplace is a PepChat surface. Fail closed to PepChat if a stale
// build-time variable would otherwise send credentials to Revolt.
export const API_URL = resolveApiUrl(
    import.meta.env.VITE_API_URL,
    typeof window === "undefined" ? "" : window.location.hostname,
);
