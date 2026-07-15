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

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

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

type Sort = "newest" | "endingSoon";
type FilterKey = "all" | "us" | "cn" | "in" | "freeShipping" | "endingSoon" | "recentlyUpdated";

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

function matchesFilter(promo: Promo, filter: FilterKey, lastVisit: number | null): boolean {
    switch (filter) {
        case "all": return true;
        case "us": return !!(promo.warehouse?.toLowerCase().match(/\bus\b|united.?states/));
        case "cn": return !!(promo.warehouse?.toLowerCase().match(/\bcn\b|china/));
        case "in": return !!(promo.warehouse?.toLowerCase().match(/\bin\b|india/));
        case "freeShipping":
            return promo.shippingFee === 0 || promo.freeShippingThreshold != null;
        case "endingSoon": return isEndingSoon(promo);
        case "recentlyUpdated":
            if (!lastVisit) return false;
            return new Date(promo.updatedAt).getTime() > lastVisit;
        default: return true;
    }
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\\\]\\\\]/g, "\\$&");
}

function highlightText(text: string | null | undefined, query: string): React.ReactNode {
    if (!text) return "";
    if (!query.trim()) return text;
    const parts = text.split(new RegExp("(" + escapeRegExp(query.trim()) + ")", "gi"));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.trim().toLowerCase() ? (
                    <mark key={i} style={{ background: "color-mix(in srgb, var(--accent) 35%, transparent)", color: "inherit", borderRadius: "2px", padding: "0 1px" }}>{part}</mark>
                ) : (
                    part
                )
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
        p.shippingFee === 0 ? "free shipping" : ""
    ].filter(Boolean).join(" ").toLowerCase();
    
    if (notesStr.includes(query)) {
        return 20;
    }
    
    return 0;
}


