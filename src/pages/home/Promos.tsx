/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · component: CompareDrawer · genre: modern-minimal · theme: PepChat Dark
 * states: default · hover · focus · active · disabled
 * contrast: pass
 */
import {
    Calendar,
    MapPin,
    Tag,
    Store,
    Search,
    X,
    Plus,
    Time,
    Refresh,
    CheckCircle,
    RightArrowAlt,
} from "@styled-icons/boxicons-regular";
import {
    BadgeCheck,
    ChevronRight,
    ChevronDown,
    Flame,
} from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link, useHistory } from "react-router-dom";
import styled, { css, keyframes } from "styled-components/macro";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "preact/hooks";

import { Button, InputBox, Preloader } from "@revoltchat/ui";

import { useClient } from "../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../directory/types";
import ImageLightbox from "./ImageLightbox";
import PromoSubmit from "./PromoSubmit";

// ─── Types (mirrors the public Promos API) ──────────────────────────────────

export interface PromoItem {
    product: string;
    dosage?: string | null;
    price: number;
    unit?: string;
    moqKits?: number | null;
    moqTotal?: number | null;
    note?: string | null;
}

export interface Promo {
    id: string;
    vendor: {
        serverId: string | null;
        name: string;
        logo: string | null;
        inviteLink: string | null;
    };
    title: string | null;
    description?: string | null;
    notes?: string | null;
    items: PromoItem[];
    images?: string[];
    shippingFee?: number;
    freeShippingThreshold?: number;
    shippingNote?: string | null;
    guarantee?: {
        purityPct?: number | null;
        volumePct?: number | null;
        customsReship?: boolean;
        text?: string | null;
    };
    discountNote?: string;
    warehouse?: string;
    moqNote?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    untilSoldOut?: boolean;
    timelineText?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}

type Sort = "newest" | "updated" | "price_asc" | "price_desc" | "vendor_asc";
type FilterKey =
    | "all"
    | "marketUpdates"
    | "us"
    | "cn"
    | "in"
    | "freeShipping"
    | "endingSoon"
    | "recentlyUpdated"
    | "tirzepatide"
    | "retatrutide"
    | "semaglutide"
    | "hgh";

// ─── Caching ──────────────────────────────────────────────────────────────────

const CACHE_PREFIX = "promos_cache_";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const LAST_VISIT_KEY = "lastPromoVisit";
const MARKET_ALERT_DISMISSED_KEY = "promos_market_alert_dismissed";
const ENDING_SOON_HOURS = 72;

interface PromoCache {
    timestamp: number;
    data: Promo[];
}

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

const safeSessionStorage = {
    get(key: string): string | null {
        try {
            return sessionStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key: string, value: string): void {
        try {
            sessionStorage.setItem(key, value);
        } catch {
            /* private mode — ignore */
        }
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number | undefined) =>
    typeof n === "number"
        ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : undefined;

const isUrl = (s: string) => /^https?:\/\//i.test(s);

function inviteCodeFromLink(link: string | null): string | null {
    if (!link) return null;
    const m = link.match(/\/invite\/([^/?#]+)/);
    return m?.[1] ?? null;
}

function timeline(p: Promo): string | null {
    if (p.untilSoldOut) return "Until sold out";
    if (p.endDate) {
        const d = new Date(p.endDate);
        if (!isNaN(d.getTime()))
            return `Ends ${d.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            })}`;
    }
    if (p.timelineText) return p.timelineText;
    return null;
}

function isEndingSoon(promo: Promo): boolean {
    if (!promo.endDate) return false;
    const end = new Date(promo.endDate);
    if (isNaN(end.getTime())) return false;
    const diff = end.getTime() - Date.now();
    return diff > 0 && diff < ENDING_SOON_HOURS * 60 * 60 * 1000;
}

function formatCountdown(endDate: string): string {
    const end = new Date(endDate);
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return "Ended";
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function formatLastUpdated(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) return "Updated just now";
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Updated just now";
    if (mins < 60) return `Updated ${mins}m ago`;
    if (hours < 24) return `Updated ${hours}h ago`;
    if (days === 1) return "Updated yesterday";
    if (days < 7) return `Updated ${days}d ago`;
    const formattedDate = new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
    return `Updated ${formattedDate}`;
}

function getVendorInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

type BadgeType = "new" | "updated" | "ending-soon" | null;

function isMarketUpdate(
    promo: Promo,
    lastVisit: number | null,
    now = Date.now(),
): boolean {
    if (!lastVisit) return false;

    const createdAt = new Date(promo.createdAt).getTime();
    const updatedAt = new Date(promo.updatedAt).getTime();
    const createdSinceVisit = Number.isFinite(createdAt) && createdAt > lastVisit;
    const updatedSinceVisit =
        Number.isFinite(updatedAt) &&
        updatedAt > lastVisit &&
        (!Number.isFinite(createdAt) || createdAt <= lastVisit);

    let becameEndingSoon = false;
    if (promo.endDate) {
        const endAt = new Date(promo.endDate).getTime();
        const endingSoonWindow = ENDING_SOON_HOURS * 60 * 60 * 1000;
        becameEndingSoon =
            Number.isFinite(endAt) &&
            endAt > now &&
            endAt - now <= endingSoonWindow &&
            endAt - lastVisit > endingSoonWindow;
    }

    return createdSinceVisit || updatedSinceVisit || becameEndingSoon;
}

function getPromoBadge(promo: Promo, lastVisit: number | null): BadgeType {
    // Priority: ending-soon > new > updated
    if (isEndingSoon(promo)) return "ending-soon";
    if (!lastVisit) return null;
    const created = new Date(promo.createdAt).getTime();
    const updated = new Date(promo.updatedAt).getTime();
    if (created > lastVisit) return "new";
    if (updated > lastVisit) return "updated";
    return null;
}

const COMPOUND_ALIASES: Record<string, string> = {
    reta: "retatrutide",
    retatrutide: "retatrutide",
    tirz: "tirzepatide",
    tirzepatide: "tirzepatide",
    sema: "semaglutide",
    semaglutide: "semaglutide",
    hgh: "hgh",
    "growth hormone": "hgh",
    somatropin: "hgh",
    ghkcu: "ghk-cu",
    "ghk cu": "ghk-cu",
};

/** Canonical product identity shared by search, filters, cards and comparison. */
export function normalizeCompound(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized) return null;

    const compact = normalized.replace(/\s/g, "");
    const directAlias =
        COMPOUND_ALIASES[normalized] || COMPOUND_ALIASES[compact];
    if (directAlias) return directAlias;

    for (const [alias, canonical] of Object.entries(COMPOUND_ALIASES)) {
        if (normalized.startsWith(`${alias} `)) {
            return canonical;
        }
    }

    return normalized;
}

function formatCompoundLabel(compound: string): string {
    if (compound === "hgh") return "HGH";
    if (compound === "ghk-cu") return "GHK-Cu";
    return compound.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getComparableCompound(promo: Promo): string | null {
    const explicitCompound = normalizeCompound((promo as any).productKey);
    const compounds = new Set(
        (promo.items ?? [])
            .map((item) => normalizeCompound(item.product))
            .filter((compound): compound is string => !!compound),
    );
    if (explicitCompound && compounds.has(explicitCompound)) {
        return explicitCompound;
    }

    // A generic CTA cannot truthfully choose between multiple compounds.
    return compounds.size === 1 ? [...compounds][0] : null;
}

function matchesFilter(
    promo: Promo,
    filter: FilterKey,
    lastVisit: number | null,
): boolean {
    switch (filter) {
        case "all":
            return true;
        case "marketUpdates":
            return isMarketUpdate(promo, lastVisit);
        case "us":
            return !!promo.warehouse
                ?.toLowerCase()
                .match(/\bus\b|united.?states/);
        case "cn":
            return !!promo.warehouse?.toLowerCase().match(/\bcn\b|china/);
        case "in":
            return !!promo.warehouse?.toLowerCase().match(/\bin\b|india/);
        case "freeShipping":
            return (
                promo.shippingFee === 0 || promo.freeShippingThreshold != null
            );
        case "recentlyUpdated": {
            const now = Date.now();
            const createdMs = new Date(promo.createdAt).getTime();
            const updatedMs = new Date(promo.updatedAt).getTime();
            const isFreshUpdate =
                updatedMs - createdMs > 60_000 &&
                now - updatedMs < 3 * 24 * 60 * 60 * 1000;
            const isUpdatedSinceLastVisit = lastVisit
                ? updatedMs > lastVisit
                : false;
            return isFreshUpdate || isUpdatedSinceLastVisit;
        }
        case "tirzepatide":
            return (promo.items ?? []).some((it) =>
                normalizeCompound(it.product) === "tirzepatide",
            );
        case "retatrutide":
            return (promo.items ?? []).some((it) =>
                normalizeCompound(it.product) === "retatrutide",
            );
        case "semaglutide":
            return (promo.items ?? []).some((it) =>
                normalizeCompound(it.product) === "semaglutide",
            );
        case "hgh":
            return (promo.items ?? []).some(
                (it) => normalizeCompound(it.product) === "hgh",
            );
        default:
            return true;
    }
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\\\]\\\\]/g, "\\$&");
}

function highlightText(
    text: string | null | undefined,
    query: string,
): React.ReactNode {
    if (!text) return "";
    if (!query.trim()) return text;
    const parts = text.split(
        new RegExp("(" + escapeRegExp(query.trim()) + ")", "gi"),
    );
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.trim().toLowerCase() ? (
                    <mark
                        key={i}
                        style={{
                            background:
                                "color-mix(in srgb, var(--accent) 35%, transparent)",
                            color: "inherit",
                            borderRadius: "2px",
                            padding: "0 1px",
                        }}>
                        {part}
                    </mark>
                ) : (
                    part
                ),
            )}
        </>
    );
}

function normalizeSearchValue(value: unknown): string {
    if (typeof value !== "string") return "";
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9%]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getSearchConcepts(rawQuery: string): string[][] {
    const query = normalizeSearchValue(rawQuery);
    if (!query) return [];

    return query.split(" ").map((term) => {
        const alternatives = new Set([term]);
        const canonicalTerm = normalizeCompound(term);
        if (canonicalTerm) alternatives.add(canonicalTerm);

        for (const [rawAlias, rawCanonical] of Object.entries(COMPOUND_ALIASES)) {
            const alias = normalizeSearchValue(rawAlias);
            const canonical = normalizeSearchValue(rawCanonical);
            const isEquivalent =
                term === alias ||
                term === canonical ||
                (term.length >= alias.length && canonical.startsWith(term));

            if (isEquivalent) {
                alternatives.add(alias);
                alternatives.add(canonical);
            }
        }

        return [...alternatives];
    });
}

function fieldSearchScore(value: unknown, term: string, weight: number): number {
    const field = normalizeSearchValue(value);
    if (!field || !term) return 0;

    const words = field.split(" ");
    if (field === term) return weight + 50;
    if (words.includes(term)) return weight + 40;
    if (field.startsWith(term)) return weight + 30;
    if (words.some((word) => word.startsWith(term))) return weight + 20;
    if (field.includes(term)) return weight + 10;

    // Treat common punctuation differences as equivalent, e.g. GHK-Cu and GHKCu.
    const compactField = field.replace(/\s/g, "");
    const compactTerm = term.replace(/\s/g, "");
    if (compactTerm.length > 1 && compactField.includes(compactTerm)) {
        return weight + 5;
    }

    return 0;
}

export function getSearchScore(p: Promo, rawQuery: string): number {
    const concepts = getSearchConcepts(rawQuery);
    if (concepts.length === 0) return 0;

    const productFields = (p.items ?? []).flatMap((item) => [
        item.product,
        item.dosage,
        item.unit,
        item.note,
    ]);
    const metadataFields = [
        p.description,
        p.notes,
        p.warehouse,
        p.shippingNote,
        p.discountNote,
        p.moqNote,
        p.timelineText,
        p.guarantee?.text,
        p.untilSoldOut ? "until sold out" : "",
        p.shippingFee === 0 ? "free shipping" : "",
        p.freeShippingThreshold != null
            ? `free shipping over ${p.freeShippingThreshold}`
            : "",
    ];

    const searchableFields = [
        { value: p.vendor?.name, weight: 100 },
        ...productFields.map((value) => ({ value, weight: 95 })),
        { value: p.title, weight: 80 },
        ...metadataFields.map((value) => ({ value, weight: 40 })),
    ];

    const conceptScores = concepts.map((alternatives) =>
        Math.max(
            ...alternatives.flatMap((term) =>
                searchableFields.map(({ value, weight }) =>
                    fieldSearchScore(value, term, weight),
                ),
            ),
        ),
    );

    // Multi-word queries use AND semantics: every concept must match somewhere
    // meaningful on the same promo. Aliases are OR alternatives within a concept,
    // so "reta" can match either literal "Reta" copy or canonical Retatrutide.
    if (conceptScores.some((score) => score === 0)) return 0;

    const phraseQueries = [
        normalizeSearchValue(rawQuery),
        concepts
            .map((alternatives) => alternatives[alternatives.length - 1])
            .join(" "),
    ].filter((query, index, queries) => query && queries.indexOf(query) === index);
    const phraseBonus = Math.max(
        ...phraseQueries.flatMap((query) => [
            fieldSearchScore(p.vendor?.name, query, 200),
            ...productFields.map((field) =>
                fieldSearchScore(field, query, 190),
            ),
            fieldSearchScore(p.title, query, 180),
        ]),
    );

    return (
        conceptScores.reduce((total, score) => total + score, 0) + phraseBonus
    );
}

// ─── Promo Summary Extraction ──────────────────────────────────────────────────
// Rules:
// 1. Primary Offer (Required): Main discount or promo offer
// 2. One Supporting Detail: Dispatch/MOQ/Guarantee detail (NOT repeating chips/warehouse)
// 3. Max 2 lines (~80-100 chars), ending with "View Details →"

function extractPromoSummary(promo: Promo): { primaryOffer: string; supportingDetail: string } {
    let primaryOffer = "";
    let supportingDetail = "";

    // Primary Offer
    if (promo.discountNote) {
        primaryOffer = promo.discountNote.trim();
    } else if (promo.shippingFee === 0 && promo.freeShippingThreshold) {
        primaryOffer = `Free Shipping over $${promo.freeShippingThreshold}`;
    } else if (promo.shippingFee === 0) {
        primaryOffer = "Free Shipping on all orders";
    } else if (promo.freeShippingThreshold) {
        primaryOffer = `Free Shipping over $${promo.freeShippingThreshold}`;
    } else if (promo.moqNote && promo.moqNote.toLowerCase().includes("group")) {
        primaryOffer = "Group buying now open";
    } else if (promo.untilSoldOut) {
        primaryOffer = "Limited stock available";
    } else {
        primaryOffer = "Latest promotion available";
    }

    // Supporting Detail
    const candidates: string[] = [];
    if (promo.shippingNote && !promo.shippingNote.includes(primaryOffer)) candidates.push(promo.shippingNote);
    if (promo.moqNote && !promo.moqNote.includes(primaryOffer)) candidates.push(promo.moqNote);
    if (promo.guarantee?.text) candidates.push(promo.guarantee.text);

    // Clean out redundant chips info
    const cleanCandidates = candidates.filter((c) => {
        const l = c.toLowerCase();
        return !l.includes("purity") && !l.includes("reship") && !l.includes("warehouse");
    });

    if (cleanCandidates.length > 0) {
        supportingDetail = cleanCandidates[0].trim();
    } else if (promo.warehouse) {
        supportingDetail = `Ships from ${promo.warehouse}`;
    } else {
        supportingDetail = "Fast dispatch & quality guarantee";
    }

    // Length check
    if (primaryOffer.length > 55) primaryOffer = primaryOffer.slice(0, 52) + "...";
    if (supportingDetail.length > 55) supportingDetail = supportingDetail.slice(0, 52) + "...";

    return { primaryOffer, supportingDetail };
}

// ─── Badge System ────────────────────────────────────────────────────────────
// Single source of truth for all card badges.
// Returns [primary, secondary?] — max 2 badges.
// Answers: "Why should I pay attention to this promo?"
//
// Priority:
//   1. Urgency  (ends within 72h) — always wins
//   2. New      (created < 3 days ago)
//   3. Discount (% off in note)
//   4. Shipping (free shipping)
//   5. Warehouse (location)
//
// Purity / Customs Reship / MOQ → chips, NOT badges.

type BadgeSpec = { label: string; color: string; bg: string };

function getWarehouseBadge(promo: Promo): BadgeSpec | null {
    const wh = (promo.warehouse || "").toLowerCase();
    if (wh.match(/\bus\b|united.?states/)) return { label: "🇺🇸 US Warehouse", color: "#fff", bg: "#6366f1" };
    if (wh.match(/\beu\b|europe/)) return { label: "🇪🇺 EU Warehouse", color: "#fff", bg: "#6366f1" };
    if (wh.match(/\bcn\b|china/)) return { label: "🇨🇳 China Warehouse", color: "#fff", bg: "#6366f1" };
    return null;
}

function getCardBadges(promo: Promo): [BadgeSpec | null, BadgeSpec | null] {
    const now = Date.now();
    const createdMs = new Date(promo.createdAt).getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const twentyFourH = 24 * 60 * 60 * 1000;
    const isNew = now - createdMs < threeDays;
    const warehouseBadge = getWarehouseBadge(promo);
    const freeShipBadge: BadgeSpec | null = promo.shippingFee === 0
        ? { label: "🚚 Free Shipping", color: "#fff", bg: "#0891b2" }
        : null;

    // Priority 1: Urgency
    if (isEndingSoon(promo) && promo.endDate) {
        const remainingMs = new Date(promo.endDate).getTime() - now;
        const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
        const primary: BadgeSpec = remainingMs < twentyFourH
            ? { label: "🔴 Ends Today", color: "#fff", bg: "#dc2626" }
            : { label: `⏰ Ends in ${hours}h`, color: "#fff", bg: "#f97316" };
        return [primary, freeShipBadge || warehouseBadge];
    }

    // Priority 2: New
    if (isNew) {
        return [
            { label: "🆕 New", color: "#fff", bg: "#22c55e" },
            freeShipBadge || warehouseBadge,
        ];
    }

    // Priority 3: Discount %
    if (promo.discountNote) {
        const m = promo.discountNote.match(/(\d+)\s*%\s*(?:off|discount)/i);
        if (m) {
            return [
                { label: `💸 ${m[1]}% OFF`, color: "#fff", bg: "#ef4444" },
                freeShipBadge || warehouseBadge,
            ];
        }
    }

    // Priority 4: Free Shipping
    if (freeShipBadge) {
        return [freeShipBadge, warehouseBadge];
    }

    // Priority 5: Warehouse only
    if (warehouseBadge) {
        return [warehouseBadge, null];
    }

    return [null, null];
}

