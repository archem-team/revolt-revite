/**
 * Extract a server-provided retry delay without coupling the composer to Axios.
 * APIs commonly return seconds in Retry-After / retry_after; large numeric
 * values are treated as milliseconds to tolerate gateway implementations.
 */
export function getRetryAfterMs(error, now = Date.now()) {
    const headers = error?.response?.headers;
    const header =
        headers?.["retry-after"] ??
        (typeof headers?.get === "function"
            ? headers.get("retry-after")
            : null);

    if (header !== undefined && header !== null) {
        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

        const date = Date.parse(String(header));
        if (Number.isFinite(date)) return Math.max(0, date - now);
    }

    const value =
        error?.response?.data?.retry_after ??
        error?.response?.data?.retryAfter ??
        error?.retry_after;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;

    return numeric > 1000 ? numeric : numeric * 1000;
}

export function retrySeconds(retryAt, now = Date.now()) {
    if (!retryAt) return 0;
    return Math.max(0, Math.ceil((retryAt - now) / 1000));
}
