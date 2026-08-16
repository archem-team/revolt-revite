const PEPCHAT_API_URL = "https://peptide.chat/api";
const REVOLT_API_URLS = new Set([
    "https://api.revolt.chat",
    "https://app.revolt.chat/api",
    "https://revolt.chat/api",
]);

export function isRevoltApiUrl(value) {
    return REVOLT_API_URLS.has(String(value || "").replace(/\/+$/, ""));
}

export function resolveApiUrl(configuredUrl, hostname = "") {
    const normalized = String(configuredUrl || PEPCHAT_API_URL).replace(/\/+$/, "");
    return hostname === "market.peptide.chat" && isRevoltApiUrl(normalized)
        ? PEPCHAT_API_URL
        : normalized;
}
