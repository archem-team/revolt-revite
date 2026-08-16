function nonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function isCartLine(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        nonEmptyString(value.id) &&
        nonEmptyString(value.productId) &&
        nonEmptyString(value.vendorCode) &&
        nonEmptyString(value.name) &&
        nonEmptyString(value.productName) &&
        /^[A-Z]{3}$/.test(value.currencyCode) &&
        Number.isSafeInteger(value.priceWithTax) &&
        value.priceWithTax >= 0 &&
        Number.isInteger(value.quantity) &&
        value.quantity >= 1 &&
        value.quantity <= 99
    );
}

export function normalizeMarketplaceCart(value) {
    if (!Array.isArray(value)) return [];

    const normalized = [];
    const lineIndex = new Map();
    let currencyCode;

    for (const candidate of value) {
        if (!isCartLine(candidate)) continue;

        if (currencyCode && candidate.currencyCode !== currencyCode) return [];
        currencyCode = candidate.currencyCode;

        const line = {
            ...candidate,
            sellerName:
                (nonEmptyString(candidate.sellerName) &&
                    candidate.sellerName.trim()) ||
                (nonEmptyString(candidate.vendorName) &&
                    candidate.vendorName.trim()) ||
                candidate.vendorCode,
        };
        const key = `${line.vendorCode}:${line.id}`;
        const existingIndex = lineIndex.get(key);
        if (existingIndex === undefined) {
            lineIndex.set(key, normalized.length);
            normalized.push(line);
            continue;
        }

        const existing = normalized[existingIndex];
        if (
            existing.productId !== line.productId ||
            existing.priceWithTax !== line.priceWithTax
        ) {
            return [];
        }
        existing.quantity = Math.min(99, existing.quantity + line.quantity);
    }

    return normalized;
}