// Legacy shim used by getFeaturedBadge call-sites in hot-promo slot selection
function getFeaturedBadge(
    promo: Promo,
): { label: string; subLabel?: string; color: string; bg: string } | null {
    const [primary, secondary] = getCardBadges(promo);
    if (!primary) return null;
    return {
        label: primary.label,
        subLabel: secondary?.label,
        color: primary.color,
        bg: primary.bg,
    };
}

// ─── Hot Promo Score ──────────────────────────────────────────────────────────

function getHotPromoScore(promo: Promo): number {
    let score = 0;
    // Urgency dominates (+50)
    if (isEndingSoon(promo)) score += 50;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (now - new Date(promo.createdAt).getTime() < threeDays) score += 30;
    else if (now - new Date(promo.createdAt).getTime() < sevenDays) score += 15;

    const updatedMs = new Date(promo.updatedAt).getTime();
    const createdMs = new Date(promo.createdAt).getTime();
    if (updatedMs - createdMs > 60_000 && now - updatedMs < oneDay) score += 25;

    if (promo.shippingFee === 0) score += 20;
    else if (promo.freeShippingThreshold != null) score += 12;

    if (promo.warehouse?.toLowerCase().match(/\bus\b|united.?states/))
        score += 15;
    if (promo.images && promo.images.length > 0) score += 8;

    return score;
}

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
`;

// ─── Layout ──────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
    width: 100%;
    max-width: 1100px;
    min-width: 0;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding-bottom: 64px;
    padding-left: 16px;
    padding-right: 16px;
    box-sizing: border-box;
    /* NOTE: Do NOT use overflow-x: clip or hidden here — it breaks horizontal
       carousel scroll on touch devices. Page-level overflow protection is
       handled by the outer PageShell container. */

    > * {
        min-width: 0;
    }

    @media (max-width: 720px) {
        max-width: 100%;
        gap: 18px;
        padding-left: 12px;
        padding-right: 12px;
        /* Safe-area support for phones with home bars (iPhone X+) —
           80px minimum ensures last content clears any fixed chrome at bottom */
        padding-bottom: max(80px, calc(env(safe-area-inset-bottom, 0px) + 56px));
    }

    @media (max-width: 560px) {
        gap: 14px;
        padding-left: 8px;
        padding-right: 8px;
    }

    @media (max-width: 360px) {
        padding-left: 6px;
        padding-right: 6px;
    }

    @media (min-width: 640px) {
        padding-left: 24px;
        padding-right: 24px;
    }

    @media (min-width: 1024px) {
        padding-left: 32px;
        padding-right: 32px;
    }
`;

/* Outer shell that prevents page-level horizontal overflow without blocking
   carousel touch scrolling inside child containers. Unlike overflow-x: clip
   (which breaks scroll on iOS), this wraps only at the document edge. */
const PageShell = styled.div`
    --promo-status-danger: var(--status-danger, #e83c3c);
    --promo-status-success: var(--status-success, #10b981);

    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: clip;
    box-sizing: border-box;
`;

// ─── Page Header ─────────────────────────────────────────────────────────────

const PageTitleRow = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
`;

const PageTitleBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
`;

const PageTitle = styled.h1`
    margin: 0;
    min-width: 0;
    font-size: clamp(22px, 5vw, 32px);
    font-weight: 700;
    color: var(--foreground);
    line-height: 1.15;
    overflow-wrap: anywhere;
`;

const PageSubtitle = styled.p`
    margin: 0;
    font-size: 14px;
    color: var(--secondary-foreground);
    line-height: 1.4;
    overflow-wrap: break-word;
    word-break: break-word;
`;

const SubmitBtn = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 10px;
    border: none;
    background: var(--accent);
    color: var(--accent-contrast, #11171c);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    touch-action: manipulation;
    transition: filter 0.2s ease, transform 0.2s ease;

    @media (max-width: 560px) {
        padding: 8px 14px;
        font-size: 13px;
        gap: 6px;
    }

    @media (max-width: 380px) {
        padding: 7px 10px;
        font-size: 12px;
        gap: 5px;
    }

    &:hover {
        filter: brightness(1.12);
        transform: translateY(-1px);
    }

    svg {
        display: block;
        color: var(--accent-contrast, #11171c);
    }
`;

// ─── Overview Section ───────────────────────────────────────────────────────────

const OverviewSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: ${fadeIn} 0.3s ease;
`;

const LastVisitBanner = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border-radius: 16px;
    background: var(--secondary-background);
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
`;

const LastVisitTitle = styled.h3`
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--foreground);
`;

const LastVisitStats = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;

    @media (max-width: 640px) {
        grid-template-columns: 1fr;
    }
`;

const LastVisitItem = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const StatIconWrap = styled.div<{ color: string }>`
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, ${(p) => p.color} 15%, transparent);
    color: ${(p) => p.color};
    flex-shrink: 0;

    svg {
        color: ${(p) => p.color};
    }
`;

const StatText = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
`;

const StatNumber = styled.span<{ color: string }>`
    font-size: 20px;
    font-weight: 800;
    color: ${(p) => p.color};
    line-height: 1.2;
`;

const StatLabel = styled.span`
    font-size: 12px;
    font-weight: 600;
    color: var(--foreground);
    line-height: 1.2;
`;

const StatDesc = styled.span`
    font-size: 11px;
    color: var(--secondary-foreground);
    line-height: 1.2;
`;

const OverviewHeader = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
`;

const OverviewTitleBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const OverviewLabel = styled.span`
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--tertiary-foreground);
`;

const OverviewSubtitle = styled.p`
    margin: 0;
    font-size: 13px;
    color: var(--secondary-foreground);
`;

const ViewAllUpdatesBtn = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.15s ease;

    &:hover {
        opacity: 0.75;
        text-decoration: underline;
    }

    svg {
        color: var(--accent);
    }
`;

const StatCardsRow = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    @media (max-width: 640px) {
        grid-template-columns: 1fr;
    }
`;

const StatCard = styled.div<{ accent: string }>`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 14px;
    background: var(--secondary-background);
    border: 1px solid color-mix(in srgb, ${(p) => p.accent} 12%, transparent);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover {
        border-color: color-mix(in srgb, ${(p) => p.accent} 30%, transparent);
        box-shadow: 0 2px 12px
            color-mix(in srgb, ${(p) => p.accent} 8%, transparent);
    }
`;

const StatIconBox = styled.div<{ accent: string }>`
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: color-mix(in srgb, ${(p) => p.accent} 15%, transparent);
    color: ${(p) => p.accent};
`;

const StatBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
`;

const StatBigNumber = styled.span<{ accent: string }>`
    font-size: 28px;
    font-weight: 800;
    color: ${(p) => p.accent};
    line-height: 1;
    text-overflow: ellipsis;
    line-height: 1.3;
`;

const ViewAllLink = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 7px;
    border: 1px solid var(--primary-background);
    background: transparent;
    color: var(--accent);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    margin-left: 16px;
    transition: background 0.15s ease, border-color 0.15s ease;

    &:hover {
        background: var(--primary-background);
        border-color: color-mix(in srgb, var(--accent) 60%, transparent);
    }

    @media (max-width: 640px) {
        margin-left: 0;
    }
`;

// ─── Overview Redesign ────────────────────────────────────────────────────────

const OverviewContainer = styled.div`
    border-radius: 16px;
    background: var(--secondary-background);
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: ${fadeIn} 0.3s ease;
`;

const OverviewTopRow = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
`;

const OverviewTopLeft = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const OverviewTopRight = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    flex-wrap: wrap;
`;

const OverviewSectionLabel = styled.span`
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--tertiary-foreground);
`;

const OverviewSectionSubtitle = styled.p`
    margin: 0;
    font-size: 13px;
    color: var(--secondary-foreground);
`;

const OverviewStatCardsRow = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    @media (max-width: 640px) {
        grid-template-columns: 1fr;
    }
`;

const OverviewStatCard = styled.div<{ accent: string }>`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--primary-background);
    border: 1px solid color-mix(in srgb, var(--foreground) 7%, transparent);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover {
        border-color: color-mix(in srgb, var(--foreground) 15%, transparent);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
`;

const StatIconCircle = styled.div<{ accent: string }>`
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: color-mix(in srgb, ${(p) => p.accent} 14%, transparent);
    color: ${(p) => p.accent};
    font-size: 18px;
    line-height: 1;
`;

const StatCardBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
`;

const StatCardNumber = styled.div<{ accent: string }>`
    font-size: 30px;
    font-weight: 800;
    color: ${(p) => p.accent};
    line-height: 1;
    letter-spacing: -0.5px;
`;

const StatCardLabel = styled.div`
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
    margin-top: 2px;
`;

const StatCardDesc = styled.div`
    font-size: 11px;
    color: var(--tertiary-foreground);
    margin-top: 1px;
`;

// Vendor name list inside overview cards
const StatVendorList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 6px 0 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
`;

const StatVendorItem = styled.li<{ muted?: boolean }>`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: ${(p) =>
        p.muted ? "var(--tertiary-foreground)" : "var(--secondary-foreground)"};
    font-weight: ${(p) => (p.muted ? 400 : 500)};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &::before {
        content: "";
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
        opacity: 0.5;
    }
`;

// Sub-context line below Quick Stat label
const QuickStatSub = styled.div`
    font-size: 10px;
    color: var(--tertiary-foreground);
    margin-top: 1px;
    white-space: nowrap;
    opacity: 0.85;
`;

const ViewAllUpdatesLink = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.15s ease;

    &:hover {
        opacity: 0.75;
        text-decoration: underline;
    }

    svg {
        color: var(--accent);
    }
`;

// ─── Card Badge Tag ───────────────────────────────────────────────────────────

const BadgeRow = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    align-self: flex-start;
    max-width: 100%;
    min-width: 0;

    [data-card-kind="regular"] & {
        margin-bottom: 12px;
    }

    @media (max-width: 720px) {
        gap: 5px;
        /* Allow badges to wrap to next line rather than overflow the card */
        flex-wrap: wrap;
        margin-bottom: 4px;
    }
`;

const CardBadgeTag = styled.span<{ bg: string; textColor: string }>`
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 13px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    background: ${(p) => p.bg};
    color: ${(p) => p.textColor};
    width: fit-content;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    [data-card-kind="regular"] & {
        height: 30px;
        padding: 0 12px;
        border-radius: 15px;
        font-size: 11px;
    }
`;

// ─── Featured Reason Badge (Hot Promos Today — explains WHY) ─────────────────

const FeaturedReasonBadge = styled.span<{ bg: string; textColor: string }>`
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: 14px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    background: ${(p) => p.bg};
    color: ${(p) => p.textColor};
    flex-shrink: 0;
    width: fit-content;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (max-width: 720px) {
        height: 24px;
        padding: 0 9px;
        font-size: 9px;
    }
`;

const SecondaryReasonPill = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 10px;
    border-radius: 13px;
    font-size: 10px;
    font-weight: 600;
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
    flex-shrink: 0;
    width: fit-content;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (max-width: 720px) {
        display: none;
    }
`;

// ─── Price Highlight ──────────────────────────────────────────────────────────

const PriceHighlight = styled.div`
    display: flex;
    align-items: baseline;
    gap: 7px;
    flex-wrap: wrap;
    min-width: 0;

    [data-featured="true"] & {
        @media (max-width: 720px) {
            display: none;
        }
    }
`;

const PriceValue = styled.span`
    font-size: clamp(20px, 4vw, 26px);
    font-weight: 800;
    color: var(--accent);
    letter-spacing: -0.5px;
    line-height: 1;
`;

const PriceLabel = styled.span`
    font-size: 12px;
    color: var(--tertiary-foreground);
    font-weight: 500;
`;

// ─── Vendor Monogram Fallback ─────────────────────────────────────────────────

const VendorMonogram = styled.div`
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: color-mix(
        in srgb,
        var(--accent) 14%,
        var(--primary-background)
    );
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.5px;
    user-select: none;

    @media (max-width: 720px) {
        width: 38px;
        height: 38px;
        font-size: 12px;
    }
`;

// ─── Quick Stats Bar ──────────────────────────────────────────────────────────

const QuickStatsBar = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    background: var(--primary-background);
    animation: ${fadeIn} 0.3s ease;

    @media (max-width: 640px) {
        grid-template-columns: repeat(2, 1fr);
    }
`;

const QuickStatCell = styled.div<{ clickable?: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 12px 10px;
    text-align: center;
    border-right: 1px solid
        color-mix(in srgb, var(--foreground) 8%, transparent);
    transition: background 0.15s ease;
    cursor: ${(p) => (p.clickable ? "pointer" : "default")};
    user-select: none;

    ${(p) =>
        p.clickable &&
        `
        &:hover {
            background: color-mix(in srgb, var(--foreground) 5%, transparent);
        }
        &:active {
            background: color-mix(in srgb, var(--foreground) 10%, transparent);
        }
    `}

    &:last-child {
        border-right: none;
    }

    @media (max-width: 640px) {
        &:nth-child(2) {
            border-right: none;
        }
        &:nth-child(1),
        &:nth-child(2) {
            border-bottom: 1px solid
                color-mix(in srgb, var(--foreground) 8%, transparent);
        }
    }
`;

const QuickStatValue = styled.div<{ accent?: string }>`
    font-size: 20px;
    font-weight: 800;
    color: ${(p) => p.accent || "var(--foreground)"};
    line-height: 1.1;
    letter-spacing: -0.3px;
`;

const QuickStatLabel = styled.div`
    font-size: 11px;
    color: var(--tertiary-foreground);
    font-weight: 500;
    white-space: nowrap;
`;

// ─── Card Updated Tag ─────────────────────────────────────────────────────────

const UpdatedTag = styled.span`
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--tertiary-foreground);
    flex-shrink: 0;
    min-width: 0;
    max-width: 48%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    @media (max-width: 720px) {
        font-size: 10px;
    }

    svg {
        color: var(--tertiary-foreground);
    }
`;

// ─── Filter Chip Divider ──────────────────────────────────────────────────────

const FilterDivider = styled.div`
    width: 1px;
    height: 20px;
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    flex-shrink: 0;
    margin: 0 4px;
    align-self: center;
`;

// ─── Search + Sort ────────────────────────────────────────────────────────────

const SearchSortRow = styled.div`
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    box-sizing: border-box;

    @media (max-width: 560px) {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }
`;

const SearchWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;

    input,
    > input,
    > div {
        width: 100%;
        box-sizing: border-box;
    }

    input {
        height: 44px;
        width: 100%;
        box-sizing: border-box;
        padding-left: 48px;
        padding-right: 44px;
        border-radius: 12px;
        font-size: 14px;
        background: var(--secondary-background);
        border: 1.5px solid
            color-mix(in srgb, var(--foreground) 10%, transparent);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        @media (min-width: 640px) {
            height: 54px;
            padding-left: 52px;
            padding-right: 48px;
            border-radius: 14px;
            font-size: 15px;
        }

        &::placeholder {
            color: color-mix(in srgb, var(--foreground) 35%, transparent);
        }

        &:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 4px
                color-mix(in srgb, var(--accent) 12%, transparent);
            outline: none;
        }

        @media (max-width: 720px) {
            height: 38px;
            padding-left: 38px;
            padding-right: 34px;
            border-radius: 10px;
            font-size: 13px;
        }
    }

    .search-icon {
        position: absolute;
        left: 18px;
        color: color-mix(in srgb, var(--foreground) 40%, transparent);
        pointer-events: none;
        z-index: 1;

        @media (max-width: 720px) {
            left: 13px;
            width: 17px;
            height: 17px;
        }
    }

    .clear {
        position: absolute;
        right: 14px;
        display: flex;
        cursor: pointer;
        color: var(--tertiary-foreground);
        z-index: 1;
        transition: color 0.15s ease;

        &:hover {
            color: var(--foreground);
        }
    }
`;

const ClearButton = styled.button`
    position: absolute;
    top: 50%;
    right: 4px;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: transparent;
    transform: translateY(-50%);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tertiary-foreground);
    z-index: 2;
    transition: color 0.15s ease, background-color 0.15s ease;

    @media (hover: hover) {
        &:hover {
            color: var(--foreground);
            background: color-mix(
                in srgb,
                var(--foreground) 6%,
                transparent
            );
        }
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
        color: var(--foreground);
    }

    &:active {
        color: var(--foreground);
        background: color-mix(
            in srgb,
            var(--foreground) 10%,
            transparent
        );
    }

    &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        color: var(--tertiary-foreground);
    }

    @media (max-width: 720px) {
        right: 0;
        width: 38px;
        height: 38px;
    }
`;

const RecentSearchesPopup = styled.div`
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: var(--secondary-background);
    border: 1.5px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    z-index: 100;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const RecentTitle = styled.div`
    font-size: 11px;
    font-weight: 700;
    color: var(--tertiary-foreground);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 2px 6px;
`;

const RecentItem = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
        background: color-mix(in srgb, var(--foreground) 5%, transparent);
    }
`;

const RecentDeleteBtn = styled.button`
    background: none;
    border: none;
    color: var(--tertiary-foreground);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;

    &:hover {
        color: var(--foreground);
        background: color-mix(in srgb, var(--foreground) 10%, transparent);
    }
`;

const EmptySuggestions = styled.ul`
    list-style: none;
    padding: 0;
    margin: 16px 0 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
`;

const SuggestionItem = styled.li`
    font-size: 14px;
    color: var(--accent);
    cursor: pointer;
    font-weight: 600;
    transition: opacity 0.15s ease;

    &:hover {
        opacity: 0.8;
        text-decoration: underline;
    }
`;

const SortSelect = styled.select`
    height: 44px;
    width: 100%;
    padding: 0 36px 0 12px;
    border: 1.5px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 10px;
    background-color: var(--secondary-background);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23848484' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    color: var(--foreground);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
    touch-action: manipulation;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    transition: border-color 0.15s ease;

    @media (min-width: 561px) {
        width: auto;
    }

    @media (min-width: 640px) {
        height: 54px;
        padding: 0 36px 0 14px;
        border-radius: 12px;
    }

    &:focus {
        border-color: var(--accent);
        outline: none;
    }

    @media (max-width: 720px) {
        height: 38px;
        border-radius: 10px;
        font-size: 13px;
    }
`;

// ─── Filter Chips ─────────────────────────────────────────────────────────────

// Horizontally scrollable on mobile so chips don't wrap/overflow
const FilterChipsRow = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
    overflow-x: auto;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    /* NOTE: Do NOT use contain: inline-size — it blocks touch scroll on iOS */
    touch-action: pan-x;

    scrollbar-width: none;
    &::-webkit-scrollbar {
        display: none;
    }
`;

