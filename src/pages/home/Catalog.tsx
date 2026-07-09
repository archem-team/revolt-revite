import {
    Search,
    X,
    Store,
    Plus,
    Capsule,
} from "@styled-icons/boxicons-regular";
import { BadgeCheck, ChevronRight } from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import styled from "styled-components/macro";

import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { Button, Preloader, InputBox } from "@revoltchat/ui";

import { useClient } from "../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../directory/types";

// ─── Types (mirrors the Catalog API) ─────────────────────────────────────────

interface CatalogItem {
    id: string;
    serverId?: string | null;
    vendorName?: string | null;
    product: string;
    normalized?: string | null;
    fromPrice: number;
    toPrice?: number | null;
    currency: string;
    categories: string[];
    createdAt: string;
}

interface Variation {
    price: number;
    dosage?: string | null;
    display_quantity?: string | null;
    unit?: string | null;
    note?: string | null;
}

interface FullProduct extends CatalogItem {
    inviteLink?: string | null;
    variations: Variation[];
    sku?: string | null;
    updatedAt?: string;
}

interface CatalogResponse {
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

interface VendorInfo {
    serverId: string;
    name: string;
    logo?: string | null;
    inviteLink?: string | null;
    productCount: number;
    categories: string[];
}

interface CompoundInfo {
    compound: string;
    count: number;
    vendorCount: number;
}

// ─── Caching ──────────────────────────────────────────────────────────────────
// Facets (categories, vendors) change rarely; cache them in localStorage with
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

function readCache<T>(key: string): { data: T; fresh: boolean } | null {
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

function writeCache(key: string, data: unknown) {
    safeStorage.set(key, JSON.stringify({ timestamp: Date.now(), data }));
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

const Toolbar = styled.div`
    display: flex;
    gap: 10px;
    align-items: center;

    @media (max-width: 480px) {
        flex-wrap: wrap;
    }
`;

const SearchWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;

    input {
        padding-left: 42px;
        padding-right: 42px;
    }

    .search-icon {
        position: absolute;
        left: 14px;
        color: var(--tertiary-foreground);
        pointer-events: none;
    }

    .clear {
        position: absolute;
        right: 12px;
        display: flex;
        cursor: pointer;
        color: var(--tertiary-foreground);

        &:hover {
            color: var(--foreground);
        }
    }
`;

const SortSelect = styled.select`
    height: 38px;
    padding: 0 32px 0 12px;
    border: none;
    border-radius: var(--border-radius);
    background-color: var(--secondary-background);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23848484' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    color: var(--foreground);
    font-family: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    flex-shrink: 0;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
`;

// Sidebar (categories + price) on desktop; collapses to a horizontal chip
// rail above the grid on narrow screens so filters stay reachable on mobile.
const Body = styled.div`
    display: grid;
    grid-template-columns: 210px 1fr;
    gap: 20px;
    align-items: start;

    @media (max-width: 768px) {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
`;

const Sidebar = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 8px;

    @media (max-width: 768px) {
        display: none;
    }
`;

const SidebarSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SidebarTitle = styled.div`
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tertiary-foreground);
`;

const CategoryList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* Compound list can run long — keep it scrollable within the sidebar. */
    max-height: min(55vh, 480px);
    overflow-y: auto;
    scrollbar-width: thin;
`;

const CategoryRow = styled.button<{ active: boolean }>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    border: none;
    border-radius: var(--border-radius);
    font-family: inherit;
    font-size: 13px;
    font-weight: ${(props) => (props.active ? 600 : 400)};
    text-align: left;
    cursor: pointer;
    color: ${(props) =>
        props.active ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) => (props.active ? "var(--accent)" : "transparent")};
    transition: background 0.1s ease-in-out;

    &:hover {
        background: ${(props) =>
            props.active ? "var(--accent)" : "var(--secondary-background)"};
    }

    .count {
        font-size: 11px;
        color: ${(props) =>
            props.active
                ? "var(--accent-contrast, #11171c)"
                : "var(--tertiary-foreground)"};
        opacity: ${(props) => (props.active ? 0.75 : 1)};
    }
`;

const PriceInputs = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;

    input {
        width: 100%;
        min-width: 0;
        height: 32px;
        padding: 0 8px;
        border: none;
        border-radius: var(--border-radius);
        background: var(--secondary-background);
        color: var(--foreground);
        font-family: inherit;
        font-size: 13px;
        box-sizing: border-box;

        &::placeholder {
            color: var(--tertiary-foreground);
        }

        /* hide number spinners — they crowd the tiny inputs */
        &::-webkit-outer-spin-button,
        &::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        -moz-appearance: textfield;
    }

    .dash {
        color: var(--tertiary-foreground);
        flex-shrink: 0;
    }
`;

// Mobile-only horizontal category rail.
const ChipRail = styled.div`
    display: none;

    @media (max-width: 768px) {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding-bottom: 4px;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }
`;

const RailChip = styled.button<{ active: boolean }>`
    flex-shrink: 0;
    padding: 7px 12px;
    border: none;
    border-radius: 16px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    color: ${(props) =>
        props.active ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) =>
        props.active ? "var(--accent)" : "var(--secondary-background)"};
`;

const ResultMeta = styled.div`
    font-size: 12px;
    color: var(--tertiary-foreground);
    margin-bottom: 2px;
`;

// ─── Product grid ─────────────────────────────────────────────────────────────

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
`;

const Card = styled.button`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px;
    border: none;
    border-radius: 10px;
    background: var(--secondary-background);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.12s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    }

    @media (prefers-reduced-motion: reduce) {
        transition: none;

        &:hover {
            transform: none;
        }
    }
`;

const CardVendor = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    font-size: 12px;
    color: var(--secondary-foreground);

    img {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--primary-background);
    }

    .glyph {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        background: var(--primary-background);
        color: var(--tertiary-foreground);
    }

    .name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .verified {
        flex-shrink: 0;
        color: var(--accent);
        display: flex;
    }
`;

const CardName = styled.div`
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--foreground);

