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

export interface VendorInfo {
    serverId: string;
    name: string;
    logo?: string | null;
    inviteLink?: string | null;
    productCount: number;
    categories: string[];
}

export interface DosageInfo {
    dosage: string;
    count: number;
    vendorCount: number;
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