// Sticky wrapper for Search + Sort + Filter Chips on mobile
const StickySearchBar = styled.div`
    display: contents; /* transparent on desktop — no layout change */

    @media (max-width: 720px) {
        display: flex;
        flex-direction: column;
        gap: 6px;
        position: sticky;
        top: 0;
        z-index: 20;
        background: var(--primary-background);
        padding: 8px 0 6px;
        border-bottom: 1px solid
            color-mix(in srgb, var(--foreground) 6%, transparent);
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
    }
`;

const FilterChip = styled.button<{ active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    height: 36px;
    border-radius: 100px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
    white-space: nowrap;
    flex-shrink: 0;

    .chip-count {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 10px;
        margin-left: 2px;
        transition: all 0.15s ease;
        ${(p) =>
        p.active
            ? css`
                      background: color-mix(
                          in srgb,
                          var(--accent-contrast, #11171c) 20%,
                          transparent
                      );
                      color: var(--accent-contrast, #11171c);
                  `
            : css`
                      background: color-mix(
                          in srgb,
                          var(--foreground) 8%,
                          transparent
                      );
                      color: color-mix(
                          in srgb,
                          var(--foreground) 60%,
                          transparent
                      );
                  `}
    }

    @media (max-width: 480px) {
        padding: 5px 10px;
        height: 32px;
        font-size: 12px;

        .chip-count {
            font-size: 10px;
            padding: 1px 5px;
        }
    }

    ${(p) =>
        p.active
            ? css`
                  background: var(--accent);
                  color: var(--accent-contrast, #11171c);
                  border: 1.5px solid var(--accent);
                  box-shadow: 0 0 0 3px
                          color-mix(in srgb, var(--accent) 20%, transparent),
                      0 2px 8px
                          color-mix(in srgb, var(--accent) 30%, transparent);
                  transform: translateY(-1px);
              `
            : css`
                  background: transparent;
                  color: color-mix(in srgb, var(--foreground) 55%, transparent);
                  border: 1.5px solid
                      color-mix(in srgb, var(--foreground) 10%, transparent);

                  &:hover {
                      border-color: color-mix(
                          in srgb,
                          var(--accent) 45%,
                          transparent
                      );
                      color: var(--foreground);
                      background: color-mix(
                          in srgb,
                          var(--accent) 7%,
                          transparent
                      );
                      transform: translateY(-1px);
                  }
              `}
`;

// ─── Market Activity Alert Bar (Condensed 1-line update alert) ───────────────

const MarketActivityAlert = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 8%, var(--primary-background));
    border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
    margin-top: 12px;
    margin-bottom: 16px;
    animation: promoFadeIn 0.2s ease-out;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;

    @media (max-width: 560px) {
        margin-top: 8px;
        margin-bottom: 12px;
        padding: 8px 10px;
        gap: 5px;
    }

    @media (max-width: 360px) {
        padding: 7px 8px;
        gap: 4px;
    }

    .alert-left {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--foreground);
        flex: 1;
        min-width: 0;
        overflow: hidden;

        @media (max-width: 480px) {
            font-size: 11px;
            gap: 5px;
        }

        .alert-text-desktop {
            display: inline;
            @media (max-width: 560px) {
                display: none;
            }
        }

        .alert-text-mobile {
            display: none;
            @media (max-width: 560px) {
                display: inline;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    }

    @keyframes alertGlow {
        0%,
        100% {
            box-shadow: 0 0 0 0
                    color-mix(in srgb, var(--accent) 0%, transparent),
                0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
        }
        50% {
            box-shadow: 0 0 0 4px
                    color-mix(in srgb, var(--accent) 18%, transparent),
                0 0 8px 2px color-mix(in srgb, var(--accent) 30%, transparent);
        }
    }

    .alert-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
        flex-shrink: 0;
        animation: alertGlow 2.4s ease-in-out infinite;
    }

    .alert-right {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
    }

    .alert-link {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: none;
        border: none;
        padding: 0;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--accent);
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;

        @media (max-width: 480px) {
            font-size: 11px;
        }

        @media (max-width: 360px) {
            gap: 1px;
            font-size: 10px;
        }

        .link-text-desktop {
            display: inline;
            @media (max-width: 480px) {
                display: none;
            }
        }

        .link-text-mobile {
            display: none;
            @media (max-width: 480px) {
                display: inline;
            }
        }

        &:hover {
            text-decoration: underline;
        }
    }

    .alert-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: none;
        border: none;
        padding: 0;
        color: var(--tertiary-foreground);
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s ease, color 0.15s ease;

        @media (max-width: 360px) {
            width: 18px;
            height: 18px;
        }

        &:hover {
            background: color-mix(in srgb, var(--foreground) 10%, transparent);
            color: var(--foreground);
        }
    }
`;

const MarketUpdatesEmptyState = styled.div`
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    box-sizing: border-box;
    margin: 12px 0 16px;
    padding: 12px 14px;
    border: 1px solid var(--secondary-background);
    border-radius: 12px;
    background: var(--primary-background);
    color: var(--foreground);
    font-size: 13px;

    span {
        color: var(--tertiary-foreground);
    }
`;

// ─── Categorized Filters ──────────────────────────────────────────────────────

const CategorizedFilterWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin-top: 16px;
    margin-bottom: 20px;
`;

const FilterGroupRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;

    @media (max-width: 720px) {
        /* Allow chips to scroll horizontally on narrow screens */
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        overscroll-behavior-x: contain;

        &::-webkit-scrollbar {
            display: none;
        }
    }
`;

const FilterGroupLabel = styled.span`
    font-size: 13px;
    font-weight: 500;
    color: var(--tertiary-foreground);
    min-width: max-content;
    flex-shrink: 0;
`;

// ─── Trending Peptides ────────────────────────────────────────────────────────

const TrendingSection = styled.div`
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin-bottom: 24px;
`;

const TrendingRail = styled.div`
    display: flex;
    gap: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding-bottom: 6px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }

    @media (max-width: 720px) {
        /* Side padding: first card has 2px from left edge, last card has
           16px of trailing space so it's clearly fully visible */
        padding-left: 2px;
        padding-right: 16px;
        gap: 10px;
    }
`;

const TrendingCard = styled.button`
    flex: 0 0 200px;
    width: 200px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    background: var(--secondary-background);
    color: var(--foreground);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    scroll-snap-align: start;
    transition: border-color 0.15s ease, transform 0.15s ease;

    &:hover {
        border-color: color-mix(in srgb, var(--accent) 35%, transparent);
        background: color-mix(in srgb, var(--accent) 5%, var(--secondary-background));
        transform: translateY(-1px);
    }

    @media (max-width: 720px) {
        /* Fluid width: fills ~72-82% of viewport leaving a clear peek of next card.
           clamp(min, preferred, max) — safe at 320px through 430px */
        flex: 0 0 clamp(200px, calc(72vw), 260px);
        width: clamp(200px, calc(72vw), 260px);
        padding: 10px;
        gap: 6px;
    }

    @media (max-width: 360px) {
        flex: 0 0 clamp(180px, calc(70vw), 220px);
        width: clamp(180px, calc(70vw), 220px);
    }
`;

const TrendingTitle = styled.div`
    min-width: 0;

    strong {
        display: block;
        font-size: 14px;
        font-weight: 700;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
`;

const TrendingMeta = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    color: var(--secondary-foreground);

    strong {
        color: var(--foreground);
        font-size: 13px;
        font-weight: 700;
    }
`;

const TrendingCompareBtn = styled.div`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin-top: 4px;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    color: var(--accent);
    align-self: flex-start;
    pointer-events: none;
`;

const VendorAvatarStack = styled.div`
    display: flex;
    align-items: center;
    min-width: 0;

    span, img {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        object-fit: cover;
        display: grid;
        place-items: center;
        margin-left: -5px;
        border: 2px solid var(--secondary-background);
        background: color-mix(in srgb, var(--accent) 20%, var(--primary-background));
        color: var(--foreground);
        font-size: 8px;
        font-weight: 700;

        &:first-child {
            margin-left: 0;
        }
    }

    .more {
        width: auto;
        padding: 0 5px;
        border-radius: 10px;
        color: var(--tertiary-foreground);
    }
`;

const CompareActionLink = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    padding: 0;
    color: var(--accent);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    margin-left: auto;
    transition: opacity 0.15s ease, color 0.15s ease;
    white-space: nowrap;
    flex-shrink: 0;

    /* Arrow nudge on hover */
    &::after {
        content: '→';
        display: inline-block;
        margin-left: 2px;
        transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    &:hover {
        opacity: 1;
        color: var(--accent);
    }

    &:hover::after {
        transform: translateX(3px);
    }

    @media (max-width: 480px) {
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
    }
`;

// ─── Compare Drawer (Desktop Panel + Mobile Bottom Sheet) ─────────────────────

const CompareBackdrop = styled.button`
    position: fixed;
    inset: 0;
    z-index: 99;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);

    @media (min-width: 721px) {
        display: none;
    }
`;

const CompareDrawerContainer = styled.aside`
    display: flex;
    flex-direction: column;
    background: var(--secondary-background);
    color: var(--foreground);
    z-index: 100;
    overflow: hidden;
    box-sizing: border-box;

    /* Mobile: Bottom sheet */
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: min(92vh, 720px);
    padding: 0 16px max(16px, env(safe-area-inset-bottom, 16px));
    border-radius: 20px 20px 0 0;
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    border-bottom: none;
    gap: 12px;
    box-shadow: 0 -12px 60px rgba(0, 0, 0, 0.5);
    animation: compareSheetIn 280ms cubic-bezier(0.32, 0.72, 0, 1);

    @keyframes compareSheetIn {
        from {
            opacity: 0.5;
            transform: translateY(100%);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Desktop: Right-side panel ~400px */
    @media (min-width: 721px) {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: auto;
        width: 400px;
        max-width: 90vw;
        max-height: none;
        border-radius: 0;
        border: none;
        border-left: 1px solid
            color-mix(in srgb, var(--foreground) 10%, transparent);
        padding: 20px 16px;
        gap: 12px;
        box-shadow: -10px 0 48px rgba(0, 0, 0, 0.28);
        animation: compareSlideIn 220ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    /* Full-screen on very small phones (≤480px) */
    @media (max-width: 480px) {
        max-height: 100dvh;
        border-radius: 12px 12px 0 0;
    }

    @keyframes compareSlideIn {
        from {
            opacity: 0;
            transform: translateX(48px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;

const SheetHandle = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px 0 2px;
    flex-shrink: 0;
    cursor: grab;

    &::before {
        content: '';
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: color-mix(in srgb, var(--foreground) 20%, transparent);
    }

    @media (min-width: 721px) {
        display: none;
    }
`;

const DrawerHeader = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);

    .drawer-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;

        span {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--accent);
        }

        h3 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: var(--foreground);
        }
    }

    .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: color-mix(in srgb, var(--foreground) 8%, transparent);
        color: var(--foreground);
        cursor: pointer;
        transition: background 0.15s ease;

        &:hover {
            background: color-mix(in srgb, var(--foreground) 16%, transparent);
        }
    }
`;

const VendorCompareList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 2px;
    padding-bottom: 32px;
    -webkit-overflow-scrolling: touch;
`;

const VendorCompareCard = styled.div<{ expanded?: boolean }>`
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: fit-content;
    border-radius: 12px;
    border: 1px solid
        ${(p) =>
        p.expanded
            ? "color-mix(in srgb, var(--accent) 55%, transparent)"
            : "color-mix(in srgb, var(--foreground) 10%, transparent)"};
    background: var(--primary-background);
    overflow: visible;
    transition: border-color 0.15s ease;

    .vendor-card-header {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto auto;
        align-items: center;
        gap: 10px;
        padding: 12px;
        cursor: pointer;
        min-width: 0;

        .vendor-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
            min-width: 0;

            strong {
                font-size: 14px;
                font-weight: 700;
                color: var(--foreground);
                line-height: 1.3;
                overflow-wrap: anywhere;
            }

            span {
                font-size: 12px;
                color: var(--tertiary-foreground);
                line-height: 1.3;
                overflow-wrap: anywhere;
            }
        }

        .vendor-price {
            min-width: 0;
            text-align: right;
            white-space: nowrap;
        }

        .vendor-status {
            display: inline-flex;
            align-items: center;
            max-width: 112px;
            min-width: 0;
            padding: 2px 6px;
            border-radius: 6px;
            overflow: hidden;
            color: var(--status-online, #10b981);
            background: color-mix(
                in srgb,
                var(--status-online, #10b981) 15%,
                transparent
            );
            font-size: 10px;
            font-weight: 700;
            line-height: 1.3;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .price-badge {
            font-size: 14px;
            font-weight: 700;
            color: var(--accent);
            white-space: nowrap;
        }

        @media (max-width: 360px) {
            grid-template-columns: auto minmax(0, 1fr) auto auto;
            align-items: start;

            .vendor-status {
                grid-column: 2 / 4;
                grid-row: 2;
                justify-self: start;
                max-width: 100%;
            }
        }
    }

    .vendor-card-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 10px 12px 24px 12px;
        border-top: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
        margin-top: 4px;
        height: auto;
        overflow: visible;

        .specs-grid {
            display: grid;
            /* Hallmark gate 50 — use minmax(0,1fr) to prevent grid track overflow */
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            font-size: 12px;

            .spec-item {
                display: flex;
                flex-direction: column;
                gap: 2px;

                span {
                    font-size: 10px;
                    color: var(--tertiary-foreground);
                    text-transform: uppercase;
                }

                strong {
                    color: var(--foreground);
                    font-weight: 600;
                    min-width: 0;
                    overflow-wrap: anywhere;
                }
            }

            @media (max-width: 380px) {
                gap: 6px;
                font-size: 11px;
            }
        }

        .action-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
            padding-top: 4px;
            /* Keep buttons side by side, never wrap */
            flex-wrap: nowrap;

            a, button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 9px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 700;
                font-family: inherit;
                cursor: pointer;
                text-decoration: none;
                line-height: 1.2;
                /* Hallmark gate 49 — 44px touch target, equal width, no text clip */
                min-height: 44px;
                flex: 1;
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                box-sizing: border-box;
                transition: opacity 0.15s ease, transform 0.1s ease;

                &:hover {
                    opacity: 0.92;
                    transform: translateY(-1px);
                }
            }

            .btn-primary {
                background: var(--accent);
                color: var(--accent-foreground, #ffffff) !important;
                border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
                box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 30%, transparent);
            }

            .btn-secondary {
                background: color-mix(in srgb, var(--foreground) 12%, transparent);
                color: var(--foreground) !important;
                border: 1px solid color-mix(in srgb, var(--foreground) 16%, transparent);
            }

            .btn-outline {
                background: transparent;
                color: var(--accent);
                border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
            }

            @media (max-width: 380px) {
                gap: 6px;

                a, button {
                    font-size: 11px;
                    padding: 9px 10px;
                }
            }

            @media (max-width: 340px) {
                flex-direction: column;

                a, button {
                    width: 100%;
                    flex: none;
                }
            }
        }
    }
`;

// ─── Section Header ───────────────────────────────────────────────────────────

// Thin divider between filter chips and featured section — signals a curated zone
const SectionDivider = styled.hr`
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    margin: 0;
    width: 100%;
    box-sizing: border-box;

    @media (max-width: 720px) {
        border-top-width: 2px;
        border-top-color: color-mix(in srgb, var(--foreground) 8%, transparent);
    }
`;

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    margin-top: 8px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;

    @media (max-width: 720px) {
        gap: 8px;
        margin-bottom: 10px;
    }
`;

const SectionTitleBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
`;

// Slightly larger, bolder title for Hot Promos to feel curated
const SectionTitle = styled.h2`
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--foreground);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: -0.3px;
    min-width: 0;
    overflow-wrap: anywhere;

    @media (max-width: 720px) {
        font-size: 18px;
        gap: 6px;
    }
`;

const SectionSubtitle = styled.p`
    margin: 0;
    font-size: 12px;
    color: var(--tertiary-foreground);

    @media (max-width: 720px) {
        font-size: 11px;
        line-height: 1.3;
    }
`;

const ToastContainer = styled.div`
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    border-radius: 12px;
    background: var(--secondary-background);
    color: var(--foreground);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: toastIn 300ms cubic-bezier(0.16, 1, 0.3, 1);

    .toast-action-btn {
        background: var(--accent);
        color: var(--accent-contrast, #ffffff);
        border: none;
        border-radius: 6px;
        padding: 5px 12px;
        font-size: 11px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s ease;

        &:hover {
            opacity: 0.9;
        }
    }

    @keyframes toastIn {
        from {
            opacity: 0;
            transform: translate(-50%, -20px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
`;

const SectionViewAll = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.15s ease;

    &:hover {
        opacity: 0.8;
        text-decoration: underline;
    }

    svg {
        color: var(--accent);
    }
`;

// ─── All Promos Header ────────────────────────────────────────────────────────

const AllPromosHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    min-width: 0;

    @media (max-width: 720px) {
        margin-bottom: 10px;
    }
`;

const AllPromosTitle = styled.h2`
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--foreground);
`;

const AllPromosCount = styled.span`
    font-size: 13px;
    color: var(--tertiary-foreground);
    font-weight: 400;
`;

// ─── Active Filter Notice Bar ───────────────────────────────────────────────

const ActiveFilterNoticeBar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 12px;
    background: color-mix(
        in srgb,
        var(--accent) 10%,
        var(--primary-background)
    );
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    margin-bottom: 20px;
    animation: promoFadeIn 0.2s ease-out;

    .notice-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
    }

    .live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent);
        flex-shrink: 0;
        animation: promo-pulse 2s infinite;
    }

    .notice-text {
        font-size: 13px;
        color: var(--foreground);
        font-weight: 500;

        strong {
            color: var(--accent);
            font-weight: 700;
        }
    }

    .reset-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        padding: 4px 8px;
        border-radius: 6px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--accent);
        cursor: pointer;
        transition: background 0.15s ease;

        &:hover {
            background: color-mix(in srgb, var(--accent) 18%, transparent);
        }
    }

    @keyframes promo-pulse {
        0%,
        100% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.25);
            opacity: 0.6;
        }
    }
