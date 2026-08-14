const ALLOWED_DEEP_LINK_HOSTS = new Set([
    "peptide.chat",
    "app.peptide.chat",
]);

const SEGMENT = "[^/]+";
const ROUTES = [
    new RegExp(`^/invite/${SEGMENT}/?$`),
    new RegExp(`^/channel/${SEGMENT}(?:/${SEGMENT})?/?$`),
    new RegExp(
        `^/server/${SEGMENT}(?:/channel/${SEGMENT}(?:/${SEGMENT})?)?/?$`,
    ),
];

/**
 * Return the canonical in-app path for a supported Zeko link.
 * Unsupported hosts, insecure production links, query-only message links,
 * and malformed paths are rejected instead of being routed somewhere else.
 */
export function canonicalDeepLink(input, base = "https://peptide.chat") {
    let url;
    try {
        url = new URL(input, base);
    } catch (_error) {
        return null;
    }

    if (url.protocol !== "https:" || !ALLOWED_DEEP_LINK_HOSTS.has(url.hostname)) {
        return null;
    }

    if (!ROUTES.some((route) => route.test(url.pathname))) return null;

    return url.pathname.replace(/\/$/, "") || "/";
}