function getCardBadge(promo: Promo): { label: string; color: string; bg: string } | null {
    const now = Date.now();
    const createdMs = new Date(promo.createdAt).getTime();
    const updatedMs = new Date(promo.updatedAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const isNewPromo = now - createdMs < sevenDays;
    const isRecentlyUpdated = updatedMs - createdMs > 60_000 && now - updatedMs < threeDays;

    // Priority order — most urgent first
    if (isEndingSoon(promo)) {
        return { label: "Ending Soon", color: "#fff", bg: "#f97316" };
    }

    if (isNewPromo) {
        const wh = promo.warehouse?.toLowerCase() || "";
        if (wh.match(/\bus\b|united.?states/)) {
            return { label: "US Restocked", color: "#fff", bg: "#3b82f6" };
        }
        return { label: "New Promo", color: "#fff", bg: "#22c55e" };
    }

    if (isRecentlyUpdated) {
        return { label: "Recently Updated", color: "#fff", bg: "#3b82f6" };
    }

    if (promo.shippingFee === 0) {
        return { label: "Free Shipping", color: "#fff", bg: "#0891b2" };
    }

    // Explicit % discount in discountNote
    if (promo.discountNote) {
        const m = promo.discountNote.match(/(\d+)\s*%\s*(?:off|discount)/i);
        if (m) return { label: `${m[1]}% OFF`, color: "#fff", bg: "#ef4444" };
    }

    return null;
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
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding-bottom: 64px;
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
`;

const PageTitle = styled.h1`
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: var(--foreground);
    line-height: 1.15;
`;

const PageSubtitle = styled.p`
    margin: 0;
    font-size: 14px;
    color: var(--secondary-foreground);
    line-height: 1.4;
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
    transition: filter 0.2s ease, transform 0.2s ease;

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
    background: color-mix(in srgb, ${p => p.color} 15%, transparent);
    color: ${p => p.color};
    flex-shrink: 0;

    svg {
        color: ${p => p.color};
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
    color: ${p => p.color};
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

    svg { color: var(--accent); }
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
        box-shadow: 0 2px 12px color-mix(in srgb, ${(p) => p.accent} 8%, transparent);
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
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
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

    svg { color: var(--accent); }
`;

// ─── Card Badge Tag ───────────────────────────────────────────────────────────

const CardBadgeTag = styled.span<{ bg: string; textColor: string }>`
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: ${(p) => p.bg};
    color: ${(p) => p.textColor};
`;

// ─── Search + Sort ────────────────────────────────────────────────────────────

const SearchSortRow = styled.div`
    display: flex;
    gap: 12px;
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
        height: 54px;
        padding-left: 52px;
        padding-right: 48px;
        border-radius: 14px;
        font-size: 15px;
        background: var(--secondary-background);
        border: 1.5px solid color-mix(in srgb, var(--foreground) 10%, transparent);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &::placeholder {
            color: color-mix(in srgb, var(--foreground) 35%, transparent);
        }

        &:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
            outline: none;
        }
    }

    .search-icon {
        position: absolute;
        left: 18px;
        color: color-mix(in srgb, var(--foreground) 40%, transparent);
        pointer-events: none;
        z-index: 1;
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
    height: 54px;
    padding: 0 36px 0 14px;
    border: 1.5px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 12px;
    background-color: var(--secondary-background);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23848484' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    color: var(--foreground);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    transition: border-color 0.15s ease;

    &:focus {
        border-color: var(--accent);
        outline: none;
    }
`;

// ─── Filter Chips ─────────────────────────────────────────────────────────────

// Horizontally scrollable on mobile so chips don't wrap/overflow
const FilterChipsRow = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;

    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
`;

const FilterChip = styled.button<{ active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    height: 36px;
    border-radius: 100px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
    white-space: nowrap;
    flex-shrink: 0;

    ${(p) =>
        p.active
            ? css`
                  background: var(--accent);
                  color: var(--accent-contrast, #11171c);
                  border: 1.5px solid var(--accent);
                  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent),
                              0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent);
                  transform: translateY(-1px);
              `
            : css`
                  background: transparent;
                  color: color-mix(in srgb, var(--foreground) 55%, transparent);
                  border: 1.5px solid color-mix(in srgb, var(--foreground) 10%, transparent);

                  &:hover {
                      border-color: color-mix(in srgb, var(--accent) 45%, transparent);
                      color: var(--foreground);
                      background: color-mix(in srgb, var(--accent) 7%, transparent);
                      transform: translateY(-1px);
                  }
              `}
`;

// ─── Section Header ───────────────────────────────────────────────────────────

// Thin divider between filter chips and featured section — signals a curated zone
const SectionDivider = styled.hr`
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    margin: 0;
`;

const SectionHeader = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
    margin-top: 8px;
`;

const SectionTitleBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 3px;
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
`;

const SectionSubtitle = styled.p`
    margin: 0;
    font-size: 12px;
    color: var(--tertiary-foreground);
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
    margin-bottom: 16px;
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

// ─── Grid ─────────────────────────────────────────────────────────────────────

const Grid = styled.div`
    column-count: 1;
    column-gap: 20px;

    @media (min-width: 720px) {
        column-count: 2;
    }

    @media (min-width: 1080px) {
        column-count: 3;
    }
`;

// ─── Hot Promos Row ───────────────────────────────────────────────────────────

const HotPromosGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;

    @media (max-width: 1000px) {
        grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 560px) {
        grid-template-columns: 1fr;
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
    gap: 14px;
    padding: 20px;
    border-radius: 16px;
    background: var(--secondary-background);
    border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    break-inside: avoid;
    margin-bottom: 20px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.16), 0 1px 6px rgba(0, 0, 0, 0.08);
        border-color: color-mix(in srgb, var(--foreground) 12%, transparent);
    }
`;

// Featured card variant (used in Hot Promos Today) — same Card but without
// the masonry break-inside so it works in a regular CSS grid.
const FeaturedCard = styled(Card)`
    margin-bottom: 0;
    break-inside: unset;
`;

// ─── Status Badge ─────────────────────────────────────────────────────────────

const badgeColors: Record<Exclude<BadgeType, null>, { bg: string; text: string }> = {
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
`;

const Logo = styled.img`
    width: 42px;
    height: 42px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--primary-background);
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
    }

    .warehouse-row {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--tertiary-foreground);
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
`;

// ─── Promotion Title ──────────────────────────────────────────────────────────

const PromoTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
    line-height: 1.4;
    opacity: 0.85;
`;

// ─── Item Table ───────────────────────────────────────────────────────────────

const ItemTable = styled.div`
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    overflow: hidden;
    background: var(--primary-background);
`;

const ItemRow = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 9px 12px;
    font-size: 13px;

    & + & {
        border-top: 1px solid var(--secondary-background);
    }

    .product {
        font-weight: 600;
        color: var(--foreground);
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

const CompoundChip = styled.span<{ highlighted?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    padding: 5px 9px;
    border-radius: 6px;
    color: ${(p) => (p.highlighted ? "var(--accent-contrast, #11171c)" : "var(--foreground)")};
    background: ${(p) => (p.highlighted ? "var(--accent)" : "var(--primary-background)")};
    transition: background 0.15s ease;

    .count {
        font-size: 10px;
        font-weight: 600;
        color: ${(p) => (p.highlighted ? "var(--accent-contrast, #11171c)" : "var(--tertiary-foreground)")};
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

const ItemToggle = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 9px 12px;
    border: none;
    border-top: 1px solid var(--secondary-background);
    background: var(--primary-background);
    color: var(--accent);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        background: var(--secondary-background);
    }

    svg {
        transition: transform 0.15s ease;
    }

    &[data-expanded="true"] svg {
        transform: rotate(180deg);
    }
`;

const SummaryToggle = styled.button`
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        text-decoration: underline;
    }
`;

// ─── Meta Row ─────────────────────────────────────────────────────────────────

const MetaRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
`;

const Chip = styled.span<{ accent?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    padding: 5px 8px;
    border-radius: 6px;
    white-space: nowrap;
    color: ${(props) =>
        props.accent ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) =>
        props.accent ? "var(--accent)" : "var(--primary-background)"};
`;

// Clamp note text to 2 lines to reduce overload
const NoteText = styled.div`
    font-size: 13px;
    color: var(--secondary-foreground);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

// ─── Gallery ──────────────────────────────────────────────────────────────────

const Gallery = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;

    .hero {
        width: 100%;
        height: clamp(120px, 20vw, 180px);
        border-radius: 10px;
        object-fit: cover;
        cursor: zoom-in;
        background: linear-gradient(
            135deg,
            var(--primary-background) 0%,
            color-mix(in srgb, var(--accent) 6%, var(--primary-background)) 100%
        );
        border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
        transition: transform 0.18s ease, opacity 0.18s ease;

        &:hover {
            transform: scale(1.012);
            opacity: 0.93;
        }
    }

    .thumbs {
        display: flex;
        gap: 6px;
        overflow-x: auto;

        img {
            width: 48px;
            height: 48px;
            border-radius: 7px;
            object-fit: cover;
            flex-shrink: 0;
            cursor: pointer;
            background: linear-gradient(
                135deg,
                var(--primary-background) 0%,
                color-mix(in srgb, var(--accent) 8%, var(--primary-background)) 100%
            );
            transition: opacity 0.15s ease;

            &:hover {
                opacity: 0.82;
            }
        }
    }
`;

// ─── Card Footer ──────────────────────────────────────────────────────────────

const CardFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    margin-top: 4px;
`;

const CountdownText = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--tertiary-foreground);

    svg {
        color: var(--tertiary-foreground);
    }
`;

// Slightly reduced visual weight — integrates into card without dominating
const FooterBtn = styled.div<{ primary?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: filter 0.15s ease, transform 0.15s ease, background 0.15s ease;

    ${(p) =>
        p.primary
            ? css`
                  background: color-mix(in srgb, var(--accent) 90%, transparent);
                  color: var(--accent-contrast, #11171c);

                  & > svg {
                      color: var(--accent-contrast, #11171c);
                  }

                  &:hover {
                      filter: brightness(1.12);
                      transform: translateY(-1px);
                  }
              `
            : css`
                  background: var(--primary-background);
                  color: var(--secondary-foreground);

                  & > svg {
                      color: var(--secondary-foreground);
                  }

                  &:hover {
                      background: color-mix(in srgb, var(--accent) 12%, var(--primary-background));
                      color: var(--foreground);
                  }
              `}
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
        max-width: 360px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--secondary-foreground);
    }

    .cta {
        margin-top: 18px;
    }
`;

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
        border: 2px dashed
            color-mix(in srgb, var(--accent) 45%, transparent);
        animation: promo-spin 18s linear infinite;
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
        animation: promo-bob 3.4s ease-in-out infinite;
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

    @keyframes promo-spin {
        to { transform: rotate(360deg); }
    }

    @keyframes promo-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
    }

    @media (prefers-reduced-motion: reduce) {
        &::before, .float { animation: none; }
    }
`;

// ─── PromoCard component ───────────────────────────────────────────────────────

interface PromoCardProps {
    promo: Promo;
    onOpenImage: (src: string) => void;
    lastVisit: number | null;
    featured?: boolean;
    searchQuery?: string;
}

const PromoCard = observer(({ promo, onOpenImage, lastVisit, featured, searchQuery = "" }: PromoCardProps) => {
    const client = useClient();
    const [expanded, setExpanded] = useState(false);
    const [logoFailed, setLogoFailed] = useState(false);
    const autumn =
        client.configuration?.features.autumn?.url ||
        "https://peptide.chat/autumn";

    const resolveImage = (ref: string) =>
        isUrl(ref) ? ref : `${autumn}/attachments/${ref}`;

    const logoUrl = promo.vendor.logo
        ? `${autumn}/icons/${promo.vendor.logo}?max_side=256`
        : null;

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
    const collapseAt = featured ? FEATURED_COLLAPSE_THRESHOLD : COLLAPSE_THRESHOLD;

    const CardEl = (featured ? FeaturedCard : Card) as typeof Card;

    return (
        <CardEl>
            {/* Card Badge */}
            {(() => {
                const cb = getCardBadge(promo);
                return cb ? (
                    <CardBadgeTag bg={cb.bg} textColor={cb.color}>{cb.label}</CardBadgeTag>
                ) : null;
            })()}

            {/* Card Head: logo + vendor + warehouse + action icon */}
            <CardHead>
                {logoUrl && !logoFailed ? (
                    <Logo
                        src={logoUrl}
                        loading="lazy"
                        onError={() => setLogoFailed(true)}
                    />
                ) : (
                    <LogoFallback>
                        <Store size={22} />
                    </LogoFallback>
                )}
                <VendorMeta>
                    <span className="vendor-name">{highlightText(promo.vendor.name, searchQuery)}</span>
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
                        title={joined ? "Open community" : "Join community"}>
                        {joined ? (
                            <ChevronRight size={18} />
                        ) : (
                            <Plus size={18} />
                        )}
                    </ActionIcon>
                )}
            </CardHead>

            {/* Promotion Title */}
            {promo.title && <PromoTitle>{highlightText(promo.title, searchQuery)}</PromoTitle>}

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
                        const CHIP_LIMIT = 4;
                        const visibleCompounds = compounds.slice(0, CHIP_LIMIT);
                        const hiddenCount = compounds.length - CHIP_LIMIT;
                        return (
                            <ProductSummary>
                                <CompoundChips>
                                    {visibleCompounds.map((c) => {
                                        const isMatched = searchQuery && c.name.toLowerCase().includes(searchQuery.toLowerCase());
                                        return (
                                            <CompoundChip key={c.name} highlighted={!!isMatched}>
                                                {highlightText(c.name, searchQuery)}
                                                {c.count > 1 && (
                                                    <span className="count">×{c.count}</span>
                                                )}
                                            </CompoundChip>
                                        );
                                    })}
                                    {hiddenCount > 0 && (
                                        <MoreChip onClick={() => setExpanded(true)}>
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
                                              it.moqKits ? `${it.moqKits} kits` : null,
                                              it.moqTotal ? money(it.moqTotal) : null,
                                          ]
                                              .filter(Boolean)
                                              .join(" / ")}`
                                        : null;
                                return (
                                    <div key={i}>
                                        <ItemRow>
                                            <span className="product">{highlightText(it.product, searchQuery)}</span>
                                            {it.dosage && (
                                                <span className="dosage">{highlightText(it.dosage, searchQuery)}</span>
                                            )}
                                            {moq && <span className="moq">{moq}</span>}
                                            <span className="price">
                                                {money(it.price)}
                                                <span className="unit">
                                                    {" "}/ {it.unit || "kit"}
                                                </span>
                                            </span>
                                        </ItemRow>
                                        {it.note && <ItemNote>{highlightText(it.note, searchQuery)}</ItemNote>}
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

            {/* Meta chips: shipping, purity, etc */}
            <MetaRow>
                {typeof promo.shippingFee === "number" && (
                    <Chip>
                        {promo.shippingFee === 0
                            ? "Free Shipping"
                            : `Shipping ${money(promo.shippingFee)}`}
                    </Chip>
                )}
                {typeof promo.freeShippingThreshold === "number" && (
                    <Chip>Free over {money(promo.freeShippingThreshold)}</Chip>
                )}
                {g?.purityPct != null && (
                    <Chip>
                        <BadgeCheck size={11} />
                        {g.purityPct}% Purity
                    </Chip>
                )}
                {g?.volumePct != null && (
                    <Chip>
                        <BadgeCheck size={11} />
                        {g.volumePct}% Volume
                    </Chip>
                )}
                {g?.customsReship && (
                    <Chip>
                        <BadgeCheck size={11} />
                        Customs Reship
                    </Chip>
                )}
            </MetaRow>

            {/* Notes */}
            {(promo.discountNote || promo.shippingNote || promo.moqNote || g?.text) && (
                <NoteText>
                    {[
                        promo.discountNote ? highlightText(promo.discountNote, searchQuery) : null,
                        promo.shippingNote ? highlightText(promo.shippingNote, searchQuery) : null,
                        promo.moqNote ? highlightText(promo.moqNote, searchQuery) : null,
                        g?.text ? highlightText(g.text, searchQuery) : null
                    ]
                        .filter(Boolean)
                        .reduce((prev, curr, idx) => (prev === null ? [curr] : [...prev, " · ", curr]), null as any)}
                </NoteText>
            )}

            {/* Images */}
            {promo.images && promo.images.length > 0 && (
                <Gallery>
                    <img
                        className="hero"
                        src={resolveImage(promo.images[0])}
                        loading="lazy"
                        onClick={() => onOpenImage(resolveImage(promo.images![0]))}
                    />
                    {promo.images.length > 1 && (
                        <div className="thumbs">
                            {promo.images.slice(1).map((src, i) => (
                                <img
                                    key={i}
                                    src={resolveImage(src)}
                                    loading="lazy"
                                    onClick={() => onOpenImage(resolveImage(src))}
                                />
                            ))}
                        </div>
                    )}
                </Gallery>
            )}

            {/* Footer: countdown only */}
            <CardFooter>
                <CountdownText>
                    {promo.endDate && isEndingSoon(promo) ? (
                        <>
                            <Time size={13} />
                            Ends in {formatCountdown(promo.endDate)}
                        </>
                    ) : when ? (
                        <>
                            <Calendar size={13} />
                            {highlightText(when, searchQuery)}
                        </>
                    ) : (
                        <span style={{ opacity: 0, userSelect: "none" }}>—</span>
                    )}
                </CountdownText>
            </CardFooter>
        </CardEl>
    );
});

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

    // Track last visit timestamp. Read once on mount, write after render.
    const [lastVisit, setLastVisit] = useState<number | null>(null);
    const allPromosRef = useRef<HTMLDivElement>(null);

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
                        setError("Failed to load promos. Please try again later.");
                        setLoading(false);
                    }
                });
        }

        return () => {
            cancelled = true;
        };
    }, [sort]);

    // Since your last visit counts
    const lastVisitStats = useMemo(() => {
        if (loading || promos.length === 0) return null;
        const lv = lastVisit;
        const newCount = lv ? promos.filter((p) => new Date(p.createdAt).getTime() > lv).length : 0;
        const updatedCount = lv
            ? promos.filter(
                  (p) =>
                      new Date(p.updatedAt).getTime() > lv &&
                      new Date(p.createdAt).getTime() <= lv,
              ).length
            : 0;
        const endingSoonCount = promos.filter((p) => isEndingSoon(p)).length;
        return { newCount, updatedCount, endingSoonCount };
    }, [loading, promos, lastVisit]);

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
                ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
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

    // Filtered promos based on activeFilter and query
    const filtered = useMemo(() => {
        let list = promos;
        if (activeFilter !== "all") {
            list = list.filter((p) => matchesFilter(p, activeFilter, lastVisit));
        }

        const q = query.trim().toLowerCase();
        if (!q) {
            return list;
        }

        return list
            .map((p) => ({ p, score: getSearchScore(p, q) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.p);
    }, [promos, activeFilter, query, lastVisit]);

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
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Hot Promos Today
    const hotPromos = useMemo(() => {
        return [...promos]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 4);
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
        { key: "recentlyUpdated", label: "✨ Recently Updated" },
    ];

    return (
        <Wrapper>
            {/* ── Page Header ─────────────────────────────── */}
            <PageTitleRow>
                <PageTitleBlock>
                    <PageTitle>Promos</PageTitle>
                    <PageSubtitle>Discover promotions from trusted vendors.</PageSubtitle>
                </PageTitleBlock>
                {ownedServers.length > 0 && (
                    <SubmitBtn onClick={() => setSubmitting(true)}>
                        <Tag size={16} />
                        Submit Promo
                    </SubmitBtn>
                )}
            </PageTitleRow>

            {/* ── Overview ─────────────────────────────────── */}
            <OverviewContainer>
                <OverviewTopRow>
                    <OverviewTopLeft>
                        <OverviewSectionLabel>Overview</OverviewSectionLabel>
                        <OverviewSectionSubtitle>
                            See what&apos;s new since your last visit
                        </OverviewSectionSubtitle>
                    </OverviewTopLeft>
                    <OverviewTopRight>
                        <ViewAllUpdatesLink onClick={scrollToAllPromos}>
                            View All Updates
                            <RightArrowAlt size={15} />
                        </ViewAllUpdatesLink>
                    </OverviewTopRight>
                </OverviewTopRow>

                <OverviewStatCardsRow>
                    {/* New Promos */}
                    <OverviewStatCard accent="#22c55e">
                        <StatIconCircle accent="#22c55e">
                            <Store size={20} />
                        </StatIconCircle>
                        <StatCardBody>
                            <StatCardNumber accent="#22c55e">
                                {lastVisitStats?.newCount ?? promos.length}
                            </StatCardNumber>
                            <StatCardLabel>New Promos</StatCardLabel>
                            <StatCardDesc>
                                {lastVisit ? "Added since your last visit" : "Live promos right now"}
                            </StatCardDesc>
                        </StatCardBody>
                    </OverviewStatCard>

                    {/* Recently Updated */}
                    <OverviewStatCard accent="#3b82f6">
                        <StatIconCircle accent="#3b82f6">
                            <Refresh size={20} />
                        </StatIconCircle>
                        <StatCardBody>
                            <StatCardNumber accent="#3b82f6">
                                {lastVisitStats?.updatedCount ?? 0}
                            </StatCardNumber>
                            <StatCardLabel>Recently Updated</StatCardLabel>
                            <StatCardDesc>Updated since your last visit</StatCardDesc>
                        </StatCardBody>
                    </OverviewStatCard>

                    {/* Ending Soon */}
                    <OverviewStatCard accent="#f97316">
                        <StatIconCircle accent="#f97316">
                            <Time size={20} />
                        </StatIconCircle>
                        <StatCardBody>
                            <StatCardNumber accent="#f97316">
                                {lastVisitStats?.endingSoonCount ?? promos.filter(isEndingSoon).length}
                            </StatCardNumber>
                            <StatCardLabel>Ending Soon</StatCardLabel>
                            <StatCardDesc>Promos ending in 72h</StatCardDesc>
                        </StatCardBody>
                    </OverviewStatCard>
                </OverviewStatCardsRow>
            </OverviewContainer>

            {/* ── Search + Sort ──────────────────────────────── */}
            <SearchSortRow>
                <SearchWrapper>
                    <Search size={20} className="search-icon" />
                    <InputBox
                        ref={searchInputRef}
                        palette="secondary"
                        value={inputValue}
                        onInput={(e) => setInputValue(e.currentTarget.value)}
                        onFocus={() => setSearchFocused(true)}
                        placeholder="Search vendors, compounds or promotions..."
                    />
                    {inputValue && (
                        <ClearButton onClick={() => {
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
                                    }}
                                >
                                    <span>{s}</span>
                                    <RecentDeleteBtn 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRecentSearches((prev) => {
                                                const next = prev.filter((item) => item !== s);
                                                safeStorage.set("recent_promo_searches", JSON.stringify(next));
                                                return next;
                                            });
                                        }}
                                    >
                                        <X size={12} />
                                    </RecentDeleteBtn>
                                </RecentItem>
                            ))}
                        </RecentSearchesPopup>
                    )}
                </SearchWrapper>
                <SortSelect
                    value={sort}
                    onChange={(e) => setSort(e.currentTarget.value as Sort)}>
                    <option value="newest">Newest First</option>
                    <option value="endingSoon">Ending Soon</option>
                </SortSelect>
            </SearchSortRow>

            {/* ── Filter Chips ───────────────────────────────── */}
            <FilterChipsRow>
                {filterChips.map((chip) => (
                    <FilterChip
                        key={chip.key}
                        active={activeFilter === chip.key}
                        onClick={() => setActiveFilter(chip.key)}>
                        {chip.label}
                    </FilterChip>
                ))}
            </FilterChipsRow>

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
                <Empty>
                    <Glyph>
                        <Search size={40} />
                    </Glyph>
                    <h3>No matching promos found.</h3>
                    <p>
                        Try a different query or select one of these suggestions:
                    </p>
                    <EmptySuggestions>
                        {["Retatrutide", "Tirzepatide", "WBS", "Free Shipping"].map((term) => (
                            <SuggestionItem key={term} onClick={() => {
                                setInputValue(term);
                                setQuery(term);
                            }}>
                                ✨ Search "{term}"
                            </SuggestionItem>
                        ))}
                    </EmptySuggestions>
                    <div className="cta" style={{ marginTop: 20 }}>
                        <Button
                            compact
                            palette="secondary"
                            onClick={() => {
                                setInputValue("");
                                setQuery("");
                            }}>
                            Clear search
                        </Button>
                    </div>
                </Empty>
            ) : (
                <>
                    {/* ── Hot Promos Today ─────────────────────── */}
                    {hotPromos.length > 0 && activeFilter === "all" && !query && (
                        <div>
                            <SectionDivider />
                            <SectionHeader style={{ marginTop: "8px" }}>
                                <SectionTitleBlock>
                                    <SectionTitle>
                                        🔥 Hot Promos Today
                                    </SectionTitle>
                                    <SectionSubtitle>
                                        Handpicked deals that matter
                                    </SectionSubtitle>
                                </SectionTitleBlock>
                                <SectionViewAll onClick={scrollToAllPromos}>
                                    View all
                                    <RightArrowAlt size={16} />
                                </SectionViewAll>
                            </SectionHeader>
                            <HotPromosGrid>
                                {hotPromos.map((p) => (
                                    <PromoCard
                                        key={p.id}
                                        promo={p}
                                        onOpenImage={setLightbox}
                                        lastVisit={lastVisit}
                                        featured
                                        searchQuery={query}
                                    />
                                ))}
                            </HotPromosGrid>
                        </div>
                    )}

                    {/* ── All Promos ───────────────────────────── */}
                    <div ref={allPromosRef}>
                        <SectionDivider style={{ marginBottom: "20px" }} />
                        <AllPromosHeader>
                            <div>
                                <AllPromosTitle>All Promos</AllPromosTitle>
                                <AllPromosCount>
                                    Showing {filtered.length} promo{filtered.length !== 1 ? "s" : ""}
                                </AllPromosCount>
                            </div>
                        </AllPromosHeader>
                        {allPromos.length > 0 ? (
                            <Grid>
                                {allPromos.map((p) => (
                                    <PromoCard
                                        key={p.id}
                                        promo={p}
                                        onOpenImage={setLightbox}
                                        lastVisit={lastVisit}
                                        searchQuery={query}
                                    />
                                ))}
                            </Grid>
                        ) : (
                            activeFilter !== "all" || query ? (
                                <Centered style={{ marginTop: 16 }}>
                                    All matching promos are featured above.
                                </Centered>
                            ) : null
                        )}
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
        </Wrapper>
    );
};

export default observer(Promos);
