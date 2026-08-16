export type MarketplaceConfig = {
    enabled: boolean;
    marketplaceFeeBasisPoints: number | null;
    escrowFeeBasisPoints: number | null;
    disputeWindowDays: number | null;
    sellerPriority: string[];
    version: string;
};

export type MarketplaceVendor = {
    id: string;
    channelId: string;
    code: string;
    name: string;
    verificationStatus: "verified";
    productCount: number;
};

export type MarketplaceProduct = {
    id: string;
    productId: string;
    vendorId: string;
    vendorCode: string;
    name: string;
    productName: string;
    slug: string;
    sku: string;
    description: string;
    price: number;
    priceWithTax: number;
    currencyCode: string;
    imageUrl: string | null;
    labReportUrl: string | null;
    canonicalName: string | null;
    dosage: string | null;
    format: string | null;
    packageQuantity: number | null;
    packageUnit: string | null;
    warehouse: string | null;
    shippingFee: number | null;
    shippingEta: string | null;
    deliveryMinDays: number | null;
    deliveryMaxDays: number | null;
    matchReasons: string[];
};

export type MarketplaceSort =
    | "recommended"
    | "price-asc"
    | "price-desc"
    | "delivery-asc"
    | "newest";

export type MarketplaceProductDetail = {
    generatedAt: string;
    vendor: MarketplaceVendor;
    product: {
        id: string;
        name: string;
        slug: string;
        description: string;
        imageUrl: string | null;
        labReportUrl: string | null;
    };
    variants: MarketplaceProduct[];
};

export type MarketplaceSearchResponse = {
    generatedAt: string;
    interpretedQuery: {
        original: string;
        normalized: string;
        compound: string | null;
        strength: { value: number; unit: string } | null;
        package: { value: number; unit: string } | null;
        destination: string | null;
        warehouse: string | null;
        vendor: string | null;
        minPrice: number | null;
        maxPrice: number | null;
        deliveryMaxDays: number | null;
        hasLabReport: boolean | null;
        sort: MarketplaceSort;
        assumptions: string[];
        unresolvedTokens: string[];
    };
    vendors: MarketplaceVendor[];
    products: MarketplaceProduct[];
    alternativeProducts: MarketplaceProduct[];
    autocomplete: string[];
    suggestions: Array<{ type: string; message: string }>;
    pagination: {
        offset: number;
        limit: number;
        totalItems: number;
        hasMore: boolean;
    };
    facets: {
        warehouses: string[];
        priceRange: { min: number; max: number } | null;
        labReportCount: number;
    };
};

const marketplaceApiUrl = (
    import.meta.env.VITE_COMPOUND_BAY_API_URL || "https://market.peptide.chat"
).replace(/\/$/, "");

async function marketplaceRequest<T>(
    path: string,
    signal?: AbortSignal,
    cache: RequestCache = "default",
    init: RequestInit = {},
) {
    const response = await fetch(`${marketplaceApiUrl}${path}`, {
        ...init,
        headers: {
            accept: "application/json",
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...init.headers,
        },
        signal,
        cache,
    });
    if (!response.ok) {
        throw new Error(
            `Marketplace request failed with HTTP ${response.status}`,
        );
    }
    return (await response.json()) as T;
}

export type MarketplaceQuote = {
    quoteId: string;
    expiresAt: string;
    currencyCode: string;
    subtotal: number;
    estimatedTotal: number;
    quoteToken: string;
};

export type MarketplaceAddress = {
    fullName: string;
    streetLine1: string;
    streetLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phoneNumber: string;
};

export type MarketplaceShippingQuote = {
    subtotal: number;
    tax: number;
    shippingWithTax: number;
    totalWithTax: number;
    currencyCode: string;
    shippingQuoteToken: string;
};

export type MarketplaceCheckout = {
    id: string;
    orderCode: string;
    state: string;
    totalWithTax: number;
    currencyCode: string;
};

export type MarketplacePayment = {
    id: string;
    accessToken: string;
    status: string;
    asset: string;
    network: string;
    payAddress: string;
    payAmount: string;
    payCurrency: string;
    amountReceived: string;
    confirmations: number;
    requiredConfirmations: number;
    expiresAt: string;
    transactionHash: string | null;
};

