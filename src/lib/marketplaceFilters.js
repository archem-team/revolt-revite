export function normalizeCountryCode(value) {
    return String(value).replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
}
