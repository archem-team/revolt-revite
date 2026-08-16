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
    warehouse: string | null;
    shippingFee: number | null;
    shippingEta: string | null;
};

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
    vendors: MarketplaceVendor[];
    products: MarketplaceProduct[];
    pagination: {
        offset: number;
        limit: number;
        totalItems: number;
        hasMore: boolean;
    };
};

const marketplaceApiUrl = (
    import.meta.env.VITE_COMPOUND_BAY_API_URL || "https://vendors.peptide.chat"
).replace(/\/$/, "");

async function marketplaceRequest<T>(
    path: string,
    signal?: AbortSignal,
    cache: RequestCache = "default",
) {
    const response = await fetch(`${marketplaceApiUrl}${path}`, {
        headers: { accept: "application/json" },
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

export function getMarketplaceConfig(signal?: AbortSignal) {
    return marketplaceRequest<MarketplaceConfig>(
        "/marketplace/v1/config",
        signal,
        "no-store",
    );
}

export function searchMarketplace(
    input: { query?: string; vendor?: string; offset?: number; limit?: number },
    signal?: AbortSignal,
) {
    const params = new URLSearchParams();
    if (input.query) params.set("q", input.query);
    if (input.vendor) params.set("vendor", input.vendor);
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