export function createMarketplaceQuote(
    lines: Array<{
        vendorCode: string;
        productId: string;
        variantId: string;
        quantity: number;
    }>,
    signal?: AbortSignal,
) {
    return marketplaceRequest<MarketplaceQuote>(
        "/marketplace/v1/quotes",
        signal,
        "no-store",
        { method: "POST", body: JSON.stringify({ lines }) },
    );
}

export function exchangeMarketplaceIdentity(
    code: string,
    quoteToken: string,
    signal?: AbortSignal,
) {
    return marketplaceRequest<{ buyerToken: string; expiresAt: string }>(
        "/marketplace/v1/identity/exchange",
        signal,
        "no-store",
        { method: "POST", body: JSON.stringify({ code, quoteToken }) },
    );
}

export function createMarketplaceShippingQuote(
    quoteToken: string,
    deliveryAddress: MarketplaceAddress,
    signal?: AbortSignal,
) {
    return marketplaceRequest<MarketplaceShippingQuote>(
        "/marketplace/v1/shipping-quotes",
        signal,
        "no-store",
        { method: "POST", body: JSON.stringify({ quoteToken, deliveryAddress }) },
    );
}

export function createMarketplaceCheckout(input: {
    buyerToken: string;
    shippingQuoteToken: string;
    deliveryAddress: MarketplaceAddress;
    idempotencyKey: string;
}) {
    return marketplaceRequest<MarketplaceCheckout>(
        "/marketplace/v1/checkouts",
        undefined,
        "no-store",
        {
            method: "POST",
            headers: { "Idempotency-Key": input.idempotencyKey },
            body: JSON.stringify({
                buyerToken: input.buyerToken,
                shippingQuoteToken: input.shippingQuoteToken,
                deliveryAddress: input.deliveryAddress,
                acceptLegalTerms: true,
                escrowRequested: false,
            }),
        },
    );
}

export function createMarketplacePayment(
    checkoutId: string,
    buyerToken: string,
) {
    return marketplaceRequest<{
        checkout: MarketplaceCheckout;
        payment: MarketplacePayment;
    }>(
        `/marketplace/v1/checkouts/${encodeURIComponent(checkoutId)}/payments`,
        undefined,
        "no-store",
        {
            method: "POST",
            body: JSON.stringify({ buyerToken, asset: "usdt", network: "tron" }),
        },
    );
}

export function getMarketplacePaymentStatus(
    checkoutId: string,
    paymentId: string,
    accessToken: string,
) {
    const params = new URLSearchParams({ accessToken });
    return marketplaceRequest<{
        checkout: MarketplaceCheckout;
        payment: MarketplacePayment;
    }>(
        `/marketplace/v1/checkouts/${encodeURIComponent(
            checkoutId,
        )}/payments/${encodeURIComponent(paymentId)}?${params}`,
        undefined,
        "no-store",
    );
}

export function getMarketplaceConfig(signal?: AbortSignal) {
    return marketplaceRequest<MarketplaceConfig>(
        "/marketplace/v1/config",
        signal,
        "no-store",
    );
}

export function searchMarketplace(
    input: {
        query?: string;
        vendor?: string;
        offset?: number;
        limit?: number;
        sort?: MarketplaceSort;
        minPrice?: number;
        maxPrice?: number;
        warehouse?: string;
        shipsTo?: string;
        hasLabReport?: boolean;
    },
    signal?: AbortSignal,
) {
    const params = new URLSearchParams();
    if (input.query) params.set("q", input.query);
    if (input.vendor) params.set("vendor", input.vendor);
    if (input.sort && input.sort !== "recommended")
        params.set("sort", input.sort);
    if (input.minPrice !== undefined)
        params.set("minPrice", String(input.minPrice));
    if (input.maxPrice !== undefined)
        params.set("maxPrice", String(input.maxPrice));
    if (input.warehouse) params.set("warehouse", input.warehouse);
    if (input.shipsTo) params.set("shipsTo", input.shipsTo);
    if (input.hasLabReport) params.set("hasLabReport", "true");
    params.set("offset", String(input.offset ?? 0));
    params.set("limit", String(input.limit ?? 24));
    return marketplaceRequest<MarketplaceSearchResponse>(
        `/marketplace/v1/search?${params}`,
        signal,
    );
}

export function getMarketplaceProduct(
    vendorCode: string,
    productId: string,
    signal?: AbortSignal,
) {
    return marketplaceRequest<MarketplaceProductDetail>(
        `/marketplace/v1/products/${encodeURIComponent(
            vendorCode,
        )}/${encodeURIComponent(productId)}`,
        signal,
    );
}
