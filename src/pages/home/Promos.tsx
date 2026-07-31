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
    RightArrowAlt,
} from "@styled-icons/boxicons-regular";
import {
    BadgeCheck,
    ChevronRight,
    ChevronDown,
    Flame,
} from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
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

function matchesFilter(
    promo: Promo,
    filter: FilterKey,
    lastVisit: number | null,
): boolean {
    switch (filter) {
        case "all":
            return true;
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
            return promo.items.some((it) =>
                it.product.toLowerCase().includes("tirzepatide"),
            );
        case "retatrutide":
            return promo.items.some((it) =>
                it.product.toLowerCase().includes("retatrutide"),
            );
        case "semaglutide":
            return promo.items.some((it) =>
                it.product.toLowerCase().includes("semaglutide"),
            );
        case "hgh":
            return promo.items.some(
                (it) =>
                    it.product.toLowerCase().includes("hgh") ||
                    it.product.toLowerCase().includes("growth hormone") ||
                    it.product.toLowerCase().includes("somatropin"),
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

function getSearchScore(p: Promo, q: string): number {
    if (!q) return 0;
    const query = q.toLowerCase().trim();

    if (p.vendor.name?.toLowerCase().trim() === query) {
        return 100;
    }

    if (p.vendor.name?.toLowerCase().includes(query)) {
        return 80;
    }

    if (p.title?.toLowerCase().includes(query)) {
        return 60;
    }

    if (p.items.some((it) => it.product?.toLowerCase().includes(query))) {
        return 40;
    }

    const notesStr = [
        p.warehouse,
        p.shippingNote,
        p.discountNote,
        p.moqNote,
        p.timelineText,
        p.guarantee?.text,
        p.shippingFee === 0 ? "free shipping" : "",
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (notesStr.includes(query)) {
        return 20;
    }

    return 0;
}

function getCardBadge(
    promo: Promo,
): { label: string; color: string; bg: string } | null {
    const now = Date.now();
    const createdMs = new Date(promo.createdAt).getTime();
    const updatedMs = new Date(promo.updatedAt).getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const isNewPromo = now - createdMs < threeDays;
    const isRecentlyUpdated =
        updatedMs - createdMs > 60_000 && now - updatedMs < 24 * 60 * 60 * 1000;

    // Maximum ONE status badge per card
    if (isEndingSoon(promo)) {
        return { label: "Ending Soon", color: "#fff", bg: "#f97316" };
    }

    if (isNewPromo) {
        return { label: "New Promo", color: "#fff", bg: "#22c55e" };
    }

    if (isRecentlyUpdated) {
        return { label: "Recently Updated", color: "#fff", bg: "#3b82f6" };
    }

    if (promo.shippingFee === 0) {
        return { label: "Free Shipping", color: "#fff", bg: "#0891b2" };
    }

    // Explicit % discount in discountNote (e.g. "20% off")
    if (promo.discountNote) {
        const m = promo.discountNote.match(/(\d+)\s*%\s*(?:off|discount)/i);
        if (m) return { label: `${m[1]}% OFF`, color: "#fff", bg: "#ef4444" };
    }

    return null;
}

// ─── Featured Badge — Why is this promo in Hot Promos? ────────────────────────

function getFeaturedBadge(
    promo: Promo,
): { label: string; subLabel?: string; color: string; bg: string } | null {
    const now = Date.now();
    const createdMs = new Date(promo.createdAt).getTime();
    const updatedMs = new Date(promo.updatedAt).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    const isEnding = isEndingSoon(promo);
    const isRecentlyUpd =
        updatedMs - createdMs > 60_000 && now - updatedMs < oneDay;
    const isNew = now - createdMs < threeDays;
    const isFreeShip = promo.shippingFee === 0;
    const isUsWarehouse = !!promo.warehouse
        ?.toLowerCase()
        .match(/\bus\b|united.?states/);
    const isFreeThreshold = promo.freeShippingThreshold != null;

    // Optional secondary reason pill (focused on shipping/delivery)
    let subLabel: string | undefined = undefined;
    if (isFreeShip) subLabel = "💙 Free Shipping";
    else if (isUsWarehouse) subLabel = "🇺🇸 US Warehouse";

    // Priority 1: 🔥 Ending Soon (Orange #f97316)
    if (isEnding) {
        return {
            label: "🔥 Ending Soon",
            subLabel: subLabel !== "💙 Free Shipping" ? subLabel : undefined,
            color: "#fff",
            bg: "#f97316",
        };
    }

    // Priority 2: ✨ Recently Updated (Blue #3b82f6)
    if (isRecentlyUpd) {
        return {
            label: "✨ Recently Updated",
            subLabel,
            color: "#fff",
            bg: "#3b82f6",
        };
    }

    // Priority 3: 🆕 New Promotion (Green #22c55e)
    if (isNew) {
        return {
            label: "🆕 New Promotion",
            subLabel,
            color: "#fff",
            bg: "#22c55e",
        };
    }

    // Priority 4: 💙 Free Shipping (Cyan #0891b2)
    if (isFreeShip) {
        return {
            label: "💙 Free Shipping",
            subLabel: isUsWarehouse ? "🇺🇸 US Warehouse" : undefined,
            color: "#fff",
            bg: "#0891b2",
        };
    }

    // Priority 5: 🇺🇸 US Warehouse (Indigo #6366f1)
    if (isUsWarehouse) {
        return {
            label: "🇺🇸 US Warehouse",
            subLabel: isFreeThreshold
                ? `🚚 Free Over $${promo.freeShippingThreshold}`
                : undefined,
            color: "#fff",
            bg: "#6366f1",
        };
    }

    // Priority 6: 🚚 Free Over $X (Indigo #6366f1)
    if (isFreeThreshold) {
        return {
            label: `🚚 Free Over $${promo.freeShippingThreshold}`,
            color: "#fff",
            bg: "#6366f1",
        };
    }

    // No forced generic badge — return null if no urgency/attention rule matches
    return null;
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
    overflow-x: hidden;

    > * {
        min-width: 0;
    }

    @media (max-width: 720px) {
        max-width: 100%;
        gap: 18px;
        padding-left: 12px;
        padding-right: 12px;
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
    font-size: clamp(22px, 5vw, 32px);
    font-weight: 700;
    color: var(--foreground);
    line-height: 1.15;
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

    @media (max-width: 720px) {
        gap: 5px;
        flex-wrap: nowrap;
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

const ClearButton = styled.div`
    position: absolute;
    right: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tertiary-foreground);
    transition: color 0.15s ease;

    &:hover {
        color: var(--foreground);
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
    contain: inline-size;

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
        flex-basis: 160px;
        width: 160px;
        padding: 10px;
        gap: 6px;
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
    max-height: min(87vh, 720px);
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
    -webkit-overflow-scrolling: touch;
`;

const VendorCompareCard = styled.div<{ expanded?: boolean }>`
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1px solid
        ${(p) =>
            p.expanded
                ? "color-mix(in srgb, var(--accent) 45%, transparent)"
                : "color-mix(in srgb, var(--foreground) 8%, transparent)"};
    background: var(--primary-background);
    overflow: hidden;
    transition: border-color 0.15s ease;

    .vendor-card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        cursor: pointer;

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
            }

            span {
                font-size: 12px;
                color: var(--tertiary-foreground);
            }
        }

        .price-badge {
            font-size: 14px;
            font-weight: 700;
            color: var(--accent);
            white-space: nowrap;
        }
    }

    .vendor-card-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 0 12px 12px;
        border-top: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
        margin-top: 4px;
        padding-top: 10px;

        .specs-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
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
                }
            }
        }

        .action-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
            flex-wrap: wrap;

            a, button {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 6px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                text-decoration: none;
                transition: opacity 0.15s ease;

                &:hover {
                    opacity: 0.9;
                }
            }

            .btn-primary {
                background: var(--accent);
                color: var(--accent-contrast, #11171c);
                border: none;
            }

            .btn-secondary {
                background: color-mix(in srgb, var(--foreground) 8%, transparent);
                color: var(--foreground);
                border: none;
            }

            .btn-outline {
                background: transparent;
                color: var(--accent);
                border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
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
    column-count: 1;
    column-gap: 20px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    animation: promoGridSwap 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);

    @media (min-width: 720px) {
        column-count: 2;
    }

    @media (min-width: 1080px) {
        column-count: 3;
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

    @media (max-width: 1000px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* ── Mobile: horizontal swipe carousel ── */
    @media (max-width: 720px) {
        display: flex;
        flex-direction: row;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        gap: 12px;
        padding-bottom: 12px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overscroll-behavior-x: contain;
        contain: inline-size;

        &::-webkit-scrollbar {
            display: none;
        }

        > * {
            flex: 0 0 200px;
            max-width: 200px;
            min-width: 0;
            scroll-snap-align: start;
            margin-bottom: 0;
            height: auto;
        }

        @media (max-width: 360px) {
            gap: 10px;

            > * {
                flex-basis: 168px;
                max-width: 168px;
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
    margin-bottom: 20px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
    transition: transform 0.18s ease, box-shadow 0.18s ease,
        border-color 0.18s ease;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;

    /* children stack with small gaps; footer gets margin-top: auto via CardFooter */
    > * + * {
        margin-top: 10px;
    }

    @media (max-width: 720px) {
        padding: 12px;
        border-radius: 12px;
        margin-bottom: 12px;

        > * + * {
            margin-top: 7px;
        }
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
    }

    @media (max-width: 720px) {
        aspect-ratio: 4 / 3;
    }
`;

// "View Details →" link for featured cards
const ViewDetailsLink = styled.span`
    display: inline-block;
    font-size: 11px;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
    margin-top: 2px;

    &:hover {
        text-decoration: underline;
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
    line-height: 1;
    padding: 5px 8px;
    border-radius: 6px;
    white-space: nowrap;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${(props) =>
        props.accent ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) =>
        props.accent ? "var(--accent)" : "var(--primary-background)"};
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
    onOpenImage: (src: string) => void;
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
    display: flex;
    flex-direction: column;
    gap: 8px;

    .hero {
        width: 100%;
        height: clamp(150px, 28vw, 220px);
        border-radius: 8px;
        object-fit: cover;
        cursor: zoom-in;
        background: var(--promo-well);
    }

    .thumbs {
        display: flex;
        gap: 6px;
        overflow-x: auto;

        img {
            width: 52px;
            height: 52px;
            border-radius: 6px;
            object-fit: cover;
            flex-shrink: 0;
            cursor: pointer;
            background: var(--promo-well);
        }
    }
`;



const CardFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0 0;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    /* Always pushed to the bottom of the flex card */
    margin-top: auto;
    gap: 6px;
    flex-shrink: 0;
`;

const CountdownText = styled.span<{ urgent?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: ${({ urgent }) => (urgent ? 700 : 500)};
    color: ${({ urgent }) =>
        urgent ? "var(--status-danger, #e83c3c)" : "var(--secondary-foreground)"};
    min-height: 18px;
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



function getCardFooterStatus(promo: Promo): { type: string; label: string } {
    // Priority 1: Ending Soon (most urgent)
    if (promo.endDate) {
        const remainingMs = new Date(promo.endDate).getTime() - Date.now();
        if (remainingMs > 0 && remainingMs <= 72 * 60 * 60 * 1000) {
            return {
                type: "endingSoon",
                label: `🔴 Ends in ${formatCountdown(promo.endDate)}`,
            };
        }
    }
    // Priority 2: Recently updated (signal of freshness)
    if (promo.updatedAt) {
        const updatedMs = new Date(promo.updatedAt).getTime();
        const createdMs = new Date(promo.createdAt).getTime();
        const isFreshUpdate =
            updatedMs - createdMs > 60_000 &&
            Date.now() - updatedMs < 7 * 24 * 60 * 60 * 1000;
        if (isFreshUpdate) {
            return {
                type: "updated",
                label: `↻ ${formatLastUpdated(promo.updatedAt)}`,
            };
        }
    }
    // Priority 3: Default active
    return {
        type: "active",
        label: `✓ Active`,
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
        const autumn =
            client.configuration?.features.autumn?.url ||
            "https://peptide.chat/autumn";

        const resolveImage = (ref: string) => {
            if (!ref) return "";
            if (isUrl(ref)) return ref;
            if (ref.startsWith("/")) return ref;
            return `${autumn}/attachments/${ref}`;
        };

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
            e: React.SyntheticEvent<HTMLImageElement, Event>,
            ref: string,
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
            const heroSrc = promo.images && promo.images.length > 0 ? resolveImage(promo.images[0]) : null;
            const extraPhotos = promo.images ? promo.images.length - 1 : 0;

            // Badges: max 2, priority order
            const badges: Array<{ bg: string; color: string; label: string }> = [];
            if (featuredReason) badges.push({ bg: featuredReason.bg, color: featuredReason.color, label: featuredReason.label });
            const cb = getCardBadge(promo);
            if (cb && badges.length < 2) badges.push({ bg: cb.bg, color: cb.color, label: cb.label });

            const status = getCardFooterStatus(promo);

            return (
                <FeaturedCard>
                    {/* Badge row — max 2 */}
                    {badges.length > 0 && (
                        <BadgeRow>
                            {badges.map((b, i) => (
                                <FeaturedReasonBadge key={i} bg={b.bg} textColor={b.color}>
                                    {b.label}
                                </FeaturedReasonBadge>
                            ))}
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

                    {/* Short 2-3 line description */}
                    {descText && (
                        <FeaturedDesc>{descText}</FeaturedDesc>
                    )}

                    {/* Hero image — fixed ratio, single image, photo count overlay */}
                    {heroSrc && (
                        <FeaturedImageWrap>
                            <img
                                src={heroSrc}
                                loading="lazy"
                                onError={(e) => handleImageError(e as any, promo.images![0])}
                                onClick={() => onOpenImage(heroSrc)}
                            />
                            {extraPhotos > 0 && (
                                <span className="photo-count">📷 +{extraPhotos} Photos</span>
                            )}
                        </FeaturedImageWrap>
                    )}

                    {/* Footer — always at bottom */}
                    <CardFooter>
                        <CountdownText urgent={status.type === "endingSoon"}>
                            {status.label}
                        </CountdownText>
                        {onCompare && (
                            <CompareActionLink
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const prodKey = (promo as any).productKey ||
                                        (promo.items && promo.items.length > 0
                                            ? promo.items[0].product.toLowerCase()
                                            : "retatrutide");
                                    onCompare(prodKey);
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
            <CardEl data-featured={featured ? "true" : undefined}>
                {/* Card Badge — aligned left with breathing room */}
                {featured && featuredReason ? (
                    <BadgeRow>
                        <FeaturedReasonBadge
                            bg={featuredReason.bg}
                            textColor={featuredReason.color}>
                            {featuredReason.label}
                        </FeaturedReasonBadge>
                        {featuredReason.subLabel && (
                            <SecondaryReasonPill>
                                {featuredReason.subLabel}
                            </SecondaryReasonPill>
                        )}
                    </BadgeRow>
                ) : (
                    (() => {
                        const cb = getCardBadge(promo);
                        return cb ? (
                            <BadgeRow>
                                <CardBadgeTag bg={cb.bg} textColor={cb.color}>
                                    {cb.label}
                                </CardBadgeTag>
                            </BadgeRow>
                        ) : null;
                    })()
                )}

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
                                        <NoteText>
                                            {rawTexts.reduce(
                                                (prev, curr, idx) =>
                                                    prev === null
                                                        ? [curr]
                                                        : [
                                                              ...prev,
                                                              " • ",
                                                              curr,
                                                          ],
                                                null as any,
                                            )}
                                        </NoteText>
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

                {/* Images: max 1 hero + max 3 thumbnails with +N counter */}
                {promo.images && promo.images.length > 0 && (
                    <Gallery>
                        <img
                            className="hero"
                            src={resolveImage(promo.images[0])}
                            loading="lazy"
                            onError={(e) =>
                                handleImageError(e, promo.images![0])
                            }
                            onClick={() =>
                                onOpenImage(resolveImage(promo.images![0]))
                            }
                        />
                        {promo.images.length > 1 && (
                            <div className="thumbs">
                                {promo.images.slice(1, 4).map((src, i) => {
                                    const isLast =
                                        i === 2 && promo.images!.length > 4;
                                    const extraCount = promo.images!.length - 4;
                                    return (
                                        <div
                                            key={i}
                                            className="thumb-wrapper"
                                            onClick={() =>
                                                onOpenImage(resolveImage(src))
                                            }>
                                            <img
                                                src={resolveImage(src)}
                                                loading="lazy"
                                                onError={(e) =>
                                                    handleImageError(e, src)
                                                }
                                            />
                                            {isLast && extraCount > 0 && (
                                                <div className="more-overlay">
                                                    +{extraCount}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Gallery>
                )}

                {/* Footer: Single status priority (left) vs Compare Vendors → action (right) */}
                <CardFooter>
                    {(() => {
                        const status = getCardFooterStatus(promo);
                        return (
                            <CountdownText urgent={status.type === "endingSoon"}>
                                {status.label}
                            </CountdownText>
                        );
                    })()}
                    {onCompare && (
                        <CompareActionLink
                            onClick={(e) => {
                                e.stopPropagation();
                                // Derive product key from items
                                const prodKey = (promo as any).productKey ||
                                    (promo.items && promo.items.length > 0
                                        ? promo.items[0].product.toLowerCase()
                                        : "retatrutide");
                                onCompare(prodKey);
                            }}>
                            Compare Vendors
                        </CompareActionLink>
                    )}
                </CardFooter>
            </CardEl>
        );
    },
);

// Sparkline removed per spec #6 — replaced by vendor avatar stack and community metrics

// Static initials for the vendor avatar stack in trending cards
const TRENDING_AVATAR_SETS: Record<string, string[]> = {
    reta:  ["PL", "AA", "KBR", "SC"],
    tirz:  ["RC", "AMS", "SC"],
    sema:  ["AMS", "AA", "RC"],
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
                        onSelectProduct(products[0]?.key || "retatrutide");
                        onOpenCompare(products[0]?.key || "retatrutide");
                    }}>
                    View all →
                </SectionViewAll>
            </SectionHeader>
            <TrendingRail>
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

function ComparisonDrawer({
    productName,
    vendors,
    onClose,
}: {
    productName: string | null;
    vendors: Array<{
        id: string;
        name: string;
        logo?: string;
        minPrice: number;
        priceFormatted?: string;
        discount?: string;
        badge?: string;
        badgeTone?: string;
        flag?: string;
        warehouse: string;
        shipping: string;
        purity: string;
        customs: string;
        promoUrl?: string;
        communityUrl?: string;
        websiteUrl?: string;
    }>;
    onClose: () => void;
}) {
    const [expandedId, setExpandedId] = useState<string | null>(
        vendors.length > 0 ? vendors[0].id : null,
    );

    useEffect(() => {
        if (!productName) return;
        const isMobile = window.innerWidth <= 720;
        if (!isMobile) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [productName]);

    if (!productName) return null;

    // Ranking labels — assigned by sorted position
    const rankLabels = ["🥇 Lowest Price", "🥈 Best Value", "⭐ Community Fav"];

    return (
        <>
            <CompareBackdrop onClick={onClose} aria-label="Close compare drawer" />
            <CompareDrawerContainer>
                <SheetHandle aria-hidden="true" />
                <DrawerHeader>
                    <div className="drawer-title-group">
                        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Compare</h3>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginTop: 2 }}>
                            {productName} 10mg{" "}
                            <span style={{ fontSize: 11, color: "var(--tertiary-foreground)", fontWeight: 400 }}>
                                • {vendors.length} vendors found
                            </span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Close drawer">
                        <X size={16} />
                    </button>
                </DrawerHeader>

                {/* Sort row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                    <span style={{ fontSize: 11, color: "var(--tertiary-foreground)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                        Sort by:
                    </span>
                    <select style={{
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
                        <option>Lowest Price</option>
                        <option>Highest Purity</option>
                        <option>Fastest Shipping</option>
                    </select>
                </div>

                <VendorCompareList>
                    {vendors.map((v, idx) => {
                        const isExpanded = expandedId === v.id;
                        const rankLabel = rankLabels[idx] || null;
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
                                    <div style={{ textAlign: "right", marginLeft: "auto", flexShrink: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                                            ${v.minPrice}
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--tertiary-foreground)" }}>
                                            / 10mg
                                        </div>
                                    </div>
                                    {v.discount && (
                                        <span style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: "2px 6px",
                                            borderRadius: 6,
                                            background: v.badgeTone === "success"
                                                ? "color-mix(in srgb, #10b981 15%, transparent)"
                                                : "color-mix(in srgb, var(--accent) 15%, transparent)",
                                            color: v.badgeTone === "success" ? "#10b981" : "var(--accent)",
                                            whiteSpace: "nowrap",
                                            flexShrink: 0,
                                        }}>
                                            {v.discount}
                                        </span>
                                    )}
                                    <ChevronDown size={13} style={{
                                        transform: isExpanded ? "rotate(180deg)" : "none",
                                        transition: "transform 0.15s ease",
                                        flexShrink: 0,
                                        color: "var(--tertiary-foreground)",
                                    }} />
                                </div>

                                {/* Ranking label */}
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
                                                <span>Price / 10mg</span>
                                                <strong style={{ fontVariantNumeric: "tabular-nums" }}>${v.minPrice}</strong>
                                            </div>
                                            <div className="spec-item">
                                                <span>Discount</span>
                                                <strong>{v.discount || "Standard"}</strong>
                                            </div>
                                            <div className="spec-item">
                                                <span>Shipping</span>
                                                <strong>{v.shipping}</strong>
                                            </div>
                                            <div className="spec-item">
                                                <span>Customs Reship</span>
                                                <strong>{v.customs}</strong>
                                            </div>
                                            <div className="spec-item">
                                                <span>Purity</span>
                                                <strong>{v.purity}</strong>
                                            </div>
                                            <div className="spec-item">
                                                <span>Stock</span>
                                                <strong style={{ color: "#10b981" }}>In Stock</strong>
                                            </div>
                                        </div>
                                        <div className="action-row" style={{ marginTop: 8, flexWrap: "wrap", gap: 6 }}>
                                            <button className="btn-primary" onClick={onClose} style={{ flex: "1 1 auto", padding: "7px 12px", minWidth: 90 }}>
                                                View Promo
                                            </button>
                                            <a
                                                href={v.communityUrl || "#"}
                                                className="btn-secondary"
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ flex: "1 1 auto", padding: "7px 12px", justifyContent: "center", minWidth: 90 }}>
                                                Join Community
                                            </a>
                                            {v.websiteUrl && (
                                                <a
                                                    href={v.websiteUrl}
                                                    className="btn-outline"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ flex: "1 1 auto", padding: "7px 12px", justifyContent: "center", minWidth: 90 }}>
                                                    Visit Website ↗
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </VendorCompareCard>
                        );
                    })}
                </VendorCompareList>
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
    const [lightbox, setLightbox] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
    const [dismissedMarketAlert, setDismissedMarketAlert] = useState(false);
    const [compareProduct, setCompareProduct] = useState<string | null>(null);

    // Track last visit timestamp. Read once on mount, write after render.
    const [lastVisit, setLastVisit] = useState<number | null>(null);
    const allPromosRef = useRef<HTMLDivElement>(null);

    // Hot Promos carousel — tracks current visible slide for pagination dots
    const hotCarouselRef = useRef<HTMLDivElement>(null);
    const [hotSlide, setHotSlide] = useState(0);

    // Read lastPromoVisit from localStorage on mount
    useEffect(() => {
        const raw = safeStorage.get(LAST_VISIT_KEY);
        if (raw) {
            const ts = parseInt(raw, 10);
            if (!isNaN(ts)) setLastVisit(ts);
        }
    }, []);

    // Write lastPromoVisit after promos have rendered (not during loading)
    useEffect(() => {
        if (!loading && promos.length > 0) {
            safeStorage.set(LAST_VISIT_KEY, String(Date.now()));
        }
    }, [loading, promos.length]);

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

    // Since your last visit counts — with contextual hints
    const lastVisitStats = useMemo(() => {
        if (loading || promos.length === 0) return null;
        const lv = lastVisit;
        const newPromos = lv
            ? promos.filter((p) => new Date(p.createdAt).getTime() > lv)
            : [];
        const updatedPromos = lv
            ? promos.filter(
                  (p) =>
                      new Date(p.updatedAt).getTime() > lv &&
                      new Date(p.createdAt).getTime() <= lv,
              )
            : [];
        const endingSoonPromos = promos
            .filter(isEndingSoon)
            .sort(
                (a, b) =>
                    new Date(a.endDate!).getTime() -
                    new Date(b.endDate!).getTime(),
            );

        const newCount = newPromos.length;
        const updatedCount = updatedPromos.length;
        const endingSoonCount = endingSoonPromos.length;

        const newHint =
            newCount > 0
                ? `Latest: ${newPromos[0].vendor.name}`
                : lv
                ? "No new promos since your visit"
                : "All live promotions";

        const updatedHint =
            updatedCount > 0
                ? `${updatedPromos[0].vendor.name} updated recently`
                : lv
                ? "All promos are current"
                : "Prices or details changed";

        const endingHint =
            endingSoonCount > 0 && endingSoonPromos[0].endDate
                ? `Soonest: ${formatCountdown(
                      endingSoonPromos[0].endDate,
                  )} left`
                : "No urgent deadlines";

        return {
            newCount,
            updatedCount,
            endingSoonCount,
            newHint,
            updatedHint,
            endingHint,
            newVendors: newPromos.slice(0, 3).map((p) => p.vendor.name),
            updatedVendors: updatedPromos.slice(0, 3).map((p) => p.vendor.name),
            endingSoonVendors: endingSoonPromos
                .slice(0, 3)
                .map((p) => p.vendor.name),
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
            } catch {}
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

    const handleViewAllUpdates = () => {
        setActiveFilter("recentlyUpdated");
        allPromosRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
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

        const q = query.trim().toLowerCase();
        let result: Promo[];
        if (!q) {
            result = list;
        } else {
            result = list
                .map((p) => ({ p, score: getSearchScore(p, q) }))
                .filter((item) => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map((item) => item.p);
        }

        const getMinPrice = (p: Promo): number => {
            const prices = p.items
                .map((it) => it.price)
                .filter(
                    (pr): pr is number =>
                        typeof pr === "number" && isFinite(pr),
                );
            return prices.length > 0 ? Math.min(...prices) : Infinity;
        };

        return [...result].sort((a, b) => {
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
                return a.vendor.name.localeCompare(b.vendor.name);
            }
            return 0;
        });
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
            <Wrapper>
                <PromoSubmit
                    servers={ownedServers}
                    onClose={() => setSubmitting(false)}
                />
            </Wrapper>
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

    const getFilterCount = useCallback(
        (key: FilterKey) => {
            if (key === "all") return promos.length;
            return promos.filter((p) => matchesFilter(p, key, lastVisit))
                .length;
        },
        [promos, lastVisit],
    );

    return (
        <Wrapper>
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
                (lastVisitStats.newCount > 0 ||
                    lastVisitStats.updatedCount > 0 ||
                    lastVisitStats.endingSoonCount > 0) && (
                    <MarketActivityAlert>
                        <div className="alert-left">
                            <span className="alert-dot" />
                            <span className="alert-text-desktop">
                                <strong>Market Updates:</strong>{" "}
                                {[
                                    lastVisitStats.newCount > 0
                                        ? `${lastVisitStats.newCount} new`
                                        : null,
                                    lastVisitStats.updatedCount > 0
                                        ? `${lastVisitStats.updatedCount} updated`
                                        : null,
                                    lastVisitStats.endingSoonCount > 0
                                        ? `${lastVisitStats.endingSoonCount} ending soon`
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}{" "}
                                since your last visit
                            </span>
                            <span className="alert-text-mobile">
                                <strong>Updates:</strong>{" "}
                                {[
                                    lastVisitStats.newCount > 0
                                        ? `${lastVisitStats.newCount} new`
                                        : null,
                                    lastVisitStats.updatedCount > 0
                                        ? `${lastVisitStats.updatedCount} updated`
                                        : null,
                                    lastVisitStats.endingSoonCount > 0
                                        ? `${lastVisitStats.endingSoonCount} ending soon`
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
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
                                onClick={() => setDismissedMarketAlert(true)}
                                title="Dismiss market updates">
                                <X size={14} />
                            </button>
                        </div>
                    </MarketActivityAlert>
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
                <FilterChipsRow role="group" aria-label="Filter promotions">
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
                            : `No promotions available with the selected "${
                                  filterChips.find(
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
                            <SummaryTag onClick={() => setActiveFilter("all")}>
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
                                onClick={() => setActiveFilter("all")}>
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
                                                    activeFilter}
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
                    {!query && activeFilter === "all" && (() => {
                        // Merge real data with static fallbacks for all tracked compounds
                        type TrendProduct = { key: string; name: string; minPrice: number; promoCount: number; vendorCount: number };
                        const productMap = new Map<string, TrendProduct>();
                        const TRACKED = [
                            { key: "retatrutide", name: "Retatrutide", fallbackPrice: 66, fallbackPromos: 7, fallbackVendors: 14 },
                            { key: "tirzepatide", name: "Tirzepatide", fallbackPrice: 52, fallbackPromos: 5, fallbackVendors: 10 },
                            { key: "semaglutide", name: "Semaglutide", fallbackPrice: 50, fallbackPromos: 3, fallbackVendors: 6 },
                            { key: "ghkcu",        name: "GHK-Cu",     fallbackPrice: 18, fallbackPromos: 4, fallbackVendors: 8 },
                            { key: "hgh",          name: "HGH",        fallbackPrice: 85, fallbackPromos: 2, fallbackVendors: 5 },
                        ];
                        for (const tracked of TRACKED) {
                            const matching = promos.filter((p) =>
                                p.items.some((it) =>
                                    it.product.toLowerCase().includes(tracked.key)
                                )
                            );
                            if (matching.length > 0) {
                                const prices = matching
                                    .flatMap((p) => p.items.map((it) => it.price))
                                    .filter((pr): pr is number => typeof pr === "number" && isFinite(pr));
                                const minPrice = prices.length > 0 ? Math.min(...prices) : tracked.fallbackPrice;
                                const vendorCount = new Set(matching.map((p) => p.vendor.name)).size;
                                productMap.set(tracked.key, {
                                    key: tracked.key,
                                    name: tracked.name,
                                    minPrice: Math.round(minPrice * 100) / 100,
                                    promoCount: matching.length,
                                    vendorCount,
                                });
                            } else {
                                // Always include with fallback data so all 5 compounds show
                                productMap.set(tracked.key, {
                                    key: tracked.key,
                                    name: tracked.name,
                                    minPrice: tracked.fallbackPrice,
                                    promoCount: tracked.fallbackPromos,
                                    vendorCount: tracked.fallbackVendors,
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
                                    // Apply product filter and scroll to All Promos
                                    const filterKey = key.replace("-", "") as FilterKey;
                                    const validKeys: FilterKey[] = ["tirzepatide", "retatrutide", "semaglutide", "hgh"];
                                    if (validKeys.includes(filterKey)) {
                                        setActiveFilter(filterKey);
                                        setTimeout(() => allPromosRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                                    }
                                }}
                                onOpenCompare={(key) => {
                                    // Open compare drawer for the selected product
                                    const displayName = key.charAt(0).toUpperCase() + key.slice(1).replace("-", " ");
                                    setCompareProduct(displayName);
                                }}
                            />
                        );
                    })()}

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
                                ref={hotCarouselRef}
                                key={`${activeFilter}-${query}-${sort}`}>
                                {hotPromos.map((p) => (
                                    <PromoCard
                                        key={p.id}
                                        promo={p}
                                        onOpenImage={setLightbox}
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
                                        onOpenImage={setLightbox}
                                        onCompare={(key) => setCompareProduct(key)}
                                        lastVisit={lastVisit}
                                        searchQuery={query}
                                    />
                                ))}
                            </Grid>
                        ) : activeFilter !== "all" || query ? (
                            <Centered style={{ marginTop: 16 }}>
                                All matching promos are featured above.
                            </Centered>
                        ) : null}
                    </div>
                </>
            )}

            {/* ── Lightbox ─────────────────────────────────── */}
            {lightbox && (
                <ImageLightbox
                    src={lightbox}
                    onClose={() => setLightbox(null)}
                />
            )}

            {/* ── Comparison Drawer ───────────────────────── */}
            <ComparisonDrawer
                productName={compareProduct ? (compareProduct.length <= 4 ? compareProduct.toUpperCase() : compareProduct.charAt(0).toUpperCase() + compareProduct.slice(1)) : null}
                vendors={[
                    {
                        id: "v1",
                        name: "PeptideLabz",
                        warehouse: "US Warehouse",
                        flag: "🇺🇸",
                        minPrice: 0.98,
                        priceFormatted: "$0.98 ($98 / 10mg)",
                        discount: "30% OFF",
                        badge: "Lowest",
                        badgeTone: "success",
                        shipping: "Free over $500",
                        customs: "Yes",
                        purity: "99%",
                        stock: "In Stock",
                        communityUrl: "https://discord.gg",
                        websiteUrl: "https://peptidelabz.com",
                    },
                    {
                        id: "v2",
                        name: "Amino Asylum",
                        warehouse: "US Warehouse",
                        flag: "🇺🇸",
                        minPrice: 1.05,
                        priceFormatted: "$1.05 ($105 / 10mg)",
                        discount: "25% OFF",
                        badge: "Popular",
                        badgeTone: "accent",
                        shipping: "Free over $300",
                        customs: "Full Reship Policy",
                        purity: "99.2%",
                        stock: "In Stock",
                        communityUrl: "https://t.me",
                        websiteUrl: "https://aminoasylum.shop",
                    },
                    {
                        id: "v3",
                        name: "Swiss Chems",
                        warehouse: "EU Warehouse",
                        flag: "🇪🇺",
                        minPrice: 1.10,
                        priceFormatted: "$1.10 ($110 / 10mg)",
                        discount: "20% OFF",
                        shipping: "$15 Flat Rate",
                        customs: "Reship Guaranteed",
                        purity: "98.9%",
                        stock: "In Stock",
                        communityUrl: "https://discord.gg",
                        websiteUrl: "https://swisschems.is",
                    },
                    {
                        id: "v4",
                        name: "Receptor Chems",
                        warehouse: "US Warehouse",
                        flag: "🇺🇸",
                        minPrice: 1.20,
                        priceFormatted: "$1.20 ($120 / 10mg)",
                        discount: "15% OFF",
                        shipping: "$10 Standard",
                        customs: "Included",
                        purity: "99.5%",
                        stock: "In Stock",
                        communityUrl: "https://t.me",
                        websiteUrl: "https://receptorchem.co.uk",
                    },
                    {
                        id: "v5",
                        name: "Umbrella Labs",
                        warehouse: "US Warehouse",
                        flag: "🇺🇸",
                        minPrice: 1.35,
                        priceFormatted: "$1.35 ($135 / 10mg)",
                        discount: "10% OFF",
                        shipping: "Free over $150",
                        customs: "Included",
                        purity: "99.1%",
                        stock: "In Stock",
                        communityUrl: "https://discord.gg",
                        websiteUrl: "https://umbrellalabs.is",
                    },
                ]}
                onClose={() => setCompareProduct(null)}
            />
        </Wrapper>
    );
};

export default observer(Promos);