    /* keep cards even: clamp long product names to two lines */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

const CardPrice = styled.div`
    margin-top: auto;
    display: flex;
    align-items: baseline;
    gap: 5px;

    .from {
        font-size: 11px;
        color: var(--tertiary-foreground);
    }

    .amount {
        font-size: 18px;
        font-weight: 700;
        color: var(--foreground);
    }

    .range {
        font-size: 13px;
        font-weight: 500;
        color: var(--secondary-foreground);
    }
`;

const CardTags = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    span {
        font-size: 10px;
        font-weight: 600;
        line-height: 1;
        padding: 4px 7px;
        border-radius: 6px;
        background: var(--primary-background);
        color: var(--secondary-foreground);
    }
`;

// Shimmering placeholder card shown while a page of products loads, so the
// grid keeps its shape instead of collapsing to a spinner.
const SkeletonCard = styled.div`
    height: 148px;
    border-radius: 10px;
    background: linear-gradient(
        100deg,
        var(--secondary-background) 40%,
        var(--tertiary-background, var(--hover)) 50%,
        var(--secondary-background) 60%
    );
    background-size: 200% 100%;
    animation: catalog-shimmer 1.4s ease-in-out infinite;

    @keyframes catalog-shimmer {
        from {
            background-position: 120% 0;
        }
        to {
            background-position: -80% 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;

const Pagination = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 8px;

    button {
        height: 34px;
        padding: 0 16px;
        border: none;
        border-radius: var(--border-radius);
        background: var(--secondary-background);
        color: var(--foreground);
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.1s ease-in-out;

        &:hover:not(:disabled) {
            background: var(--accent);
            color: var(--accent-contrast, #11171c);
        }

        &:disabled {
            opacity: 0.35;
            cursor: default;
        }
    }

    span {
        font-size: 13px;
        color: var(--secondary-foreground);
    }
`;

// ─── Empty states ─────────────────────────────────────────────────────────────

const Centered = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--tertiary-foreground);
    font-size: 14px;
    text-align: center;
    margin-top: 48px;
`;

const Empty = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 56px 24px;
    gap: 6px;

    h3 {
        margin: 18px 0 0;
        font-size: 19px;
        color: var(--foreground);
    }

    p {
        margin: 0;
        max-width: 380px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--secondary-foreground);
    }

    .cta {
        margin-top: 18px;
    }
`;

// Decorative glyph on a soft accent halo with floating price chips —
// matches the Promos empty-state treatment.
const Glyph = styled.div`
    position: relative;
    width: 96px;
    height: 96px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--accent);
    background: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--accent) 22%, transparent),
        transparent 70%
    );

    &::before {
        content: "";
        position: absolute;
        inset: 18px;
        border-radius: 50%;
        border: 2px dashed color-mix(in srgb, var(--accent) 45%, transparent);
        animation: catalog-spin 18s linear infinite;
    }

    .float {
        position: absolute;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 7px;
        border-radius: 8px;
        color: var(--accent-contrast, #11171c);
        background: var(--accent);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        animation: catalog-bob 3.4s ease-in-out infinite;
    }

    .float.a {
        top: -6px;
        right: -14px;
    }

    .float.b {
        bottom: -2px;
        left: -18px;
        animation-delay: 1.2s;
        background: var(--primary-background);
        color: var(--accent);
    }

    @keyframes catalog-spin {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes catalog-bob {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-6px);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        &::before,
        .float {
            animation: none;
        }
    }
`;

// ─── Product detail modal ─────────────────────────────────────────────────────

const ModalBackdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.65);
    animation: catalog-fade 0.12s ease-out;

    @keyframes catalog-fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;

const ModalCard = styled.div`
    width: 100%;
    max-width: 520px;
    max-height: min(86vh, 640px);
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: 12px;
    background: var(--primary-background);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
    overflow-y: auto;
`;

const ModalHead = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;

    .title {
        flex: 1;
        min-width: 0;

        h3 {
            margin: 0;
            font-size: 18px;
            line-height: 1.3;
            color: var(--foreground);
        }

        .sku {
            margin-top: 4px;
            font-size: 11px;
            color: var(--tertiary-foreground);
        }
    }

    .close {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        color: var(--tertiary-foreground);
        background: var(--secondary-background);
        cursor: pointer;
        transition: color 0.1s ease-in-out;

        &:hover {
            color: var(--foreground);
        }
    }
`;

const VendorBlock = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--secondary-background);

    img {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--primary-background);
    }

    .glyph {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        background: var(--primary-background);
        color: var(--tertiary-foreground);
    }

    .meta {
        flex: 1;
        min-width: 0;

        .name {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 14px;
            font-weight: 600;
            color: var(--foreground);

            svg {
                color: var(--accent);
                flex-shrink: 0;
            }
        }

        .sub {
            font-size: 12px;
            color: var(--tertiary-foreground);
        }
    }