`;

// ─── Grid ─────────────────────────────────────────────────────────────────────

const Grid = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: 1fr;
    align-items: stretch;
    gap: 20px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    animation: promoGridSwap 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);

    @media (min-width: 720px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (min-width: 1080px) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    > * {
        height: 100%;
        margin-bottom: 0;
    }

    @keyframes promoGridSwap {
        from {
            opacity: 0.45;
            transform: translateY(6px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

// ─── Hot Promos Row ───────────────────────────────────────────────────────────

const HotPromosGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    animation: promoGridSwap 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    /* Uniform row height — all cards same height */
    align-items: stretch;

    > * {
        height: 100%;
    }

    @media (max-width: 1200px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* ── Mobile: horizontal swipe carousel ── */
    @media (max-width: 720px) {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        gap: 12px;
        padding-bottom: 12px;
        /* Add side padding so first/last cards have breathing room */
        padding-left: 2px;
        padding-right: 16px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overscroll-behavior-x: contain;
        /* NOTE: Do NOT use contain: inline-size — it blocks child scroll */
        touch-action: pan-x;

        &::-webkit-scrollbar {
            display: none;
        }

        > * {
            /* Fluid width: fills ~84% of viewport, clear peek of next card.
               Safe at 320px (268px card) through 430px (349px card capped at 310px). */
            flex: 0 0 clamp(260px, calc(84vw - 12px), 310px);
            width: clamp(260px, calc(84vw - 12px), 310px);
            min-width: 0;
            scroll-snap-align: start;
            margin-bottom: 0;
            height: auto;
        }

        @media (max-width: 360px) {
            gap: 10px;
            padding-right: 12px;

            > * {
                flex: 0 0 clamp(240px, calc(82vw - 10px), 280px);
                width: clamp(240px, calc(82vw - 10px), 280px);
            }
        }
    }
`;

// Container wrapper for Hot Promos on mobile
const HotPromosSectionWrapper = styled.div`
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;

    @media (max-width: 720px) {
        margin-top: 12px;
        margin-bottom: 24px;
    }
`;

// ─── Card ─────────────────────────────────────────────────────────────────────

const cardFadeIn = keyframes`
    from { opacity: 0; transform: translateY(12px) scale(0.99); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const promoHighlight = keyframes`
    0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent); border-color: var(--accent); }
    40%  { box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 25%, transparent); border-color: var(--accent); }
    100% { box-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06); border-color: color-mix(in srgb, var(--foreground) 6%, transparent); }
`;

const Card = styled.div`
    animation: ${cardFadeIn} 180ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 20px;
    border-radius: 16px;
    background: var(--secondary-background);
    border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    break-inside: avoid;
    margin-bottom: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
    transition: transform 0.18s ease, box-shadow 0.18s ease,
        border-color 0.18s ease;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;
    height: 100%;

    &[data-card-kind="regular"] {
        padding: 24px;
        border-radius: 20px;
        border-color: color-mix(
            in srgb,
            var(--foreground) 10%,
            transparent
        );
        background: color-mix(
            in srgb,
            var(--secondary-background) 96%,
            var(--foreground) 4%
        );
    }

    /* children stack with small gaps; footer gets margin-top: auto via CardFooter */
    > * + * {
        margin-top: 10px;
    }

    @media (max-width: 720px) {
        padding: 12px;
        border-radius: 12px;
        margin-bottom: 0;

        > * + * {
            margin-top: 7px;
        }

        &[data-card-kind="regular"] {
            padding: 16px;
            border-radius: 16px;
        }
    }

    &.promo-highlight {
        animation: ${promoHighlight} 1.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.16),
            0 1px 6px rgba(0, 0, 0, 0.08);
        border-color: color-mix(in srgb, var(--foreground) 12%, transparent);
    }
`;

// Featured card variant (used in Hot Promos Today) — compact, uniform-height card
const FeaturedCard = styled(Card)`
    margin-bottom: 0;
    break-inside: unset;
    min-width: 0;
    /* Flex column so footer always pins to bottom */
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;

    /* Override the child-gap to be tighter */
    > * + * {
        margin-top: 6px;
    }

    @media (max-width: 720px) {
        height: auto;
        min-width: unset;
        padding: 10px;

        > * + * {
            margin-top: 5px;
        }
    }
