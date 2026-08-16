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
    deliveryMinDays: number | null;
    deliveryMaxDays: number | null;
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
    vendors: MarketplaceVendor[];
    products: MarketplaceProduct[];
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