`;

// Compact circular vendor CTA (join / open), same treatment as promo cards.
const ActionIcon = styled.div`
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;

    & > svg {
        display: block;
        color: var(--accent-contrast, #11171c);
    }

    &:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
    }
`;

const VariationTable = styled.div`
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    overflow: hidden;
    background: var(--secondary-background);
`;

const VariationRow = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 10px 12px;
    font-size: 13px;

    & + & {
        border-top: 1px solid var(--primary-background);
    }

    .dosage {
        font-weight: 600;
        color: var(--foreground);
    }

    .qty {
        color: var(--secondary-foreground);
    }

    .price {
        margin-left: auto;
        font-weight: 600;
        color: var(--foreground);
        white-space: nowrap;
    }

    .unit {
        color: var(--tertiary-foreground);
        font-weight: 400;
        font-size: 12px;
    }
`;

const VariationNote = styled.div`
    padding: 0 12px 10px;
    font-size: 12px;
    color: var(--tertiary-foreground);
    background: var(--secondary-background);
`;

const ModalMeta = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    span {
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        padding: 5px 8px;
        border-radius: 6px;
        background: var(--secondary-background);
        color: var(--secondary-foreground);
    }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number, currency = "USD") => {
    const formatted = n.toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });
    return currency === "USD" ? `$${formatted}` : `${formatted} ${currency}`;
};

