const MAX_QUERY_LENGTH = 80;
const MAX_MATCHES = 3;
const MAX_PRODUCTS_PER_MATCH = 3;

export function normalizePromoAnalyticsQuery(value) {
    return [...String(value ?? "").trim()].slice(0, MAX_QUERY_LENGTH).join("");
}

export function buildPromoSearchProperties({
    query,
    resultCount,
    filter,
    sort,
    source,
    matches,
}) {
    const normalizedQuery = normalizePromoAnalyticsQuery(query);
    const topMatches = matches.slice(0, MAX_MATCHES).map((match) => ({
        promoId: match.id,
        vendorName: match.vendorName.trim().slice(0, 100),
        products: [
            ...new Set(
                match.products
                    .map((product) => product.trim().slice(0, 100))
                    .filter(Boolean),
            ),
        ].slice(0, MAX_PRODUCTS_PER_MATCH),
    }));

    return {
        query: normalizedQuery,
        queryLength: [...normalizedQuery].length,
        resultCount,
        filter,
        sort,
        source,
        topMatches,
    };
}