`;

// ── Featured card sub-components ─────────────────────────────────────────────

// Compressed logistics info — one line, tight inline chips
const FeaturedLogisticsLine = styled.div`
    font-size: 11px;
    color: var(--secondary-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;

    @media (max-width: 720px) {
        /* Allow wrapping so logistics info doesn't spill past card edge */
        white-space: normal;
        flex-wrap: wrap;
    }

    span.sep {
        color: var(--tertiary-foreground);
        opacity: 0.5;
    }
`;

// Short 2-3 line clamped description
const FeaturedDesc = styled.div`
    font-size: 12px;
    color: var(--secondary-foreground);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
    min-width: 0;

    @media (max-width: 720px) {
        -webkit-line-clamp: 2;
    }
`;

// Fixed-ratio hero image wrapper with photo-count overlay
const FeaturedImageWrap = styled.div`
    position: relative;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    background: var(--primary-background);
    flex-shrink: 0;
    /* 16:10 ratio */
    aspect-ratio: 16 / 10;

    &[role="button"] {
        cursor: zoom-in;
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .photo-count {
        position: absolute;
        bottom: 6px;
        right: 6px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 7px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: 10px;
        font-weight: 600;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        pointer-events: none;
    }

    @media (max-width: 720px) {
        /* 16:9 keeps card height manageable on mobile */
        aspect-ratio: 16 / 9;
    }
`;

// ─── Hot Promos Carousel Pagination Dots ─────────────────────────────────────

const HotCarouselDots = styled.div`
    display: none;
    justify-content: center;
    align-items: center;
    gap: 6px;
    padding: 8px 0 2px;

    @media (max-width: 720px) {
        display: flex;
    }
`;

const CarouselDot = styled.div<{ active: boolean }>`
    height: 6px;
    border-radius: 3px;
    transition: width 0.25s ease, background 0.25s ease;
    width: ${(p) => (p.active ? "18px" : "6px")};
    background: ${(p) =>
        p.active
            ? "var(--accent)"
            : "color-mix(in srgb, var(--foreground) 18%, transparent)"};
`;

// ─── Status Badge ─────────────────────────────────────────────────────────────

const badgeColors: Record<
    Exclude<BadgeType, null>,
    { bg: string; text: string }
> = {
    new: { bg: "#22c55e", text: "#fff" },
    updated: { bg: "#3b82f6", text: "#fff" },
    "ending-soon": { bg: "#f97316", text: "#fff" },
};

const badgeLabels: Record<Exclude<BadgeType, null>, string> = {
    new: "NEW",
    updated: "UPDATED",
    "ending-soon": "ENDING SOON",
};

// Consistent height/padding/radius across all badge types
const StatusBadge = styled.span<{ type: Exclude<BadgeType, null> }>`
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    background: ${(p) => badgeColors[p.type].bg};
    color: ${(p) => badgeColors[p.type].text};
    align-self: flex-start;
    flex-shrink: 0;
`;

// ─── Card Head ────────────────────────────────────────────────────────────────

const CardHead = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;

    @media (max-width: 720px) {
        gap: 9px;
    }

    [data-card-kind="regular"] & {
        gap: 14px;
    }
`;

const Logo = styled.img`
    width: 42px;
    height: 42px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--primary-background);

    @media (max-width: 720px) {
        width: 38px;
        height: 38px;
    }

    [data-card-kind="regular"] & {
        width: 48px;
        height: 48px;
    }
`;

const LogoFallback = styled.div`
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: var(--primary-background);
    color: var(--tertiary-foreground);

    @media (max-width: 720px) {
        width: 38px;
        height: 38px;
    }
`;

const VendorMeta = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 2px;

    .vendor-name {
        font-weight: 600;
        font-size: 15px;
        color: var(--foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        @media (max-width: 720px) {
            font-size: 14px;
        }
    }

    [data-card-kind="regular"] & .vendor-name {
        font-size: 17px;
        font-weight: 650;
    }

    .warehouse-row {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--tertiary-foreground);
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
`;

// Circular CTA button in the top-right corner of the card header.
// Accent background, icon-only: ChevronRight (joined) or Plus (not joined).
const ActionIcon = styled.div`
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;
    text-decoration: none;

    /* Force icon colour over any global a:link rule */
    & > svg {
        display: block;
        color: var(--accent-contrast, #11171c);
    }

    &:hover {
        filter: brightness(1.12);
        transform: translateY(-1px);
    }

    @media (max-width: 720px) {
        width: 32px;
        height: 32px;
    }

    [data-card-kind="regular"] & {
        width: 42px;
        height: 42px;
    }
`;


// ─── Empty / Loader ───────────────────────────────────────────────────────────

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

const PromoTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
    line-height: 1.4;
    opacity: 0.85;
    overflow-wrap: anywhere;

    [data-card-kind="regular"] & {
        font-size: 16px;
        font-weight: 650;
        line-height: 1.35;
        opacity: 1;
    }

    @media (max-width: 720px) {
        font-size: 13px;
        line-height: 1.3;
    }

    [data-featured="true"] & {
        @media (max-width: 720px) {
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    }
`;

const ItemTable = styled.div`
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    overflow: hidden;
    background: var(--primary-background);
    min-width: 0;

    [data-featured="true"] & {
        @media (max-width: 720px) {
            display: none;
        }
    }
`;

const ItemRow = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 9px 12px;
    font-size: 13px;
    min-width: 0;

    & + & {
        border-top: 1px solid var(--secondary-background);
    }

    .product {
        font-weight: 600;
        color: var(--foreground);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .dosage {
        color: var(--secondary-foreground);
    }

    .moq {
        color: var(--tertiary-foreground);
        font-size: 12px;
    }

    .price {
        margin-left: auto;
        font-weight: 700;
        color: var(--foreground);
        white-space: nowrap;
        flex-shrink: 0;
    }

    .unit {
        color: var(--tertiary-foreground);
        font-weight: 400;
        font-size: 12px;
    }
`;

const ItemNote = styled.div`
    padding: 0 12px 9px;
    font-size: 12px;
    color: var(--tertiary-foreground);
    background: var(--primary-background);
`;

const Chip = styled.span<{ accent?: boolean; tone?: string }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
    padding: 5px 8px;
    border-radius: 6px;
    /* Never let a single chip overflow its card on mobile */
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    /* Allow long shipping strings to wrap instead of overflowing */
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
    color: ${(props) =>
        props.accent ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) =>
        props.accent ? "var(--accent)" : "var(--primary-background)"};

    [data-card-kind="regular"] & {
        padding: 7px 10px;
        border: 1px solid
            color-mix(in srgb, var(--foreground) 8%, transparent);
        border-radius: 8px;
        background: color-mix(
            in srgb,
            var(--primary-background) 86%,
            transparent
        );
    }
`;


const MoreChip = styled.button`
    display: inline-flex;
    align-items: center;
    padding: 5px 9px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
    line-height: 1;

    &:hover {
        background: color-mix(in srgb, var(--accent) 18%, transparent);
    }
`;

interface PromoCardProps {
    promo: Promo;
    onOpenImage: (images: string[], startIndex?: number) => void;
    onCompare?: (key: string) => void;
    lastVisit: number | null;
    featured?: boolean;
    searchQuery?: string;
    featuredReason?: {
        label: string;
        subLabel?: string;
        color: string;
        bg: string;
    } | null;
}



// Long promos can list a dozen-plus priced variants. Rather than show the
// whole table up front, we collapse to one chip per distinct compound and
// reveal the full pricing on demand so cards stay scannable. Small promos
// (few line items) skip the chip summary and show the table directly.
const COLLAPSE_THRESHOLD = 5;
const FEATURED_COLLAPSE_THRESHOLD = 4;

const ProductSummary = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const CompoundChips = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;

const CompoundChip = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    padding: 7px 10px;
    border-radius: 7px;
    color: var(--foreground);
    /* The merchandise floats; logistics recess. */
    background: var(--promo-chip);

    .count {
        font-size: 11px;
        font-weight: 600;
        color: var(--tertiary-foreground);
    }
`;

const ItemToggle = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 9px 12px;
    border: none;
    border-top: 1px solid var(--promo-chip);
    background: var(--promo-well);
    color: var(--channel-active);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        background: var(--promo-card);
    }

    svg {
        transition: transform 0.15s ease;
    }

    &[data-expanded="true"] svg {
        transform: rotate(180deg);
    }
`;

// Standalone (not table-attached) variant of the toggle, used under the
// compound-chip summary.
const SummaryToggle = styled.button`
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: none;
    background: none;
    color: var(--channel-active);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        text-decoration: underline;
    }
`;

const MetaRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    [data-card-kind="regular"] & {
        gap: 8px;
    }
`;

const NoteText = styled.div`
    font-size: 13px;
    color: var(--secondary-foreground);
    line-height: 1.4;
`;

const NoteBlock = styled.div`
    margin-top: 6px;
    padding: 8px 10px;
    border-left: 3px solid var(--accent);
    background: var(--promo-well, rgba(0, 0, 0, 0.12));
    border-radius: 0 6px 6px 0;
    font-size: 13px;
    color: var(--secondary-foreground);
    line-height: 1.5;

    [data-card-kind="regular"] & {
        padding: 12px 14px;
        border: 1px solid
            color-mix(in srgb, var(--foreground) 8%, transparent);
        border-left: 3px solid var(--accent);
        border-radius: 10px;
        background: color-mix(
            in srgb,
            var(--promo-well) 88%,
            transparent
        );
    }
`;

const NoteBulletList = styled.ul`
    margin: 4px 0 0 0;
    padding-left: 18px;
    font-size: 13px;
    color: var(--secondary-foreground);
    line-height: 1.6;

    li {
        margin-bottom: 2px;
    }
`;

const ReadMoreLink = styled.span`
    display: inline-block;
    margin-top: 4px;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
    font-weight: 600;
    user-select: none;

    &:hover {
        text-decoration: underline;
    }
`;

const Gallery = styled.div`
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: 8px;
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
    flex-shrink: 0;
    background: var(--promo-well);

    .hero {
        width: 100%;
        max-width: 100%;
        height: 100%;
        object-fit: cover;
        background: var(--promo-well);
        display: block;
        box-sizing: border-box;
    }

    &[role="button"] {
        cursor: zoom-in;
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }

    .photo-count {
        position: absolute;
        right: 8px;
        bottom: 8px;
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 10px;
        background: color-mix(
            in srgb,
            var(--primary-background) 78%,
            transparent
        );
        color: var(--foreground);
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        pointer-events: none;
        z-index: 1;
    }

    @media (max-width: 720px) {
        aspect-ratio: 16 / 9;
    }
`;

const MediaPlaceholder = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 48px;
    padding: 10px 12px;
    box-sizing: border-box;
    border: 1px dashed
        color-mix(in srgb, var(--foreground) 12%, transparent);
    border-radius: 8px;
    background: var(--promo-well);
    color: var(--tertiary-foreground);
    font-size: 11px;
    text-align: center;
    flex-shrink: 0;

    svg {
        opacity: 0.72;
    }

    [data-card-kind="regular"] & {
        min-height: 180px;
        flex-direction: column;
        gap: 12px;
        border-radius: 12px;
        font-size: 13px;

        svg {
            width: 34px;
            height: 34px;
        }
    }

    @media (min-width: 1200px) {
        [data-card-kind="regular"] & {
            min-height: 210px;
        }
    }
`;

/* Hallmark · component: promo status footer · genre: modern-minimal
 * theme: studied-DNA (source: user reference image) · structure: divided utility row
 * studied: yes · icon=16px · label=13px · priority=ending-soon > updated > active
 */
const CardFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 42px;
    padding: 8px 0 0;
    box-sizing: border-box;
    width: 100%;
    border-top: 1px solid
        color-mix(in srgb, var(--foreground) 13%, transparent);
    /* Always pushed to the bottom of the flex card */
    margin-top: auto;
    gap: 6px;
    flex-shrink: 0;

    @media (max-width: 480px) {
        /* Allow wrap so countdown + buttons never overflow the card edge */
        flex-wrap: wrap;
        gap: 4px;
    }
`;

type CardFooterStatusType = "endingSoon" | "updated" | "active";

const FooterStatus = styled.span<{ $type: CardFooterStatusType }>`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 32px;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 500;
    color: ${({ $type }) =>
        $type === "endingSoon"
            ? "var(--promo-status-danger)"
            : $type === "active"
                ? "var(--promo-status-success)"
                : "var(--secondary-foreground)"};

    svg {
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
        color: ${({ $type }) =>
            $type === "endingSoon"
                ? "var(--promo-status-danger)"
                : "var(--promo-status-success)"};
    }
`;

const SuggestionChipBtn = styled.button`
    display: inline-flex;
    align-items: center;
    padding: 5px 12px;
    border-radius: 99px;
    border: 1px solid var(--promo-chip);
    background: var(--promo-well);
    color: var(--foreground);
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;

    &:hover {
        background: var(--promo-chip);
        border-color: var(--accent);
        color: var(--accent);
    }
`;

const Empty = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 20px 56px;
    gap: 10px;

    h3 {
        font-size: 18px;
        font-weight: 700;
        color: var(--foreground);
        margin: 0;
    }

    p {
        max-width: 380px;
        font-size: 14px;
        color: var(--secondary-foreground);
        margin: 0;
        line-height: 1.5;
    }

    .cta {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
    }

    @media (max-width: 720px) {
        /* Safe-area: clear home bar on iOS */
        padding: 32px 16px max(48px, env(safe-area-inset-bottom, 48px));
    }
`;

const Glyph = styled.div`
    position: relative;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tertiary-foreground);
    margin-bottom: 4px;

    .float {
        position: absolute;
        font-size: 11px;
        font-weight: 700;
        color: var(--accent);
        background: var(--promo-chip);
        padding: 2px 5px;
        border-radius: 5px;
        white-space: nowrap;

        &.a { top: 0; right: -4px; }
        &.b { bottom: 0; left: -4px; }
    }
`;

const ActiveFilterSummaryRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;

    .summary-title {
        font-size: 11px;
        font-weight: 600;
        color: var(--tertiary-foreground);
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }
`;

const SummaryTag = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--accent);
    border-radius: 99px;
    background: transparent;
    color: var(--accent);
    font-size: 12px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
        background: var(--accent);
        color: #fff;
    }
`;

const SuggestionChipGrid = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 10px;
`;



interface CardFooterStatusValue {
    type: CardFooterStatusType;
    label: string;
}

function CardFooterStatus({ status }: { status: CardFooterStatusValue }) {
    const StatusIcon =
        status.type === "endingSoon"
            ? Time
            : status.type === "updated"
                ? Refresh
                : CheckCircle;

    return (
        <FooterStatus $type={status.type} aria-label={status.label}>
            <StatusIcon aria-hidden="true" />
            <span>{status.label}</span>
        </FooterStatus>
    );
}

function getCardFooterStatus(promo: Promo): CardFooterStatusValue {
    // Priority 1: Ending Soon (most urgent → red)
    if (promo.endDate) {
        const remainingMs = new Date(promo.endDate).getTime() - Date.now();
        if (remainingMs > 0 && remainingMs <= 72 * 60 * 60 * 1000) {
            return {
                type: "endingSoon",
                label: `Ends in ${formatCountdown(promo.endDate)}`,
            };
        }
    }
    // Priority 2: Recently updated (green — signal of freshness)
    if (promo.updatedAt) {
        const updatedMs = new Date(promo.updatedAt).getTime();
        const createdMs = new Date(promo.createdAt).getTime();
        const isFreshUpdate =
            updatedMs - createdMs > 60_000 &&
            Date.now() - updatedMs < 7 * 24 * 60 * 60 * 1000;
        if (isFreshUpdate) {
            return {
                type: "updated",
                label: formatLastUpdated(promo.updatedAt),
            };
        }
    }
    // Priority 3: Default active (green)
    return {
        type: "active",
        label: "Active",
    };
}

const PromoCard = observer(
    ({
        promo,
        onOpenImage,
        onCompare,
        lastVisit,
        featured,
        searchQuery = "",
        featuredReason,
    }: PromoCardProps) => {
        const client = useClient();
        const [expanded, setExpanded] = useState(false);
        const [notesExpanded, setNotesExpanded] = useState(false);
        const [logoFailed, setLogoFailed] = useState(false);
        const [heroImageFailed, setHeroImageFailed] = useState(false);
        const autumn =
            client.configuration?.features.autumn?.url ||
            "https://peptide.chat/autumn";

        const resolveImage = (ref: string) => {
            if (!ref) return "";
            if (isUrl(ref)) return ref;
            if (ref.startsWith("/")) return ref;
            return `${autumn}/attachments/${ref}`;
        };
        const galleryImages = (promo.images ?? [])
            .filter(Boolean)
            .map(resolveImage);

        const logoUrl = promo.vendor.logo
            ? isUrl(promo.vendor.logo)
                ? promo.vendor.logo
                : promo.vendor.logo.startsWith("/")
                    ? promo.vendor.logo
                    : `${autumn}/icons/${promo.vendor.logo}?max_side=256`
            : null;

        const handleLogoError = (
            e: React.SyntheticEvent<HTMLImageElement, Event>,
        ) => {
            const img = e.currentTarget;
            if (
                !img.dataset.retried &&
                promo.vendor.logo &&
                !isUrl(promo.vendor.logo)
            ) {
                img.dataset.retried = "true";
                const fallbackAutumn = autumn.includes("peptide.chat")
                    ? "https://autumn.revolt.chat"
                    : "https://peptide.chat/autumn";
                img.src = `${fallbackAutumn}/icons/${promo.vendor.logo}?max_side=256`;
            } else {
                setLogoFailed(true);
            }
        };

        const handleImageError = (
            e: { currentTarget: HTMLImageElement },
            ref: string,
            onFinalFailure?: () => void,
        ) => {
            const img = e.currentTarget;
            if (!img.dataset.retried && ref && !isUrl(ref)) {
                img.dataset.retried = "true";
                const fallbackAutumn = autumn.includes("peptide.chat")
                    ? "https://autumn.revolt.chat"
                    : "https://peptide.chat/autumn";
                img.src = `${fallbackAutumn}/attachments/${ref}`;
            } else {
                img.style.display = "none";
                onFinalFailure?.();
            }
        };

        const joined = promo.vendor.serverId
            ? client.servers.get(promo.vendor.serverId)
            : undefined;
        const inviteCode = inviteCodeFromLink(promo.vendor.inviteLink);
        const linkTo = joined
            ? `/server/${promo.vendor.serverId}`
            : inviteCode
                ? `/invite/${inviteCode}`
                : null;

        const g = promo.guarantee;
        const when = timeline(promo);
        const badge = getPromoBadge(promo, lastVisit);
        const collapseAt = featured
            ? FEATURED_COLLAPSE_THRESHOLD
            : COLLAPSE_THRESHOLD;

        const CardEl = (featured ? FeaturedCard : Card) as any;

        // ── FEATURED (Hot Promos Today) — compact fixed-height card ─────────
        if (featured) {
            // Logistics: one compressed line of at most 3 tokens
            const logisticsTokens: string[] = [];
            if (typeof promo.shippingFee === "number" && promo.shippingFee === 0) {
                logisticsTokens.push("🚚 Free Shipping");
            } else if (typeof promo.freeShippingThreshold === "number") {
                logisticsTokens.push(`🚚 Free over ${money(promo.freeShippingThreshold)}`);
            } else if (typeof promo.shippingFee === "number") {
                logisticsTokens.push(`🚚 ${money(promo.shippingFee)}`);
            }
            if (g?.customsReship) logisticsTokens.push("🛡 Customs Reship");
            if (g?.purityPct != null && g.purityPct >= 98) logisticsTokens.push(`${g.purityPct}% Purity`);

            // Short description from notes — 2-3 line clamp
            const descParts = [promo.discountNote, promo.shippingNote, promo.moqNote].filter(Boolean) as string[];
            const descText = descParts.join(" • ");

            // Hero image + extra count
            const heroSrc = galleryImages[0] ?? null;
            const hasHeroImage = !!heroSrc && !heroImageFailed;
            const extraPhotos = Math.max(0, galleryImages.length - 1);
            const compareKey = getComparableCompound(promo);

            // Badges: max 2, use new unified getCardBadges()
            const [primaryBadge, secondaryBadge] = getCardBadges(promo);

            const status = getCardFooterStatus(promo);

            return (
                <FeaturedCard
                    id={`promo-${promo.id}`}
                    data-vendor={promo.vendor.name}
                    data-featured="true"
                    data-card-kind="featured">
                    {/* Badge row — max 2 */}
                    {(primaryBadge || secondaryBadge) && (
                        <BadgeRow>
                            {primaryBadge && (
                                <FeaturedReasonBadge bg={primaryBadge.bg} textColor={primaryBadge.color}>
                                    {primaryBadge.label}
                                </FeaturedReasonBadge>
                            )}
                            {secondaryBadge && (
                                <FeaturedReasonBadge bg={secondaryBadge.bg} textColor={secondaryBadge.color}>
                                    {secondaryBadge.label}
                                </FeaturedReasonBadge>
                            )}
                        </BadgeRow>
                    )}

                    {/* Card Head: logo + vendor + warehouse */}
                    <CardHead>
                        {logoUrl && !logoFailed ? (
                            <Logo src={logoUrl} loading="lazy" onError={handleLogoError} />
                        ) : (
                            <VendorMonogram aria-label={`${promo.vendor.name} logo`}>
                                {promo.vendor.name ? getVendorInitials(promo.vendor.name) : <Store size={18} />}
                            </VendorMonogram>
                        )}
                        <VendorMeta>
                            <span className="vendor-name">{promo.vendor.name}</span>
                            {promo.warehouse && (
                                <span className="warehouse-row">
                                    <MapPin size={10} />
                                    {promo.warehouse}
                                </span>
                            )}
                        </VendorMeta>
                    </CardHead>

                    {/* Promotion Title */}
                    {promo.title && (
                        <PromoTitle style={{ fontSize: 13, lineHeight: 1.3, marginTop: 0 }}>
                            {promo.title}
                        </PromoTitle>
                    )}

                    {/* Logistics — one compressed line */}
                    {logisticsTokens.length > 0 && (
                        <FeaturedLogisticsLine>
                            {logisticsTokens.map((tok, i) => (
                                <span key={i}>
                                    {i > 0 && <span className="sep"> • </span>}
                                    {tok}
                                </span>
                            ))}
                        </FeaturedLogisticsLine>
                    )}

                    {/* Short 2-line summary: Primary Offer + 1 Supporting Detail */}
                    {(() => {
                        const summary = extractPromoSummary(promo);
                        return (
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                                <div style={{ fontWeight: 700, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {summary.primaryOffer}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--secondary-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {summary.supportingDetail}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Images keep a fixed frame; no-image cards reclaim that space. */}
                    {hasHeroImage ? (
                        <FeaturedImageWrap
                            role="button"
                            tabIndex={0}
                            aria-label={`Open all ${galleryImages.length} promotion photos`}
                            onClick={() => onOpenImage(galleryImages)}
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                ) {
                                    event.preventDefault();
                                    onOpenImage(galleryImages);
                                }
                            }}>
                            <img
                                src={heroSrc}
                                alt={`${promo.vendor.name} promotion`}
                                loading="lazy"
                                onError={(e) =>
                                    handleImageError(
                                        e as any,
                                        promo.images![0],
                                        () => setHeroImageFailed(true),
                                    )
                                }
                            />
                            {extraPhotos > 0 && (
                                <span className="photo-count">
                                    +{extraPhotos} Photos
                                </span>
                            )}
                        </FeaturedImageWrap>
                    ) : (
                        <MediaPlaceholder>
                            <Store size={20} aria-hidden="true" />
                            <span>No promotion image</span>
                        </MediaPlaceholder>
                    )}

                    {/* Footer — always at bottom */}
                    <CardFooter>
                        <CardFooterStatus status={status} />
                        {compareKey && onCompare && (
                            <CompareActionLink
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCompare(compareKey);
                                }}>
                                Compare Vendors
                            </CompareActionLink>
                        )}
                    </CardFooter>
                </FeaturedCard>
            );
        }

        // ── REGULAR CARD (All Promotions) — full detail layout ───────────────

        return (
            <CardEl
                id={`promo-${promo.id}`}
                data-vendor={promo.vendor.name}
                data-featured={featured ? "true" : undefined}
                data-card-kind="regular">
                {/* Card Badge — aligned left with breathing room */}
                {(() => {
                    const [primary, secondary] = getCardBadges(promo);
                    if (!primary && !secondary) return null;
                    return (
                        <BadgeRow>
                            {primary && (
                                <CardBadgeTag bg={primary.bg} textColor={primary.color}>
                                    {primary.label}
                                </CardBadgeTag>
                            )}
                            {secondary && (
                                <CardBadgeTag bg={secondary.bg} textColor={secondary.color}>
                                    {secondary.label}
                                </CardBadgeTag>
                            )}
                        </BadgeRow>
                    );
                })()}

                {/* Card Head: logo + vendor + warehouse + action icon */}
                <CardHead>
                    {logoUrl && !logoFailed ? (
                        <Logo
                            src={logoUrl}
                            loading="lazy"
                            onError={handleLogoError}
                        />
                    ) : (
                        <VendorMonogram
                            aria-label={`${promo.vendor.name} logo`}>
                            {promo.vendor.name ? (
                                getVendorInitials(promo.vendor.name)
                            ) : (
                                <Store size={20} />
                            )}
                        </VendorMonogram>
                    )}
                    <VendorMeta>
                        <span className="vendor-name">
                            {highlightText(promo.vendor.name, searchQuery)}
                        </span>
                        {promo.warehouse && (
                            <span className="warehouse-row">
                                <MapPin size={11} />
                                {highlightText(promo.warehouse, searchQuery)}
                            </span>
                        )}
                    </VendorMeta>
                    {linkTo && (
                        <ActionIcon
                            as={Link}
                            to={linkTo}
                            title={
                                joined ? "Open community" : "Join community"
                            }>
                            {joined ? (
                                <ChevronRight size={18} />
                            ) : (
                                <Plus size={18} />
                            )}
                        </ActionIcon>
                    )}
                </CardHead>

                {/* Promotion Title */}
                {promo.title && (
                    <PromoTitle>
                        {highlightText(promo.title, searchQuery)}
                    </PromoTitle>
                )}

                {/* Lead Price — most prominent visual anchor */}
                {promo.items.length > 0 &&
                    (() => {
                        const prices = promo.items
                            .map((it) => it.price)
                            .filter(
                                (p): p is number =>
                                    typeof p === "number" && isFinite(p),
                            );
                        if (prices.length === 0) return null;
                        const minPrice = Math.min(...prices);
                        const hasMultiple = promo.items.length > 1;
                        return (
                            <PriceHighlight>
                                <PriceValue>{money(minPrice)}</PriceValue>
                                {hasMultiple && (
                                    <PriceLabel>starting price</PriceLabel>
                                )}
                                {!hasMultiple && promo.items[0].unit && (
                                    <PriceLabel>
                                        / {promo.items[0].unit}
                                    </PriceLabel>
                                )}
                            </PriceHighlight>
                        );
                    })()}

                {/* Products */}
                {promo.items.length > 0 &&
                    (() => {
                        const compounds: { name: string; count: number }[] = [];
                        const index = new Map<string, number>();
                        for (const it of promo.items) {
                            const name = it.product;
                            const at = index.get(name);
                            if (at === undefined) {
                                index.set(name, compounds.length);
                                compounds.push({ name, count: 1 });
                            } else {
                                compounds[at].count++;
                            }
                        }

                        const collapsible = promo.items.length > collapseAt;

                        if (collapsible && !expanded) {
                            const CHIP_LIMIT = 3;
                            const visibleCompounds = compounds.slice(
                                0,
                                CHIP_LIMIT,
                            );
                            const hiddenCount = compounds.length - CHIP_LIMIT;
                            return (
                                <ProductSummary>
                                    <CompoundChips>
                                        {visibleCompounds.map((c) => {
                                            const isMatched =
                                                searchQuery &&
                                                c.name
                                                    .toLowerCase()
                                                    .includes(
                                                        searchQuery.toLowerCase(),
                                                    );
                                            return (
                                                <CompoundChip
                                                    key={c.name}
                                                    highlighted={!!isMatched}>
                                                    {highlightText(
                                                        c.name,
                                                        searchQuery,
                                                    )}
                                                    {c.count > 1 && (
                                                        <span className="count">
                                                            ×{c.count}
                                                        </span>
                                                    )}
                                                </CompoundChip>
                                            );
                                        })}
                                        {hiddenCount > 0 && (
                                            <MoreChip
                                                onClick={() =>
                                                    setExpanded(true)
                                                }>
                                                +{hiddenCount} more
                                            </MoreChip>
                                        )}
                                    </CompoundChips>
                                </ProductSummary>
                            );
                        }

                        return (
                            <ItemTable>
                                {promo.items.map((it, i) => {
                                    const moq =
                                        it.moqKits || it.moqTotal
                                            ? `MOQ ${[
                                                it.moqKits
                                                    ? `${it.moqKits} kits`
                                                    : null,
                                                it.moqTotal
                                                    ? money(it.moqTotal)
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(" / ")}`
                                            : null;
                                    return (
                                        <div key={i}>
                                            <ItemRow>
                                                <span className="product">
                                                    {highlightText(
                                                        it.product,
                                                        searchQuery,
                                                    )}
                                                </span>
                                                {it.dosage && (
                                                    <span className="dosage">
                                                        {highlightText(
                                                            it.dosage,
                                                            searchQuery,
                                                        )}
                                                    </span>
                                                )}
                                                {moq && (
                                                    <span className="moq">
                                                        {moq}
                                                    </span>
                                                )}
                                                <span className="price">
                                                    {money(it.price)}
                                                    <span className="unit">
                                                        {" "}
                                                        / {it.unit || "kit"}
                                                    </span>
                                                </span>
                                            </ItemRow>
                                            {it.note && (
                                                <ItemNote>
                                                    {highlightText(
                                                        it.note,
                                                        searchQuery,
                                                    )}
                                                </ItemNote>
                                            )}
                                        </div>
                                    );
                                })}
                                {collapsible && (
                                    <ItemToggle
                                        data-expanded={true}
                                        onClick={() => setExpanded(false)}>
                                        Show less
                                        <ChevronDown size={14} />
                                    </ItemToggle>
                                )}
                            </ItemTable>
                        );
                    })()}

                {/* Highlights row — strict max 2-3 strongest benefits */}
                <MetaRow>
                    {(() => {
                        const chips: JSX.Element[] = [];

                        // 1. Merged Shipping Chip
                        if (
                            typeof promo.shippingFee === "number" &&
                            promo.shippingFee === 0
                        ) {
                            chips.push(
                                <Chip key="ship">💙 Free Shipping</Chip>,
                            );
                        } else if (
                            typeof promo.shippingFee === "number" &&
                            typeof promo.freeShippingThreshold === "number"
                        ) {
                            chips.push(
                                <Chip key="ship">
                                    🚚 Shipping {money(promo.shippingFee)} •
                                    Free over{" "}
                                    {money(promo.freeShippingThreshold)}
                                </Chip>,
                            );
                        } else if (typeof promo.shippingFee === "number") {
                            chips.push(
                                <Chip key="ship">
                                    🚚 Shipping {money(promo.shippingFee)}
                                </Chip>,
                            );
                        } else if (
                            typeof promo.freeShippingThreshold === "number"
                        ) {
                            chips.push(
                                <Chip key="ship">
                                    🚚 Free over{" "}
                                    {money(promo.freeShippingThreshold)}
                                </Chip>,
                            );
                        }

                        // 2. Customs Reship
                        if (g?.customsReship) {
                            chips.push(
                                <Chip key="reship">
                                    <BadgeCheck size={11} />
                                    Customs Reship
                                </Chip>,
                            );
                        }

                        // 3. 99% Purity
                        if (g?.purityPct != null && g.purityPct >= 98) {
                            chips.push(
                                <Chip key="purity">
                                    <BadgeCheck size={11} />
                                    {g.purityPct}% Purity
                                </Chip>,
                            );
                        }

                        // 4. Sourcing Chip (suppress if location is in header)
                        const headerWh = (promo.warehouse || "").toLowerCase();
                        const hasCnHeader =
                            headerWh.includes("cn") ||
                            headerWh.includes("china");
                        if (
                            !hasCnHeader &&
                            promo.warehouse?.toLowerCase().match(/\bcn\b|china/)
                        ) {
                            chips.push(
                                <Chip key="china">🇨🇳 China Direct</Chip>,
                            );
                        }

                        // STRICT LIMIT: Max 2-3 highlights per card
                        return chips.slice(0, 3);
                    })()}
                </MetaRow>

                {/* Notes & Description block: 2-line clamped summary -> expands to structured bullets */}
                {(promo.discountNote ||
                    promo.shippingNote ||
                    promo.moqNote ||
                    g?.text) &&
                    (() => {
                        const rawTexts = [
                            promo.discountNote,
                            promo.shippingNote,
                            promo.moqNote,
                            g?.text,
                        ].filter(Boolean) as string[];

                        const parseNoteBullets = () => {
                            const points: string[] = [];
                            for (const text of rawTexts) {
                                const parts = text
                                    .split(/[,;\n]+|(?<=\w)\.\s+/)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                for (const pt of parts) {
                                    points.push(pt);
                                }
                            }
                            return points;
                        };

                        const bullets = parseNoteBullets();

                        return (
                            <NoteBlock>
                                {!notesExpanded ? (
                                    <>
                                        {(() => {
                                            const summary = extractPromoSummary(promo);
                                            return (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                    <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 12 }}>
                                                        {summary.primaryOffer}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: "var(--secondary-foreground)" }}>
                                                        {summary.supportingDetail}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        <ReadMoreLink
                                            onClick={() =>
                                                setNotesExpanded(true)
                                            }>
                                            View Details →
                                        </ReadMoreLink>
                                    </>
                                ) : (
                                    <>
                                        <NoteBulletList>
                                            {bullets.map((pt, i) => (
                                                <li key={i}>
                                                    {highlightText(
                                                        pt,
                                                        searchQuery,
                                                    )}
                                                </li>
                                            ))}
                                        </NoteBulletList>
                                        <ReadMoreLink
                                            onClick={() =>
                                                setNotesExpanded(false)
                                            }>
                                            Show less
                                        </ReadMoreLink>
                                    </>
                                )}
                            </NoteBlock>
                        );
                    })()}

                {/* Images keep a fixed frame; no-image cards use a compact row. */}
                {galleryImages.length > 0 && !heroImageFailed ? (
                    <Gallery
                        role="button"
                        tabIndex={0}
                        aria-label={`Open all ${galleryImages.length} promotion photos`}
                        onClick={() => onOpenImage(galleryImages)}
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" ||
                                event.key === " "
                            ) {
                                event.preventDefault();
                                onOpenImage(galleryImages);
                            }
                        }}>
                        <img
                            className="hero"
                            src={galleryImages[0]}
                            alt={`${promo.vendor.name} promotion`}
                            loading="lazy"
                            onError={(e) =>
                                handleImageError(
                                    e,
                                    promo.images![0],
                                    () => setHeroImageFailed(true),
                                )
                            }
                        />
                        {galleryImages.length > 1 && (
                            <span className="photo-count">
                                +{galleryImages.length - 1} Photos
                            </span>
                        )}
                    </Gallery>
                ) : (
                    <MediaPlaceholder>
                        <Store size={20} aria-hidden="true" />
                        <span>No promotion image</span>
                    </MediaPlaceholder>
                )}

                {/* Footer: Single status priority (left) vs Compare Vendors action (right) */}
                <CardFooter>
                    {(() => {
                        const status = getCardFooterStatus(promo);
                        return <CardFooterStatus status={status} />;
                    })()}
                    {(() => {
                        const compKey = getComparableCompound(promo);
                        if (!compKey || !onCompare) return null;
                        return (
                            <CompareActionLink
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCompare(compKey);
                                }}>
                                Compare Vendors
                            </CompareActionLink>
                        );
                    })()}
                </CardFooter>
            </CardEl>
        );
    },
);

// Sparkline removed per spec #6 — replaced by vendor avatar stack and community metrics

// Static initials for the vendor avatar stack in trending cards
const TRENDING_AVATAR_SETS: Record<string, string[]> = {
    reta: ["PL", "AA", "KBR", "SC"],
    tirz: ["RC", "AMS", "SC"],
    sema: ["AMS", "AA", "RC"],
    ghkcu: ["SC", "UL"],
    default: ["WP", "SP", "AP"],
};

function TrendingPeptides({
    products,
    onSelectProduct,
    onOpenCompare,
}: {
    products: Array<{ key: string; name: string; minPrice: number; promoCount: number; vendorCount?: number }>;
    onSelectProduct: (key: string) => void;
    onOpenCompare: (key: string) => void;
}) {
    if (!products || products.length === 0) return null;

    return (
        <TrendingSection>
            <SectionHeader>
                <SectionTitleBlock>
                    <SectionTitle>🔥 Trending Peptides</SectionTitle>
                    <SectionSubtitle>Top compounds this week</SectionSubtitle>
                </SectionTitleBlock>
                <SectionViewAll
                    onClick={() => {
                        const compound = products[0]?.key || "retatrutide";
                        onSelectProduct(compound);
                        onOpenCompare(compound);
                    }}>
                    View all →
                </SectionViewAll>
            </SectionHeader>
            <TrendingRail
                data-carousel="horizontal"
                onTouchStart={(e: any) => e.stopPropagation()}
                onTouchMove={(e: any) => e.stopPropagation()}>
                {products.slice(0, 6).map((p) => {
                    const vendorCount = p.vendorCount || Math.max(4, p.promoCount + 2);
                    const avatars = TRENDING_AVATAR_SETS[p.key] || TRENDING_AVATAR_SETS.default;
                    const overflowCount = Math.max(0, vendorCount - avatars.length);
                    return (
                        <TrendingCard
                            key={p.key}
                            onClick={() => {
                                onSelectProduct(p.key);
                                onOpenCompare(p.key);
                            }}>

                            {/* Title row */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                                <TrendingTitle>
                                    <strong>{p.name}</strong>
                                </TrendingTitle>
                                <span style={{ fontSize: 10, color: "var(--tertiary-foreground)", whiteSpace: "nowrap", flexShrink: 0, marginTop: 1 }}>
                                    {p.promoCount} active promos
                                </span>
                            </div>

                            {/* Pricing */}
                            <TrendingMeta>
                                <span style={{ fontSize: 12, fontWeight: 500 }}>
                                    Starting at{" "}
                                    <strong style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, color: "var(--foreground)" }}>
                                        ${p.minPrice}
                                    </strong>
                                    {" "}/ kit
                                </span>
                            </TrendingMeta>

                            {/* Avatar stack + vendor count */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                <VendorAvatarStack>
                                    {avatars.map((initials) => (
                                        <span key={initials} style={{ fontSize: 8 }}>{initials}</span>
                                    ))}
                                    {overflowCount > 0 && (
                                        <span className="more">+{overflowCount}</span>
                                    )}
                                </VendorAvatarStack>
                                <span style={{ fontSize: 11, color: "var(--tertiary-foreground)" }}>
                                    {vendorCount} vendors
                                </span>
                            </div>

                            {/* Compare CTA */}
                            <TrendingCompareBtn
                                as="div"
                                style={{ fontSize: 11, fontWeight: 700, marginTop: 6 }}>
                                Compare Vendors →
                            </TrendingCompareBtn>
                        </TrendingCard>
                    );
                })}
            </TrendingRail>
        </TrendingSection>
    );
}

// ─── Compare Drawer ───────────────────────────────────────────────────────────

function ComparisonDrawer({
    productName,
    vendors,
    onClose,
    onScrollToPromo,
    onApplyFilter,
    onShowToast,
}: {
    productName: string | null;
    vendors: Array<{
        id: string;
        name: string;
        logo?: string;
        minPrice: number | null;
        priceUnit?: string;
        priceFormatted?: string;
        discount?: string;
        badge?: string;
        badgeTone?: string;
        flag?: string;
        warehouse: string;
        shipping?: string;
        purity?: string;
        customs?: string;
        promoId?: string;
        serverId?: string | null;
        inviteLink?: string | null;
        communityUrl?: string;
    }>;
    onClose: () => void;
    onScrollToPromo?: (vendorName: string, promoId?: string) => void;
    onApplyFilter?: (productKey: string) => void;
    onShowToast?: (msg: string) => void;
}) {
    const client = useClient();
    const history = useHistory();
    const [expandedId, setExpandedId] = useState<string | null>(
        vendors.length > 0 ? vendors[0].id : null,
    );
    const [sortOption, setSortOption] = useState<"lowest" | "value">("lowest");

    useEffect(() => {
        if (!productName) return;
        const isMobile = window.innerWidth <= 720;
        if (!isMobile) return;
        const scrollRoot = document.querySelector<HTMLElement>(
            "[data-home-scroll]",
        );
        const previousOverflow = scrollRoot?.style.overflowY;
        const previousBodyOverflow = document.body.style.overflow;

        if (scrollRoot) scrollRoot.style.overflowY = "hidden";
        else document.body.style.overflow = "hidden";

        return () => {
            if (scrollRoot) {
                scrollRoot.style.overflowY = previousOverflow || "";
            } else {
                document.body.style.overflow = previousBodyOverflow;
            }
        };
    }, [productName]);

    if (!productName) return null;

    // Sorting logic
    const sortedVendors = [...vendors].sort((a, b) => {
        const priceA = a.minPrice ?? Number.POSITIVE_INFINITY;
        const priceB = b.minPrice ?? Number.POSITIVE_INFINITY;
        if (sortOption === "lowest") return priceA - priceB;
        if (sortOption === "value") {
            const discountDifference = Number(!!b.discount) - Number(!!a.discount);
            return discountDifference || priceA - priceB;
        }
        return 0;
    });

    // Dynamic Rank Labels (Lowest Price = absolute min price, Best Value = discounted non-cheapest)
    const comparablePrices = vendors
        .map((vendor) => vendor.minPrice)
        .filter((price): price is number => price != null);
    const minPriceVal = comparablePrices.length > 0
        ? Math.min(...comparablePrices)
        : null;
    const nonLowestDiscounted = vendors
        .filter(
            (vendor) =>
                vendor.minPrice != null &&
                minPriceVal != null &&
                vendor.minPrice > minPriceVal &&
                !!vendor.discount,
        )
        .sort((a, b) => a.minPrice! - b.minPrice!);

    function getRankLabel(v: typeof vendors[0]): string | null {
        if (minPriceVal != null && v.minPrice === minPriceVal) return "🥇 Lowest Price";
        if (nonLowestDiscounted.length > 0 && nonLowestDiscounted[0].id === v.id) return "⭐ Best Value";
        if ((v as any).communityFavorite) return "❤️ Community Favorite";
        return null;
    }

    return (
        <>
            <CompareBackdrop onClick={onClose} aria-label="Close compare drawer" />
            <CompareDrawerContainer>
                <SheetHandle aria-hidden="true" />
                <DrawerHeader>
                    <div className="drawer-title-group">
                        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Compare</h3>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginTop: 2 }}>
                            {productName}{" "}
                            <span style={{ fontSize: 11, color: "var(--tertiary-foreground)", fontWeight: 400 }}>
                                • {vendors.length} vendors found
                            </span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Close drawer">
                        <X size={16} />
                    </button>
                </DrawerHeader>

                {/* Contextual Banner */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "var(--promo-well, rgba(139, 92, 246, 0.1))",
                    border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                    fontSize: 12,
                    margin: "2px 0 6px 0",
                }}>
                    <span style={{ color: "var(--foreground)", fontSize: 11 }}>
                        Viewing vendor comparison for <strong>{productName}</strong>
                    </span>
                    {onApplyFilter && vendors.length > 0 && (
                        <button
                            style={{
                                background: "var(--accent)",
                                color: "var(--accent-contrast, #fff)",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                            onClick={() => {
                                onApplyFilter(productName.toLowerCase());
                                onClose();
                            }}>
                            Show Matching Promotions
                        </button>
                    )}
                </div>

                {/* Sort row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                    <span style={{ fontSize: 11, color: "var(--tertiary-foreground)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                        Sort by:
                    </span>
                    <select
                        value={sortOption}
                        onChange={(e) => setSortOption((e.target as HTMLSelectElement).value as any)}
                        style={{
                            background: "var(--primary-background)",
                            color: "var(--foreground)",
                            border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontFamily: "inherit",
                            outline: "none",
                            cursor: "pointer",
                        }}>
                        <option value="lowest">Lowest Price</option>
                        <option value="value">Best Value</option>
                    </select>
                </div>

                {/* Vendor List or Empty State */}
                {vendors.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center" }}>
                        <h4 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700 }}>
                            No current promotions found for {productName}
                        </h4>
                        <p style={{ fontSize: 12, color: "var(--tertiary-foreground)", margin: "0 0 16px 0" }}>
                            The comparison drawer only shows vendors backed by active promotion data.
                        </p>
                    </div>
                ) : (
                    <VendorCompareList>
                        {sortedVendors.map((v) => {
                            const isExpanded = expandedId === v.id;
                            const rankLabel = getRankLabel(v);
                            const allServers = Array.from(client.servers.values());
                            const isMember = (v.serverId && client.servers.has(v.serverId)) ||
                                (v.name && allServers.some((s) => s.name?.toLowerCase().includes(v.name.toLowerCase())));

                            return (
                                <VendorCompareCard key={v.id} expanded={isExpanded}>
                                    <div
                                        className="vendor-card-header"
                                        onClick={() =>
                                            setExpandedId(isExpanded ? null : v.id)
                                        }>
                                        <VendorMonogram style={{ width: 28, height: 28, fontSize: 10, borderRadius: "50%", background: "var(--secondary-background)", flexShrink: 0 }}>
                                            {getVendorInitials(v.name)}
                                        </VendorMonogram>
                                        <div className="vendor-info">
                                            <strong>{v.name}</strong>
                                            <span>{v.flag || "🇺🇸"} {v.warehouse}</span>
                                        </div>

                                        <div className="vendor-price">
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                                                {v.minPrice != null ? money(v.minPrice) : "Price unavailable"}
                                            </div>
                                            {v.priceUnit && (
                                                <div style={{ fontSize: 10, color: "var(--tertiary-foreground)" }}>
                                                    / {v.priceUnit}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status Badge */}
                                        <span className="vendor-status">
                                            ✓ Active Promo
                                        </span>

                                        <ChevronDown size={13} style={{
                                            transform: isExpanded ? "rotate(180deg)" : "none",
                                            transition: "transform 0.15s ease",
                                            flexShrink: 0,
                                            color: "var(--tertiary-foreground)",
                                        }} />
                                    </div>

                                    {/* Recommendation Label */}
                                    {rankLabel && !isExpanded && (
                                        <div style={{
                                            padding: "0 12px 8px",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "var(--tertiary-foreground)",
                                            letterSpacing: 0.3,
                                        }}>
                                            {rankLabel}
                                        </div>
                                    )}

                                    {isExpanded && (
                                        <div className="vendor-card-body">
                                            {rankLabel && (
                                                <div style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: "var(--accent)",
                                                    marginBottom: 4,
                                                }}>
                                                    {rankLabel}
                                                </div>
                                            )}
                                            <div className="specs-grid">
                                                <div className="spec-item">
                                                    <span>{v.priceUnit ? `Price / ${v.priceUnit}` : "Price"}</span>
                                                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                                                        {v.minPrice != null ? money(v.minPrice) : "Unavailable"}
                                                    </strong>
                                                </div>
                                                {v.discount && (
                                                    <div className="spec-item">
                                                        <span>Discount</span>
                                                        <strong>{v.discount}</strong>
                                                    </div>
                                                )}
                                                {v.shipping && (
                                                    <div className="spec-item">
                                                        <span>Shipping</span>
                                                        <strong>{v.shipping}</strong>
                                                    </div>
                                                )}
                                                {v.customs && (
                                                    <div className="spec-item">
                                                        <span>Guarantees</span>
                                                        <strong>{v.customs}</strong>
                                                    </div>
                                                )}
                                                {v.purity && (
                                                    <div className="spec-item">
                                                        <span>Purity</span>
                                                        <strong>{v.purity}</strong>
                                                    </div>
                                                )}
                                                <div className="spec-item">
                                                    <span>Availability</span>
                                                    <strong style={{ color: "var(--status-online, #10b981)" }}>
                                                        Active promotion
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="action-row" style={{ marginTop: 10, display: "flex", gap: 8, width: "100%", boxSizing: "border-box" }}>
                                                <button
                                                    className="btn-primary"
                                                    style={{ minHeight: 38, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                                    onClick={() => {
                                                        onScrollToPromo?.(v.name, v.promoId);
                                                        onClose();
                                                    }}>
                                                    View Promo
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ minHeight: 38, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                                    onClick={async () => {
                                                        const allServers = Array.from(client.servers.values());
                                                        const vLower = (v.name || "").toLowerCase();
                                                        const matchedServer = allServers.find(
                                                            (s) =>
                                                                (v.serverId && s._id === v.serverId) ||
                                                                (s.name && s.name.toLowerCase().includes(vLower)),
                                                        );

                                                        if (matchedServer) {
                                                            onShowToast?.(`✅ Opened ${v.name} Community`);
                                                            history.push(`/server/${matchedServer._id}`);
                                                            onClose();
                                                            return;
                                                        }

                                                        const inviteCode = v.inviteLink ? inviteCodeFromLink(v.inviteLink) : null;
                                                        if (inviteCode) {
                                                            try {
                                                                const joinedServer = await client.joinInvite(inviteCode);
                                                                onShowToast?.(`✅ Joined ${v.name} Community`);
                                                                history.push(`/server/${joinedServer._id}`);
                                                                onClose();
                                                                return;
                                                            } catch {
                                                                onShowToast?.(`${v.name} community invite is no longer available.`);
                                                                return;
                                                            }
                                                        }

                                                        onShowToast?.(`${v.name} community is unavailable.`);
                                                    }}>
                                                    {isMember ? "Open Community" : "Join Community"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </VendorCompareCard>
                            );
                        })}
                    </VendorCompareList>
                )}
            </CompareDrawerContainer>
        </>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const Promos: React.FC = () => {
    const client = useClient();
    const [promos, setPromos] = useState<Promo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sort, setSort] = useState<Sort>("newest");
    const [query, setQuery] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [lightbox, setLightbox] = useState<{
        images: string[];
        initialIndex: number;
    } | null>(null);
    const openLightbox = useCallback(
        (images: string[], initialIndex = 0) =>
            setLightbox({ images, initialIndex }),
        [],
    );
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
    const [compareProduct, setCompareProduct] = useState<string | null>(null);
    const [dismissedMarketAlert, setDismissedMarketAlert] = useState(
        () => safeSessionStorage.get(MARKET_ALERT_DISMISSED_KEY) === "1",
    );
    const [showMarketUpdatesEmpty, setShowMarketUpdatesEmpty] = useState(false);
    const [toast, setToast] = useState<{ text: string; actionText?: string; onAction?: () => void } | null>(null);

    const showToast = useCallback((msg: string, actionText?: string, onAction?: () => void) => {
        setToast({ text: msg, actionText, onAction });
        setTimeout(() => setToast(null), 4500);
    }, []);

    // Keep the previous visit stable for this render session. It is advanced only
    // after the user views the updates, not merely because the page loaded.
    const [lastVisit] = useState<number | null>(() => {
        const raw = safeStorage.get(LAST_VISIT_KEY);
        if (!raw) return null;
        const timestamp = Number.parseInt(raw, 10);
        return Number.isFinite(timestamp) ? timestamp : null;
    });
    const firstVisitBaselineRef = useRef(Date.now());
    const allPromosRef = useRef<HTMLDivElement>(null);
    const marketUpdatesEmptyRef = useRef<HTMLDivElement>(null);

    const handleClearFiltersAndScroll = useCallback((vendorName: string, promoId?: string) => {
        setActiveFilter("all");
        setQuery("");
        setToast(null);

        setTimeout(() => {
            allPromosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            setTimeout(() => {
                let el = promoId ? document.getElementById(`promo-${promoId}`) : null;
                if (!el && vendorName) {
                    const vLower = vendorName.toLowerCase();
                    const allCards = Array.from(document.querySelectorAll<HTMLElement>("[data-vendor]"));
                    el = allCards.find((c) => (c.getAttribute("data-vendor") || "").toLowerCase().includes(vLower)) || null;
                }
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.classList.add("promo-highlight");
                    setTimeout(() => el.classList.remove("promo-highlight"), 2000);
                }
            }, 100);
        }, 100);
    }, []);

    // Scroll to a specific promo card and briefly highlight it
    const scrollToPromo = useCallback((vendorName: string, promoId?: string) => {
        let target = promoId ? document.getElementById(`promo-${promoId}`) : null;
        if (!target && vendorName) {
            try {
                target = document.querySelector<HTMLElement>(`[data-vendor="${CSS.escape(vendorName)}"]`);
            } catch {
                /* ignore invalid selector */
            }
        }
        if (!target && vendorName) {
            const vLower = vendorName.toLowerCase();
            const allCards = Array.from(document.querySelectorAll<HTMLElement>("[data-vendor]"));
            target = allCards.find((c) => (c.getAttribute("data-vendor") || "").toLowerCase().includes(vLower)) || null;
        }
        if (!target) {
            const hasActiveFilters = activeFilter !== "all" || query.trim() !== "";
            if (hasActiveFilters) {
                showToast(
                    `ℹ️ Promotion for ${vendorName} is hidden by your current filters.`,
                    "Clear Filters & View",
                    () => handleClearFiltersAndScroll(vendorName, promoId)
                );
            } else {
                showToast(`ℹ️ Promotion for ${vendorName} could not be found.`);
            }
            return;
        }
        const el = target;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Wait for scroll to settle then flash the highlight
        setTimeout(() => {
            el.classList.add("promo-highlight");
            setTimeout(() => el.classList.remove("promo-highlight"), 2000);
        }, 350);
    }, [activeFilter, query, showToast, handleClearFiltersAndScroll]);

    // Hot Promos carousel — tracks current visible slide for pagination dots
    const hotCarouselRef = useRef<HTMLDivElement>(null);
    const [hotSlide, setHotSlide] = useState(0);

    // Establish a baseline for a first-time visitor. Existing visitors keep their
    // prior timestamp until they explicitly view the unseen updates.
    useEffect(() => {
        if (
            !loading &&
            promos.length > 0 &&
            lastVisit === null &&
            safeStorage.get(LAST_VISIT_KEY) === null
        ) {
            safeStorage.set(
                LAST_VISIT_KEY,
                String(firstVisitBaselineRef.current),
            );
        }
    }, [loading, promos.length, lastVisit]);

    // Hot Promos carousel scroll → update active dot
    useEffect(() => {
        const el = hotCarouselRef.current;
        if (!el) return;
        const handler = () => {
            const firstChild = el.firstElementChild as HTMLElement | null;
            const cardWidth = firstChild ? firstChild.offsetWidth : 0;
            const gap = 12;
            if (cardWidth > 0) {
                setHotSlide(Math.round(el.scrollLeft / (cardWidth + gap)));
            }
        };
        el.addEventListener("scroll", handler, { passive: true });
        return () => el.removeEventListener("scroll", handler);
    }, [promos.length]);

    const ownedServers = [...client.servers.values()].filter(
        (s) => s.owner === client.user?._id,
    );

    useEffect(() => {
        let cancelled = false;
        const key = CACHE_PREFIX + sort;
        let hadCache = false;
        let fresh = false;

        try {
            const raw = safeStorage.get(key);
            if (raw) {
                const parsed: PromoCache = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.data)) {
                    setPromos(parsed.data);
                    setLoading(false);
                    hadCache = true;
                    fresh = Date.now() - parsed.timestamp < CACHE_TTL;
                }
            }
        } catch {
            /* corrupt cache — ignore and refetch */
        }

        if (!fresh) {
            if (!hadCache) {
                setLoading(true);
                setError(null);
            }

            const sessionToken =
                typeof client.session === "string"
                    ? client.session
                    : (client.session as any)?.token ?? "";

            fetch(`${BACKEND_API_BASE}/promos?sort=${sort}&pageSize=100`, {
                headers: { "x-session-token": sessionToken },
            })
                .then((r) => r.json())
                .then((res) => {
                    if (cancelled) return;
                    if (!res?.success || !Array.isArray(res.data?.items)) {
                        throw new Error("Unexpected response");
                    }
                    const items = res.data.items as Promo[];
                    setPromos(items);
                    setLoading(false);
                    safeStorage.set(
                        key,
                        JSON.stringify({ timestamp: Date.now(), data: items }),
                    );
                })
                .catch(() => {
                    if (cancelled) return;
                    if (!hadCache) {
                        setError(
                            "Failed to load promos. Please try again later.",
                        );
                        setLoading(false);
                    }
                });
        }

        return () => {
            cancelled = true;
        };
    }, [sort]);

    // Unique promotions that became relevant since the previous acknowledged visit.
    const lastVisitStats = useMemo(() => {
        if (loading || promos.length === 0 || !lastVisit) return null;
        const now = Date.now();
        const matchingPromos = promos.filter((p) =>
            isMarketUpdate(p, lastVisit, now),
        );

        return {
            updateCount: matchingPromos.length,
        };
    }, [loading, promos, lastVisit]);

    // Quick Stats — snapshot of the current promo landscape with context
    const quickStats = useMemo(() => {
        if (loading || promos.length === 0) return null;
        const totalActive = promos.length;
        const uniqueVendors = new Set(promos.map((p) => p.vendor.name)).size;
        const endingSoon = promos.filter(isEndingSoon).length;
        const warehouseDeals = promos.filter((p) => p.warehouse != null).length;
        // Sub-context
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const addedThisWeek = promos.filter(
            (p) => Date.now() - new Date(p.createdAt).getTime() < sevenDays,
        ).length;
        const usVendors = new Set(
            promos
                .filter((p) =>
                    p.warehouse?.toLowerCase().match(/\bus\b|united.?states/),
                )
                .map((p) => p.vendor.name),
        ).size;
        const freeShippingCount = promos.filter(
            (p) => p.shippingFee === 0,
        ).length;
        return {
            totalActive,
            uniqueVendors,
            endingSoon,
            warehouseDeals,
            addedThisWeek,
            usVendors,
            freeShippingCount,
        };
    }, [loading, promos]);

    // Search input state (immediate feedback)
    const [inputValue, setInputValue] = useState(query);

    // Synced search state
    useEffect(() => {
        setInputValue(query);
    }, [query]);

    // Debounce typing input
    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery(inputValue);
        }, 250);
        return () => clearTimeout(timer);
    }, [inputValue]);

    // Recent Searches state
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [searchFocused, setSearchFocused] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const recentSearchesRef = useRef<HTMLDivElement>(null);

    // Load recent searches on mount
    useEffect(() => {
        const raw = safeStorage.get("recent_promo_searches");
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setRecentSearches(parsed.slice(0, 5));
                }
            } catch { }
        }
    }, []);

    // Helper to save searches
    const saveSearch = useCallback((searchTerm: string) => {
        const trimmed = searchTerm.trim();
        if (!trimmed) return;
        setRecentSearches((prev) => {
            const next = [
                trimmed,
                ...prev.filter(
                    (s) => s.toLowerCase() !== trimmed.toLowerCase(),
                ),
            ].slice(0, 5);
            safeStorage.set("recent_promo_searches", JSON.stringify(next));
            return next;
        });
    }, []);

    // Keyboard support: '/' to focus, 'Esc' to clear/blur
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isTyping =
                active &&
                (active.tagName === "INPUT" ||
                    active.tagName === "TEXTAREA" ||
                    active.tagName === "SELECT" ||
                    (active as HTMLElement).isContentEditable);

            if (e.key === "/" && !isTyping) {
                e.preventDefault();
                searchInputRef.current?.focus();
                setSearchFocused(true);
            }

            if (e.key === "Escape") {
                if (active === searchInputRef.current) {
                    if (inputValue) {
                        setInputValue("");
                        setQuery("");
                    } else {
                        searchInputRef.current?.blur();
                        setSearchFocused(false);
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [inputValue]);

    const scrollToAllPromos = () => {
        allPromosRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleDismissMarketAlert = () => {
        setDismissedMarketAlert(true);
        safeSessionStorage.set(MARKET_ALERT_DISMISSED_KEY, "1");
    };

    const handleViewAllUpdates = () => {
        const matchingPromos = promos.filter((promo) =>
            isMarketUpdate(promo, lastVisit),
        );

        if (matchingPromos.length === 0) {
            setShowMarketUpdatesEmpty(true);
            requestAnimationFrame(() => {
                marketUpdatesEmptyRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            });
            return;
        }

        setShowMarketUpdatesEmpty(false);
        setInputValue("");
        setQuery("");
        setSearchFocused(false);
        setActiveFilter("marketUpdates");
        setDismissedMarketAlert(true);
        safeSessionStorage.set(MARKET_ALERT_DISMISSED_KEY, "1");
        safeStorage.set(LAST_VISIT_KEY, String(Date.now()));

        requestAnimationFrame(() => {
            allPromosRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
            window.setTimeout(() => {
                const firstMatch = document.getElementById(
                    `promo-${matchingPromos[0].id}`,
                );
                firstMatch?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }, 150);
        });
    };

    // Filtered & Sorted promos based on activeFilter, query, and sort
    const filtered = useMemo(() => {
        let list = promos;
        if (activeFilter !== "all") {
            list = list.filter((p) =>
                matchesFilter(p, activeFilter, lastVisit),
            );
        }

        const q = normalizeSearchValue(query);
        const result = q
            ? list
                  .map((p) => ({ promo: p, score: getSearchScore(p, q) }))
                  .filter((item) => item.score > 0)
            : list.map((promo) => ({ promo, score: 0 }));

        const getMinPrice = (p: Promo): number => {
            const prices = (p.items ?? [])
                .map((it) => it.price)
                .filter(
                    (pr): pr is number =>
                        typeof pr === "number" && isFinite(pr),
                );
            return prices.length > 0 ? Math.min(...prices) : Infinity;
        };

        const compareSelectedSort = (a: Promo, b: Promo): number => {
            if (sort === "newest") {
                return (
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                );
            }
            if (sort === "updated") {
                return (
                    new Date(b.updatedAt).getTime() -
                    new Date(a.updatedAt).getTime()
                );
            }
            if (sort === "price_asc") {
                return getMinPrice(a) - getMinPrice(b);
            }
            if (sort === "price_desc") {
                const priceA =
                    getMinPrice(a) === Infinity ? -1 : getMinPrice(a);
                const priceB =
                    getMinPrice(b) === Infinity ? -1 : getMinPrice(b);
                return priceB - priceA;
            }
            if (sort === "vendor_asc") {
                return (a.vendor?.name ?? "").localeCompare(
                    b.vendor?.name ?? "",
                );
            }
            return 0;
        };

        return result
            .sort(
                (a, b) =>
                    (q ? b.score - a.score : 0) ||
                    compareSelectedSort(a.promo, b.promo),
            )
            .map(({ promo }) => promo);
    }, [promos, activeFilter, query, sort, lastVisit]);

    // Save search term after a delay when typing stops and has results
    useEffect(() => {
        if (!query.trim()) return;
        const timer = setTimeout(() => {
            if (filtered.length > 0) {
                saveSearch(query);
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, [query, filtered.length, saveSearch]);

    // Close recent searches dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                recentSearchesRef.current &&
                !recentSearchesRef.current.contains(e.target as Node) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(e.target as Node)
            ) {
                setSearchFocused(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Hot Promos Today — category-diversified selection with UNIQUE primary badges
    const hotPromos = useMemo(() => {
        if (promos.length === 0) return [];

        const sorted = [...promos].sort((a, b) => {
            const scoreDiff = getHotPromoScore(b) - getHotPromoScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            return (
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
        });

        const selected: Promo[] = [];
        const usedIds = new Set<string>();
        const usedBadgeLabels = new Set<string>();

        const addCandidate = (p: Promo) => {
            const b = getFeaturedBadge(p);
            selected.push(p);
            usedIds.add(p.id);
            if (b) usedBadgeLabels.add(b.label);
        };

        // Slot 1: Ending Soon (Highest urgency)
        const endingSoonCandidate = sorted.find(
            (p) => isEndingSoon(p) && !usedIds.has(p.id),
        );
        if (endingSoonCandidate) addCandidate(endingSoonCandidate);

        // Slot 2: Free Shipping / Free Over Threshold (Monetary savings)
        const freeShippingCandidate = sorted.find((p) => {
            if (usedIds.has(p.id)) return false;
            const b = getFeaturedBadge(p);
            return (
                (p.shippingFee === 0 || p.freeShippingThreshold != null) &&
                (!b || !usedBadgeLabels.has(b.label))
            );
        });
        if (freeShippingCandidate && selected.length < 4)
            addCandidate(freeShippingCandidate);

        // Slot 3: US Warehouse (Fast delivery)
        const usWarehouseCandidate = sorted.find((p) => {
            if (usedIds.has(p.id)) return false;
            const b = getFeaturedBadge(p);
            return (
                !!p.warehouse?.toLowerCase().match(/\bus\b|united.?states/) &&
                (!b || !usedBadgeLabels.has(b.label))
            );
        });
        if (usWarehouseCandidate && selected.length < 4)
            addCandidate(usWarehouseCandidate);

        // Slot 4: New / Recently Updated
        const freshCandidate = sorted.find((p) => {
            if (usedIds.has(p.id)) return false;
            const b = getFeaturedBadge(p);
            return !b || !usedBadgeLabels.has(b.label);
        });
        if (freshCandidate && selected.length < 4) addCandidate(freshCandidate);

        // Backfill up to 4 if any category had no unique candidate
        for (const p of sorted) {
            if (selected.length >= 4) break;
            if (!usedIds.has(p.id)) {
                addCandidate(p);
            }
        }

        return selected;
    }, [promos]);

    // All Promos (excluding hot promos if filter is 'all' and no query)
    const allPromos = useMemo(() => {
        if (activeFilter === "all" && !query) {
            const hotIds = new Set(hotPromos.map((p) => p.id));
            return filtered.filter((p) => !hotIds.has(p.id));
        }
        return filtered;
    }, [filtered, hotPromos, activeFilter, query]);

    if (submitting) {
        return (
            <PageShell>
                <Wrapper>
                    <PromoSubmit
                        servers={ownedServers}
                        onClose={() => setSubmitting(false)}
                    />
                </Wrapper>
            </PageShell>
        );
    }

    const filterChips: { key: FilterKey; label: string }[] = [
        { key: "all", label: "All" },
        { key: "us", label: "🇺🇸 US Warehouse" },
        { key: "cn", label: "🇨🇳 China" },
        { key: "in", label: "🇮🇳 India" },
        { key: "freeShipping", label: "🚚 Free Shipping" },
        { key: "endingSoon", label: "🕒 Ending Soon" },
        { key: "tirzepatide", label: "Tirzepatide" },
        { key: "retatrutide", label: "Retatrutide" },
    ];

    const compoundChips: { key: FilterKey; label: string }[] = [
        { key: "semaglutide", label: "Semaglutide" },
        { key: "hgh", label: "HGH" },
    ];

    const getFilterCount = (key: FilterKey) => {
        if (key === "all") return promos.length;
        return promos.filter((p) => matchesFilter(p, key, lastVisit)).length;
    };

    return (
        <PageShell>
            <Wrapper>
            {toast && (
                <ToastContainer>
                    <span>{toast.text}</span>
                    {toast.actionText && toast.onAction && (
                        <button
                            className="toast-action-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                toast.onAction?.();
                            }}>
                            {toast.actionText}
                        </button>
                    )}
                </ToastContainer>
            )}
            {/* ── Page Header ─────────────────────────────── */}
            <PageTitleRow>
                <PageTitleBlock>
                    <PageTitle>Promos</PageTitle>
                    <PageSubtitle>
                        Discover promotions from trusted vendors.
                    </PageSubtitle>
                </PageTitleBlock>
                {ownedServers.length > 0 && (
                    <SubmitBtn onClick={() => setSubmitting(true)}>
                        <Tag size={16} />
                        Submit Promo
                    </SubmitBtn>
                )}
            </PageTitleRow>

            {/* ── Market Activity (Condensed alert if active updates, auto-hidden if 0 or dismissed) ── */}
            {!dismissedMarketAlert &&
                lastVisitStats &&
                lastVisitStats.updateCount > 0 && (
                    <MarketActivityAlert>
                        <div className="alert-left">
                            <span className="alert-dot" />
                            <span className="alert-text-desktop">
                                <strong>Market Updates:</strong>{" "}
                                {lastVisitStats.updateCount}{" "}
                                {lastVisitStats.updateCount === 1
                                    ? "promotion has"
                                    : "promotions have"}{" "}
                                new activity since your last visit
                            </span>
                            <span className="alert-text-mobile">
                                <strong>{lastVisitStats.updateCount}</strong>{" "}
                                {lastVisitStats.updateCount === 1
                                    ? "market update"
                                    : "market updates"}
                            </span>
                        </div>
                        <div className="alert-right">
                            <button
                                className="alert-link"
                                onClick={handleViewAllUpdates}>
                                <span className="link-text-desktop">
                                    View all →
                                </span>
                                <span className="link-text-mobile">All →</span>
                            </button>
                            <button
                                className="alert-close"
                                onClick={handleDismissMarketAlert}
                                title="Dismiss market updates">
                                <X size={14} />
                            </button>
                        </div>
                    </MarketActivityAlert>
                )}

            {showMarketUpdatesEmpty && (
                <MarketUpdatesEmptyState
                    ref={marketUpdatesEmptyRef}
                    role="status"
                    aria-live="polite">
                    <strong>No unseen market updates are available.</strong>
                    <span>
                        Your current search, filters, and promotion list were
                        left unchanged.
                    </span>
                </MarketUpdatesEmptyState>
            )}

            {/* ── Search + Sort + Filters (sticky on mobile) ── */}
            <StickySearchBar>
                <SearchSortRow>
                    <SearchWrapper>
                        <Search size={20} className="search-icon" />
                        <InputBox
                            ref={searchInputRef}
                            palette="secondary"
                            value={inputValue}
                            onInput={(e) =>
                                setInputValue(e.currentTarget.value)
                            }
                            onFocus={() => setSearchFocused(true)}
                            placeholder="Search compounds, vendors..."
                            aria-label="Search compounds, vendors..."
                        />
                        {inputValue && (
                            <ClearButton
                                type="button"
                                aria-label="Clear promo search"
                                onClick={() => {
                                    setInputValue("");
                                    setQuery("");
                                    searchInputRef.current?.focus();
                                }}>
                                <X size={16} />
                            </ClearButton>
                        )}

                        {/* Recent Searches Dropdown */}
                        {searchFocused && recentSearches.length > 0 && (
                            <RecentSearchesPopup ref={recentSearchesRef}>
                                <RecentTitle>Recent Searches</RecentTitle>
                                {recentSearches.map((s, idx) => (
                                    <RecentItem
                                        key={idx}
                                        onClick={() => {
                                            setInputValue(s);
                                            setQuery(s);
                                            setSearchFocused(false);
                                        }}>
                                        <span>{s}</span>
                                        <RecentDeleteBtn
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRecentSearches((prev) => {
                                                    const next = prev.filter(
                                                        (item) => item !== s,
                                                    );
                                                    safeStorage.set(
                                                        "recent_promo_searches",
                                                        JSON.stringify(next),
                                                    );
                                                    return next;
                                                });
                                            }}>
                                            <X size={12} />
                                        </RecentDeleteBtn>
                                    </RecentItem>
                                ))}
                            </RecentSearchesPopup>
                        )}
                    </SearchWrapper>
                    <SortSelect
                        value={sort}
                        onChange={(e) =>
                            setSort(e.currentTarget.value as Sort)
                        }>
                        <option value="newest">Newest First</option>
                        <option value="updated">Recently Updated</option>
                        <option value="price_asc">Price Low → High</option>
                        <option value="price_desc">Price High → Low</option>
                        <option value="vendor_asc">Vendor A-Z</option>
                    </SortSelect>
                </SearchSortRow>

                {/* ── Filter Chips ──────────────────────────────────────────── */}
                <FilterChipsRow
                    data-carousel="horizontal"
                    role="group"
                    aria-label="Filter promotions"
                    onTouchStart={(e: any) => e.stopPropagation()}
                    onTouchMove={(e: any) => e.stopPropagation()}>
                    {filterChips.map((chip) => {
                        const count = getFilterCount(chip.key);
                        return (
                            <FilterChip
                                key={chip.key}
                                active={activeFilter === chip.key}
                                aria-pressed={activeFilter === chip.key}
                                onClick={() => setActiveFilter(chip.key)}>
                                <span>{chip.label}</span>
                                <span className="chip-count">{count}</span>
                            </FilterChip>
                        );
                    })}
                    <FilterDivider aria-hidden="true" />
                    {compoundChips.map((chip) => {
                        const count = getFilterCount(chip.key);
                        return (
                            <FilterChip
                                key={chip.key}
                                active={activeFilter === chip.key}
                                aria-pressed={activeFilter === chip.key}
                                onClick={() => setActiveFilter(chip.key)}>
                                <span>{chip.label}</span>
                                <span className="chip-count">{count}</span>
                            </FilterChip>
                        );
                    })}
                </FilterChipsRow>
            </StickySearchBar>

            {/* ── Main Content ───────────────────────────────── */}
            {loading ? (
                <Centered>
                    <Preloader type="ring" />
                </Centered>
            ) : error ? (
                <Centered>{error}</Centered>
            ) : promos.length === 0 ? (
                <Empty>
                    <Glyph>
                        <span className="float a">-20%</span>
                        <span className="float b">$78</span>
                        <Tag size={40} />
                    </Glyph>
                    <h3>No live promos right now</h3>
                    <p>
                        {ownedServers.length > 0
                            ? "Be the first to post one. Submit a promo for your community and it'll show up here once an admin approves it."
                            : "Vendors haven't posted any deals yet. Check back soon. Fresh promos land here as communities publish them."}
                    </p>
                    {ownedServers.length > 0 && (
                        <div className="cta">
                            <Button
                                palette="accent"
                                onClick={() => setSubmitting(true)}>
                                <Tag size={16} />
                                Submit your promo
                            </Button>
                        </div>
                    )}
                </Empty>
            ) : filtered.length === 0 ? (
                <Empty style={{ paddingTop: 32, marginTop: 12 }}>
                    <Glyph>
                        <Search size={38} />
                    </Glyph>

                    {/* 1. Contextual Explanation */}
                    <h3>
                        {query && activeFilter !== "all"
                            ? "No promotions match your current search and filters."
                            : query
                                ? `No promotions found for "${query}".`
                                : `No promotions available with the selected "${filterChips.find(
                                    (c) => c.key === activeFilter,
                                )?.label ||
                                compoundChips.find(
                                    (c) => c.key === activeFilter,
                                )?.label ||
                                activeFilter
                                }" filter.`}
                    </h3>

                    {/* 2. Active Constraint Summary */}
                    <ActiveFilterSummaryRow>
                        <span className="summary-title">Active Filters:</span>
                        {query && (
                            <SummaryTag
                                onClick={() => {
                                    setInputValue("");
                                    setQuery("");
                                }}>
                                <Search size={11} /> "{query}" <X size={10} />
                            </SummaryTag>
                        )}
                        {activeFilter !== "all" && (
                            <SummaryTag
                                onClick={() => {
                                    setActiveFilter("all");
                                }}>
                                {filterChips.find((c) => c.key === activeFilter)
                                    ?.label ||
                                    compoundChips.find(
                                        (c) => c.key === activeFilter,
                                    )?.label ||
                                    activeFilter}{" "}
                                <X size={10} />
                            </SummaryTag>
                        )}
                    </ActiveFilterSummaryRow>

                    {/* 7. Supporting Text */}
                    <p style={{ maxWidth: 420 }}>
                        Try another search, remove some filters, or browse all
                        active promotions.
                    </p>

                    {/* 4. Clickable Suggestion Chips */}
                    <div style={{ marginTop: 18 }}>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--tertiary-foreground)",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                            }}>
                            Try one of these instead:
                        </span>
                        <SuggestionChipGrid>
                            {[
                                { label: "Tirzepatide", filter: "tirzepatide" },
                                { label: "Retatrutide", filter: "retatrutide" },
                                { label: "Semaglutide", filter: "semaglutide" },
                                { label: "🇺🇸 US Warehouse", filter: "us" },
                                {
                                    label: "🚚 Free Shipping",
                                    filter: "freeShipping",
                                },
                            ].map((item) => (
                                <SuggestionChipBtn
                                    key={item.filter}
                                    onClick={() => {
                                        setInputValue("");
                                        setQuery("");
                                        setActiveFilter(
                                            item.filter as FilterKey,
                                        );
                                    }}>
                                    {item.label}
                                </SuggestionChipBtn>
                            ))}
                        </SuggestionChipGrid>
                    </div>

                    {/* 3. Recovery Actions */}
                    <div
                        className="cta"
                        style={{
                            marginTop: 24,
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            justifyContent: "center",
                        }}>
                        {activeFilter !== "all" && (
                            <Button
                                compact
                                palette="secondary"
                                onClick={() => {
                                    setActiveFilter("all");
                                }}>
                                Clear Filters
                            </Button>
                        )}
                        {query && (
                            <Button
                                compact
                                palette="secondary"
                                onClick={() => {
                                    setInputValue("");
                                    setQuery("");
                                }}>
                                Clear Search
                            </Button>
                        )}
                        {(activeFilter !== "all" || query) && (
                            <Button
                                compact
                                palette="accent"
                                onClick={() => {
                                    setActiveFilter("all");
                                    setInputValue("");
                                    setQuery("");
                                }}>
                                Browse All Promotions
                            </Button>
                        )}
                    </div>
                </Empty>
            ) : (
                <>
                    {/* Active Filter Status Banner */}
                    {(activeFilter !== "all" || query) && (
                        <ActiveFilterNoticeBar>
                            <div className="notice-left">
                                <span className="live-dot" />
                                <span className="notice-text">
                                    Showing <strong>{filtered.length}</strong>{" "}
                                    {filtered.length === 1
                                        ? "promotion"
                                        : "promotions"}
                                    {query ? (
                                        <>
                                            {" "}
                                            matching "<strong>{query}</strong>"
                                        </>
                                    ) : null}
                                    {activeFilter !== "all" ? (
                                        <>
                                            {" "}
                                            filtered by{" "}
                                            <strong>
                                                {filterChips.find(
                                                    (c) =>
                                                        c.key === activeFilter,
                                                )?.label ||
                                                    compoundChips.find(
                                                        (c) =>
                                                            c.key ===
                                                            activeFilter,
                                                    )?.label ||
                                                    (activeFilter ===
                                                    "marketUpdates"
                                                        ? "Market updates"
                                                        : activeFilter)}
                                            </strong>
                                        </>
                                    ) : null}
                                </span>
                            </div>
                            <button
                                className="reset-btn"
                                onClick={() => {
                                    setActiveFilter("all");
                                    setInputValue("");
                                    setQuery("");
                                }}>
                                <X size={13} />
                                Reset Filters
                            </button>
                        </ActiveFilterNoticeBar>
                    )}

                    {/* ── Trending Peptides ─────────────────────── */}
                    {!query && activeFilter === "all" && (
                        (() => {
                            // Only surface compounds backed by current promo data.
                            type TrendProduct = { key: string; name: string; minPrice: number; promoCount: number; vendorCount: number };
                            const productMap = new Map<string, TrendProduct>();
                            const TRACKED = [
                                { key: "retatrutide", name: "Retatrutide" },
                                { key: "tirzepatide", name: "Tirzepatide" },
                                { key: "semaglutide", name: "Semaglutide" },
                                { key: "ghkcu", name: "GHK-Cu" },
                                { key: "hgh", name: "HGH" },
                            ];
                            for (const tracked of TRACKED) {
                                const trackedCompound = normalizeCompound(
                                    tracked.key,
                                );
                                const matching = promos.filter((p) =>
                                    p.items.some((it) =>
                                        normalizeCompound(it.product) ===
                                        trackedCompound,
                                    )
                                );
                                if (matching.length > 0) {
                                    const prices = matching
                                        .flatMap((p) =>
                                            p.items
                                                .filter(
                                                    (item) =>
                                                        normalizeCompound(
                                                            item.product,
                                                        ) === trackedCompound,
                                                )
                                                .map((item) => item.price),
                                        )
                                        .filter((pr): pr is number => typeof pr === "number" && isFinite(pr));
                                    if (prices.length === 0) continue;
                                    const minPrice = Math.min(...prices);
                                    const vendorCount = new Set(matching.map((p) => p.vendor.name)).size;
                                    productMap.set(tracked.key, {
                                        key: tracked.key,
                                        name: tracked.name,
                                        minPrice: Math.round(minPrice * 100) / 100,
                                        promoCount: matching.length,
                                        vendorCount,
                                    });
                                }
                            }
                            const displayProducts = [...productMap.values()]
                                .sort((a, b) => b.promoCount - a.promoCount)
                                .slice(0, 5);

                            return (
                                <TrendingPeptides
                                    products={displayProducts}
                                    onSelectProduct={(key) => {
                                        // Rule 3: Selecting product opens Compare drawer, does NOT auto-filter main grid
                                        setCompareProduct(
                                            normalizeCompound(key),
                                        );
                                    }}
                                    onOpenCompare={(key) => {
                                        setCompareProduct(
                                            normalizeCompound(key),
                                        );
                                    }}
                                />
                            );
                        })()
                    )}

                    {/* ── Hot Promos Today ─────────────────────── */}
                    {hotPromos.length > 0 && activeFilter === "all" && !query && (
                        <HotPromosSectionWrapper>
                            <SectionDivider />
                            <SectionHeader style={{ marginTop: "8px" }}>
                                <SectionTitleBlock>
                                    <SectionTitle>
                                        🔥 Hot Promos Today
                                    </SectionTitle>
                                    <SectionSubtitle>
                                        Scored by urgency, freshness and value
                                    </SectionSubtitle>
                                </SectionTitleBlock>
                                <SectionViewAll onClick={scrollToAllPromos}>
                                    View all
                                    <RightArrowAlt size={16} />
                                </SectionViewAll>
                            </SectionHeader>
                            <HotPromosGrid
                                data-carousel="horizontal"
                                ref={hotCarouselRef}
                                key={`${activeFilter}-${query}-${sort}`}
                                onTouchStart={(e: any) => e.stopPropagation()}
                                onTouchMove={(e: any) => e.stopPropagation()}>
                                {hotPromos.map((p) => (
                                    <PromoCard
                                        key={p.id}
                                        promo={p}
                                        onOpenImage={openLightbox}
                                        onCompare={(key) => setCompareProduct(key)}
                                        lastVisit={lastVisit}
                                        featured
                                        searchQuery={query}
                                        featuredReason={getFeaturedBadge(p)}
                                    />
                                ))}
                            </HotPromosGrid>
                            {/* Pagination dots — visible only on mobile carousel */}
                            <HotCarouselDots>
                                {hotPromos.map((_, i) => (
                                    <CarouselDot
                                        key={i}
                                        active={hotSlide === i}
                                    />
                                ))}
                            </HotCarouselDots>
                        </HotPromosSectionWrapper>
                    )}

                    {/* ── All Promos ───────────────────────────── */}
                    <div ref={allPromosRef}>
                        <SectionDivider style={{ marginBottom: "20px" }} />
                        <AllPromosHeader>
                            <div>
                                <AllPromosTitle>All Promotions</AllPromosTitle>
                                <AllPromosCount>
                                    Browse every active promotion from trusted
                                    vendors.
                                </AllPromosCount>
                            </div>
                        </AllPromosHeader>
                        {allPromos.length > 0 ? (
                            <Grid key={`${activeFilter}-${query}-${sort}`}>
                                {allPromos.map((p) => (
                                    <PromoCard
                                        key={p.id}
                                        promo={p}
                                        onOpenImage={openLightbox}
                                        onCompare={(key) => setCompareProduct(key)}
                                        lastVisit={lastVisit}
                                        searchQuery={query}
                                    />
                                ))}
                            </Grid>
                        ) : activeFilter !== "all" || query ? (
                            <div style={{
                                padding: "36px 20px",
                                textAlign: "center",
                                background: "var(--secondary-background)",
                                borderRadius: 16,
                                border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                                margin: "16px 0",
                            }}>
                                <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700 }}>
                                    No active promotions found for {activeFilter !== "all" ? activeFilter : `"${query}"`}
                                </h3>
                                <p style={{ fontSize: 12, color: "var(--tertiary-foreground)", margin: "0 0 16px 0" }}>
                                    Try another product or browse all promotions across all vendors.
                                </p>
                                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                    <button
                                        className="btn-secondary"
                                        style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                        onClick={() => {
                                            setActiveFilter("all");
                                            setQuery("");
                                        }}>
                                        Clear Filters
                                    </button>
                                    <button
                                        className="btn-primary"
                                        style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                        onClick={() => {
                                            setActiveFilter("all");
                                            setQuery("");
                                        }}>
                                        Browse All Promotions
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </>
            )}

            {/* ── Lightbox ─────────────────────────────────── */}
            {lightbox && (
                <ImageLightbox
                    images={lightbox.images}
                    initialIndex={lightbox.initialIndex}
                    onClose={() => setLightbox(null)}
                />
            )}

            {/* ── Comparison Drawer ───────────────────────── */}
            {(() => {
                const comparisonCompound = normalizeCompound(compareProduct);
                const matchingPromos = comparisonCompound
                    ? promos.filter((p) =>
                        p.items.some((it) =>
                            normalizeCompound(it.product) === comparisonCompound,
                        ),
                    )
                    : [];

                const vendorMap = new Map<string, {
                    id: string;
                    promoId: string;
                    name: string;
                    logo?: string;
                    warehouse: string;
                    flag: string;
                    minPrice: number | null;
                    priceUnit?: string;
                    discount?: string;
                    shipping?: string;
                    customs?: string;
                    purity?: string;
                    serverId: string | null;
                    inviteLink: string | null;
                    communityUrl?: string;
                }>();

                for (const p of matchingPromos) {
                        const matchingItems = p.items.filter(
                            (item) =>
                                normalizeCompound(item.product) ===
                                comparisonCompound,
                        );
                        const lowestPricedItem = matchingItems
                            .filter(
                                (item) =>
                                    typeof item.price === "number" &&
                                    isFinite(item.price),
                            )
                            .sort((a, b) => a.price - b.price)[0];
                        const minPrice = lowestPricedItem?.price ?? null;
                        const wh = (p.warehouse || "").toLowerCase();
                        const flag = wh.includes("eu") ? "🇪🇺" : wh.includes("cn") ? "🇨🇳" : "🇺🇸";
                        const shippingText =
                            p.shippingFee === 0
                                ? "Free Shipping"
                                : p.freeShippingThreshold
                                    ? `Free over $${p.freeShippingThreshold}`
                                    : p.shippingFee != null && p.shippingFee > 0
                                        ? `$${p.shippingFee} Shipping`
                                        : p.shippingNote || undefined;

                        const guaranteesText = p.guarantee?.customsReship
                            ? "Customs Reship"
                            : p.guarantee?.text || undefined;

                        const purityText = p.guarantee?.purityPct
                            ? `${p.guarantee.purityPct}%`
                            : undefined;

                        const vendor = {
                            id: p.id,
                            promoId: p.id,
                            name: p.vendor.name,
                            logo: p.vendor.logo || undefined,
                            warehouse: p.warehouse || "US Warehouse",
                            flag,
                            minPrice:
                                minPrice == null
                                    ? null
                                    : Math.round(minPrice * 100) / 100,
                            priceUnit:
                                lowestPricedItem?.unit?.trim() || undefined,
                            discount: p.discountNote || undefined,
                            shipping: shippingText,
                            customs: guaranteesText,
                            purity: purityText,
                            serverId: p.vendor.serverId,
                            inviteLink: p.vendor.inviteLink,
                            communityUrl: p.vendor.inviteLink || undefined,
                        };

                        const vendorKey =
                            p.vendor.serverId ||
                            p.vendor.name.trim().toLowerCase();
                        const existing = vendorMap.get(vendorKey);
                        const shouldReplace =
                            !existing ||
                            (vendor.minPrice != null &&
                                (existing.minPrice == null ||
                                    vendor.minPrice < existing.minPrice));
                        if (shouldReplace) vendorMap.set(vendorKey, vendor);
                }

                const vendors = [...vendorMap.values()].sort((a, b) =>
                    (a.minPrice ?? Number.POSITIVE_INFINITY) -
                    (b.minPrice ?? Number.POSITIVE_INFINITY),
                );

                return (
                    <ComparisonDrawer
                        productName={comparisonCompound ? formatCompoundLabel(comparisonCompound) : null}
                        vendors={vendors}
                        onClose={() => setCompareProduct(null)}
                        onScrollToPromo={scrollToPromo}
                        onShowToast={showToast}
                        onApplyFilter={(productKey) => {
                            const compound = normalizeCompound(productKey);
                            if (!compound) return;

                            const knownFilter: FilterKey | null =
                                compound === "retatrutide" ||
                                compound === "tirzepatide" ||
                                compound === "semaglutide" ||
                                compound === "hgh"
                                    ? compound
                                    : null;

                            if (knownFilter) {
                                setActiveFilter(knownFilter);
                                setInputValue("");
                                setQuery("");
                            } else {
                                // Unsupported filter keys use the existing search
                                // pipeline instead of silently becoming "All".
                                setActiveFilter("all");
                                setInputValue(compound);
                                setQuery(compound);
                            }

                            // Ensure scroll triggers AFTER React re-renders filtered cards into the DOM
                            requestAnimationFrame(() => {
                                setTimeout(() => {
                                    allPromosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 80);
                            });
                        }}
                    />
                );
            })()}
        </Wrapper>
        </PageShell>
    );
};

export default observer(Promos);