function inviteCodeFromLink(link: string | null | undefined): string | null {
    if (!link) return null;
    const m = link.match(/\/invite\/([^/?#]+)/);
    return m?.[1] ?? null;
}

/** "From $115" for ranges, plain "$115" for a single price. */
function priceParts(item: CatalogItem) {
    const hasRange = item.toPrice != null && item.toPrice > item.fromPrice;
    return {
        hasRange,
        from: money(item.fromPrice, item.currency),
        to: hasRange ? money(item.toPrice as number, item.currency) : null,
    };
}

/** Debounce a fast-changing value (search text, price inputs). */
function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

const COMPOUND_ALL = "all";
const PAGE_SIZE = 24;

// ─── Detail modal component ───────────────────────────────────────────────────

const ProductModal = observer(
    ({
        productId,
        vendors,
        headers,
        onClose,
    }: {
        productId: string;
        vendors: Map<string, VendorInfo>;
        headers: Record<string, string>;
        onClose: () => void;
    }) => {
        const client = useClient();
        const [product, setProduct] = useState<FullProduct | null>(null);
        const [failed, setFailed] = useState(false);
        const [logoFailed, setLogoFailed] = useState(false);

        const autumn =
            client.configuration?.features.autumn?.url ||
            "https://peptide.chat/autumn";

        useEffect(() => {
            let cancelled = false;
            fetch(`${BACKEND_API_BASE}/catalog/${productId}`, { headers })
                .then((r) => r.json())
                .then((res) => {
                    if (cancelled) return;
                    if (res?.success) setProduct(res.data as FullProduct);
                    else setFailed(true);
                })
                .catch(() => !cancelled && setFailed(true));
            return () => {
                cancelled = true;
            };
        }, [productId]);

        // Lock body scroll + close on Escape while open.
        useEffect(() => {
            const prev = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Escape") onClose();
            };
            document.addEventListener("keydown", onKey);
            return () => {
                document.body.style.overflow = prev;
                document.removeEventListener("keydown", onKey);
            };
        }, [onClose]);

        const vendor = product?.serverId
            ? vendors.get(product.serverId)
            : undefined;
        const vendorName = vendor?.name ?? product?.vendorName;
        const logoUrl =
            vendor?.logo && !logoFailed
                ? `${autumn}/icons/${vendor.logo}?max_side=256`
                : null;

        // Prefer entering an already-joined community; otherwise offer the invite.
        const joined = product?.serverId
            ? client.servers.get(product.serverId)
            : undefined;
        const inviteCode = inviteCodeFromLink(
            product?.inviteLink ?? vendor?.inviteLink,
        );
        const linkTo = joined
            ? `/server/${product?.serverId}`
            : inviteCode
            ? `/invite/${inviteCode}`
            : null;

        return (
            <ModalBackdrop onClick={onClose}>
                <ModalCard onClick={(e) => e.stopPropagation()}>
                    {failed ? (
                        <>
                            <ModalHead>
                                <div className="title">
                                    <h3>Product unavailable</h3>
                                </div>
                                <div className="close" onClick={onClose}>
                                    <X size={20} />
                                </div>
                            </ModalHead>
                            <Centered style={{ marginTop: 12 }}>
                                This product may have been removed. Try
                                refreshing the list.
                            </Centered>
                        </>
                    ) : !product ? (
                        <Centered style={{ margin: "32px 0" }}>
                            <Preloader type="ring" />
                        </Centered>
                    ) : (
                        <>
                            <ModalHead>
                                <div className="title">
                                    <h3>{product.product}</h3>
                                    {product.sku && (
                                        <div className="sku">
                                            SKU {product.sku}
                                        </div>
                                    )}
                                </div>
                                <div className="close" onClick={onClose}>
                                    <X size={20} />
                                </div>
                            </ModalHead>

                            {(vendorName || linkTo) && (
                                <VendorBlock>
                                    {logoUrl ? (
                                        <img
                                            src={logoUrl}
                                            loading="lazy"
                                            onError={() => setLogoFailed(true)}
                                        />
                                    ) : (
                                        <div className="glyph">
                                            <Store size={18} />
                                        </div>
                                    )}
                                    <div className="meta">
                                        <div className="name">
                                            {vendorName ?? "Unknown vendor"}
                                            {product.serverId && (
                                                <BadgeCheck size={14} />
                                            )}
                                        </div>
                                        {vendor && (
                                            <div className="sub">
                                                {vendor.productCount} products
                                                listed
                                            </div>
                                        )}
                                    </div>
                                    {linkTo && (
                                        <ActionIcon
                                            as={Link}
                                            to={linkTo}
                                            title={
                                                joined
                                                    ? "Open community"
                                                    : "Join community"
                                            }>
                                            {joined ? (
                                                <ChevronRight size={20} />
                                            ) : (
                                                <Plus size={20} />
                                            )}
                                        </ActionIcon>
                                    )}
                                </VendorBlock>
                            )}

                            {product.variations.length > 0 && (
                                <VariationTable>
                                    {product.variations.map((v, i) => (
                                        <div key={i}>
                                            <VariationRow>
                                                {v.dosage && (
                                                    <span className="dosage">
                                                        {v.dosage}
                                                    </span>
                                                )}
                                                {v.display_quantity && (
                                                    <span className="qty">
                                                        {v.display_quantity}
                                                    </span>
                                                )}
                                                <span className="price">
                                                    {money(
                                                        v.price,
                                                        product.currency,
                                                    )}
                                                    {v.unit && (
                                                        <span className="unit">
                                                            {" "}
                                                            / {v.unit}
                                                        </span>
                                                    )}
                                                </span>
                                            </VariationRow>
                                            {v.note && (
                                                <VariationNote>
                                                    {v.note}
                                                </VariationNote>
                                            )}
                                        </div>
                                    ))}
                                </VariationTable>
                            )}

                            {product.categories.length > 0 && (
                                <ModalMeta>
                                    {product.categories.map((c) => (
                                        <span key={c}>{c}</span>
                                    ))}
                                </ModalMeta>
                            )}
                        </>
                    )}
                </ModalCard>
            </ModalBackdrop>
        );
    },
);

// ─── Page ────────────────────────────────────────────────────────────────────

const Catalog: React.FC = () => {
    const client = useClient();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [compounds, setCompounds] = useState<CompoundInfo[]>([]);
    const [vendors, setVendors] = useState<Map<string, VendorInfo>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [queryInput, setQueryInput] = useState("");
    const [selectedCompound, setSelectedCompound] = useState(COMPOUND_ALL);
    const [minInput, setMinInput] = useState("");
    const [maxInput, setMaxInput] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [openId, setOpenId] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // Debounce free-typed filters so we don't refetch per keystroke.
    const query = useDebounced(queryInput, 300);
    const minPrice = useDebounced(minInput, 500);
    const maxPrice = useDebounced(maxInput, 500);

    const autumn =
        client.configuration?.features.autumn?.url ||
        "https://peptide.chat/autumn";

    const sessionToken =
        typeof client.session === "string"
            ? client.session
            : (client.session as any)?.token ?? "";
    const headers = useMemo(
        () => ({ "x-session-token": sessionToken }),
        [sessionToken],
    );

    // Facets: cached copy first, revalidate in the background.
    useEffect(() => {
        const compoundCache = readCache<CompoundInfo[]>("catalog_compounds");
        if (compoundCache) setCompounds(compoundCache.data);
        if (!compoundCache?.fresh) {
            fetch(`${BACKEND_API_BASE}/catalog/compounds`, { headers })
                .then((r) => r.json())
                .then((res) => {
                    if (res?.success && Array.isArray(res.data)) {
                        setCompounds(res.data);
                        writeCache("catalog_compounds", res.data);
                    }
                })
                .catch(() => {
                    /* facet fetch is best-effort — keep cached copy */
                });
        }

        const vendorCache = readCache<VendorInfo[]>("catalog_vendors");
        if (vendorCache)
            setVendors(new Map(vendorCache.data.map((v) => [v.serverId, v])));
        if (!vendorCache?.fresh) {
            fetch(`${BACKEND_API_BASE}/catalog/vendors`, { headers })
                .then((r) => r.json())
                .then((res) => {
                    if (res?.success && Array.isArray(res.data)) {
                        setVendors(
                            new Map(
                                (res.data as VendorInfo[]).map((v) => [
                                    v.serverId,
                                    v,
                                ]),
                            ),
                        );
                        writeCache("catalog_vendors", res.data);
                    }
                })
                .catch(() => {
                    /* facet fetch is best-effort — keep cached copy */
                });
        }
    }, []);

    // Reset to the first page whenever a filter changes.
    useEffect(() => {
        setPage(1);
    }, [query, selectedCompound, minPrice, maxPrice, sort]);

    // Fetch a page of products.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (selectedCompound !== COMPOUND_ALL)
            params.set("compound", selectedCompound);
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        params.set("sort", sort);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));

        fetch(`${BACKEND_API_BASE}/catalog?${params}`, { headers })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((res: CatalogResponse) => {
                if (cancelled) return;
                if (!res?.success || !Array.isArray(res.data?.items)) {
                    throw new Error("Unexpected response");
                }
                setItems(res.data.items);
                setTotalPages(res.data.pagination.totalPages);
                setTotal(res.data.pagination.total);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError("Failed to load products. Please try again later.");
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [query, selectedCompound, minPrice, maxPrice, sort, page, retryCount]);

    const hasFilters =
        query.trim() !== "" ||
        selectedCompound !== COMPOUND_ALL ||
        minPrice !== "" ||
        maxPrice !== "";

    const clearFilters = () => {
        setQueryInput("");
        setSelectedCompound(COMPOUND_ALL);
        setMinInput("");
        setMaxInput("");
    };

    const renderCard = (item: CatalogItem) => {
        const vendor = item.serverId ? vendors.get(item.serverId) : undefined;
        const vendorName = vendor?.name ?? item.vendorName;
        const price = priceParts(item);

        return (
            <Card key={item.id} onClick={() => setOpenId(item.id)}>
                <CardVendor>
                    {vendor?.logo ? (
                        <img
                            src={`${autumn}/icons/${vendor.logo}?max_side=64`}
                            loading="lazy"
                            onError={(e) =>
                                ((
                                    e.currentTarget as HTMLImageElement
                                ).style.display = "none")
                            }
                        />
                    ) : (
                        <div className="glyph">
                            <Store size={12} />
                        </div>
                    )}
                    <span className="name">
                        {vendorName ?? "Unknown vendor"}
                    </span>
                    {item.serverId && (
                        <span className="verified" title="Linked community">
                            <BadgeCheck size={13} />
                        </span>
                    )}
                </CardVendor>

                <CardName>{item.product}</CardName>

                <CardPrice>
                    {price.hasRange && <span className="from">from</span>}
                    <span className="amount">{price.from}</span>
                    {price.to && <span className="range">– {price.to}</span>}
                </CardPrice>

                {item.categories.length > 0 && (
                    <CardTags>
                        {item.categories.slice(0, 3).map((c) => (
                            <span key={c}>{c}</span>
                        ))}
                    </CardTags>
                )}
            </Card>
        );
    };

    return (
        <Wrapper>
            <Toolbar>
                <SearchWrapper>
                    <Search size={18} className="search-icon" />
                    <InputBox
                        palette="secondary"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.currentTarget.value)}
                        placeholder="Search compounds and products…"
                    />
                    {queryInput && (
                        <div
                            className="clear"
                            onClick={() => setQueryInput("")}>
                            <X size={18} />
                        </div>
                    )}
                </SearchWrapper>
                <SortSelect
                    value={sort}
                    onChange={(e) => setSort(e.currentTarget.value)}>
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                </SortSelect>
            </Toolbar>

            {compounds.length > 0 && (
                <ChipRail>
                    <RailChip
                        active={selectedCompound === COMPOUND_ALL}
                        onClick={() => setSelectedCompound(COMPOUND_ALL)}>
                        All
                    </RailChip>
                    {compounds.map((c) => (
                        <RailChip
                            key={c.compound}
                            active={selectedCompound === c.compound}
                            onClick={() => setSelectedCompound(c.compound)}>
                            {c.compound}
                        </RailChip>
                    ))}
                </ChipRail>
            )}

            <Body>
                <Sidebar>
                    {/* A lone "All products" row is noise — only render the
                        compound facet once it has loaded. */}
                    {compounds.length > 0 && (
                        <SidebarSection>
                            <SidebarTitle>Compounds</SidebarTitle>
                            <CategoryList>
                                <CategoryRow
                                    active={selectedCompound === COMPOUND_ALL}
                                    onClick={() =>
                                        setSelectedCompound(COMPOUND_ALL)
                                    }>
                                    All products
                                </CategoryRow>
                                {compounds.map((c) => (
                                    <CategoryRow
                                        key={c.compound}
                                        active={
                                            selectedCompound === c.compound
                                        }
                                        onClick={() =>
                                            setSelectedCompound(c.compound)
                                        }>
                                        {c.compound}
                                        <span className="count">{c.count}</span>
                                    </CategoryRow>
                                ))}
                            </CategoryList>
                        </SidebarSection>
                    )}

                    <SidebarSection>
                        <SidebarTitle>Price</SidebarTitle>
                        <PriceInputs>
                            <input
                                type="number"
                                min="0"
                                placeholder="Min"
                                value={minInput}
                                onInput={(e) =>
                                    setMinInput(
                                        (e.target as HTMLInputElement).value,
                                    )
                                }
                            />
                            <span className="dash">–</span>
                            <input
                                type="number"
                                min="0"
                                placeholder="Max"
                                value={maxInput}
                                onInput={(e) =>
                                    setMaxInput(
                                        (e.target as HTMLInputElement).value,
                                    )
                                }
                            />
                        </PriceInputs>
                    </SidebarSection>
                </Sidebar>

                <div>
                    {!loading && !error && items.length > 0 && (
                        <ResultMeta>
                            {total.toLocaleString()}{" "}
                            {total === 1 ? "product" : "products"}
                            {selectedCompound !== COMPOUND_ALL &&
                                ` for ${selectedCompound}`}
                        </ResultMeta>
                    )}

                    {loading ? (
                        <Grid>
                            {Array.from({ length: 9 }, (_, i) => (
                                <SkeletonCard key={i} />
                            ))}
                        </Grid>
                    ) : error ? (
                        <Empty>
                            <Glyph>
                                <Store size={40} />
                            </Glyph>
                            <h3>Couldn&rsquo;t load the catalog</h3>
                            <p>
                                Something went wrong while fetching products.
                                Check your connection and try again.
                            </p>
                            <div className="cta">
                                <Button
                                    compact
                                    palette="secondary"
                                    onClick={() => setRetryCount((c) => c + 1)}>
                                    Retry
                                </Button>
                            </div>
                        </Empty>
                    ) : items.length === 0 ? (
                        hasFilters ? (
                            <Empty>
                                <Glyph>
                                    <Search size={40} />
                                </Glyph>
                                <h3>No products match</h3>
                                <p>
                                    Try a different compound name, widen the
                                    price range, or clear the filters to browse
                                    the full catalog.
                                </p>
                                <div className="cta">
                                    <Button
                                        compact
                                        palette="secondary"
                                        onClick={clearFilters}>
                                        Clear filters
                                    </Button>
                                </div>
                            </Empty>
                        ) : (
                            <Empty>
                                <Glyph>
                                    <span className="float a">$115</span>
                                    <span className="float b">10mg</span>
                                    <Capsule size={40} />
                                </Glyph>
                                <h3>The catalog is filling up</h3>
                                <p>
                                    Vendors are still listing their products.
                                    Check back soon — new compounds and prices
                                    land here as communities publish their
                                    catalogs.
                                </p>
                            </Empty>
                        )
                    ) : (
                        <>
                            <Grid>{items.map(renderCard)}</Grid>

                            {totalPages > 1 && (
                                <Pagination>
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}>
                                        Previous
                                    </button>
                                    <span>
                                        Page {page} of {totalPages}
                                    </span>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}>
                                        Next
                                    </button>
                                </Pagination>
                            )}
                        </>
                    )}
                </div>
            </Body>

            {openId && (
                <ProductModal
                    productId={openId}
                    vendors={vendors}
                    headers={headers}
                    onClose={() => setOpenId(null)}
                />
            )}
        </Wrapper>
    );
};

export default observer(Catalog);
