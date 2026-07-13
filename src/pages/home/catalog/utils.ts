import { useEffect, useState } from "preact/hooks";

// ─── Types (mirrors the Catalog API) ─────────────────────────────────────────

export interface CatalogItem {
    id: string;
    serverId?: string | null;
    vendorName?: string | null;
    product: string;
    normalized?: string | null;
    compound?: string | null;
    fromPrice: number;
    toPrice?: number | null;
    currency: string;
    categories: string[];
    createdAt: string;
}

export interface Variation {
    price: number;
    dosage?: string | null;
    display_quantity?: string | null;
    unit?: string | null;
    note?: string | null;
}

export interface FullProduct extends CatalogItem {
    inviteLink?: string | null;
    variations: Variation[];
    sku?: string | null;
    updatedAt?: string;
}

export interface CatalogResponse {
    success: boolean;
    data: {
        items: CatalogItem[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    };
}

export interface WarehouseFlags {
    us?: boolean;
    eu?: boolean;
    aus?: boolean;
    cn?: boolean;
}
export interface PaymentFlags {
    cc?: boolean;
    btc?: boolean;
    pp?: boolean;
    zelle?: boolean;
    venmo?: boolean;
    bt?: boolean;
    chk?: boolean;
}
export interface GuaranteeFlags {
    purity?: boolean;
    purityPct?: number | null;
    volume?: boolean;
    volumePct?: number | null;
    reship?: boolean;
    reshipDesc?: string | null;
}

export interface VendorInfo {
    serverId: string;
    name: string;
    logo?: string | null;
    inviteLink?: string | null;
    productCount: number;
    categories: string[];
    // Vendor-quality attrs (Option A). Absent when the vendor has no directory
    // listing — treat as unknown, not false.
    verified?: boolean;
    rating?: number;
    warehouses?: WarehouseFlags;
    payment?: PaymentFlags;
    guarantee?: GuaranteeFlags;
    shippingTime?: string | null;
    freeShipping?: boolean;
    freeShippingThreshold?: number | null;
}

export interface DosageInfo {
    dosage: string;
    count: number;
    vendorCount: number;
}

export interface CategoryInfo {
    category: string;
    count: number;
    vendorCount: number;
}

// ─── Vendor-attribute facets ────────────────────────────────────────────────
// Keys + labels for the sidebar facet groups that read off VendorInfo.

export const WAREHOUSE_FACETS: { key: keyof WarehouseFlags; label: string }[] = [
    { key: "us", label: "United States" },
    { key: "eu", label: "Europe" },
    { key: "aus", label: "Australia" },
    { key: "cn", label: "China" },
];

// Payment methods we surface as filters (backend accepts the full set, but the
// sidebar sticks to the common two to stay scannable).
export const PAYMENT_FACETS: { key: keyof PaymentFlags; label: string }[] = [
    { key: "cc", label: "Credit Card" },
    { key: "btc", label: "Crypto" },
];

export const GUARANTEE_FACETS: { key: keyof GuaranteeFlags; label: string }[] = [
    { key: "purity", label: "Purity" },
    { key: "volume", label: "Volume" },
    { key: "reship", label: "Re-Ship" },
];

export const RATING_FACETS = [4, 3, 2];

export interface VendorFacetCounts {
    warehouse: Record<string, number>;
    payment: Record<string, number>;
    guarantee: Record<string, number>;
    verified: number;
    freeShipping: number;
}

/**
 * Sum product counts per vendor-attribute bucket, derived client-side from the
 * enriched /catalog/vendors list (Option A — global counts, not query-aware).
 */
export function deriveVendorFacetCounts(
    vendors: VendorInfo[],
): VendorFacetCounts {
    const counts: VendorFacetCounts = {
        warehouse: {},
        payment: {},
        guarantee: {},
        verified: 0,
        freeShipping: 0,
    };
    for (const v of vendors) {
        const n = v.productCount || 0;
        for (const { key } of WAREHOUSE_FACETS) {
            if (v.warehouses?.[key])
                counts.warehouse[key] = (counts.warehouse[key] ?? 0) + n;
        }
        for (const { key } of PAYMENT_FACETS) {
            if (v.payment?.[key])
                counts.payment[key] = (counts.payment[key] ?? 0) + n;
        }
        for (const { key } of GUARANTEE_FACETS) {
            if (v.guarantee?.[key])
                counts.guarantee[key] = (counts.guarantee[key] ?? 0) + n;
        }
        if (v.verified) counts.verified += n;
        if (v.freeShipping) counts.freeShipping += n;
    }
    return counts;
}

/**
 * Order dosages the way a shopper expects: grouped by unit, numerically
 * ascending within it ("5mg", "10mg", "20mg", … then "500iu", "1000iu").
 */
export function sortDosages(list: DosageInfo[]): DosageInfo[] {
    const parse = (d: string): [string, number] => {
        const m = d.trim().match(/^([\d.]+)\s*(.*)$/);
        if (!m) return [d.toLowerCase(), Number.MAX_SAFE_INTEGER];
        return [m[2].toLowerCase(), parseFloat(m[1])];
    };
    return [...list].sort((a, b) => {
        const [ua, na] = parse(a.dosage);
        const [ub, nb] = parse(b.dosage);
        return ua === ub ? na - nb : ua.localeCompare(ub);
    });
}

export const DOSAGE_ALL = "all";
export const PAGE_SIZE = 24;

// ─── Caching ──────────────────────────────────────────────────────────────────
// Facets (compounds, vendors) change rarely; cache them in localStorage with
// a short TTL and revalidate in the background (same pattern as Promos).

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const safeStorage = {
    get(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch {
            /* quota / private mode — ignore */
        }
    },
};

export function readCache<T>(key: string): { data: T; fresh: boolean } | null {
    try {
        const raw = safeStorage.get(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !("data" in parsed)) return null;
        return {
            data: parsed.data as T,
            fresh: Date.now() - parsed.timestamp < CACHE_TTL,
        };
    } catch {
        return null;
    }
}

export function writeCache(key: string, data: unknown) {
    safeStorage.set(key, JSON.stringify({ timestamp: Date.now(), data }));
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export const money = (n: number, currency = "USD") => {
    const formatted = n.toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });
    return currency === "USD" ? `$${formatted}` : `${formatted} ${currency}`;
};

/** "From $115" for ranges, plain "$115" for a single price. */
export function priceParts(item: CatalogItem) {
    const hasRange = item.toPrice != null && item.toPrice > item.fromPrice;
    return {
        hasRange,
        from: money(item.fromPrice, item.currency),
        to: hasRange ? money(item.toPrice as number, item.currency) : null,
    };
}

export function inviteCodeFromLink(
    link: string | null | undefined,
): string | null {
    if (!link) return null;
    const m = link.match(/\/invite\/([^/?#]+)/);
    return m?.[1] ?? null;
}

/** Debounce a fast-changing value (search text, price inputs). */
export function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}
