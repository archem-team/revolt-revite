import { useState, useMemo, useEffect } from "preact/hooks";
import { observer } from "mobx-react-lite";
import styled, { css, keyframes } from "styled-components/macro";

import { clientController } from "../../controllers/client/ClientController";

import wideSVG from "/assets/wide.svg";
import styles from "./Directory.module.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
    cc: boolean; btc: boolean; pp: boolean;
    zelle: boolean; venmo: boolean; bt: boolean; chk: boolean;
}
interface Warehouses { us: boolean; eu: boolean; aus: boolean; }
interface Products {
    pep: boolean; oil: boolean; tabs: boolean;
    raw: boolean; amn: boolean; sup: boolean; aas: boolean;
}
interface OrderTypes { single: boolean; halfkit: boolean; fullkit: boolean; }

interface CommunityBase {
    id: string;
    type: "vendor" | "reseller" | "other";
    name: string;
    logo?: string | null;
    inviteLink: string;
    serverId?: string | null;
    ageDays: number;
    verified: boolean;
    memberCount: number;
    onlineCount: number;
    rating: number;
    notes: string;
}

interface VendorCommunity extends CommunityBase {
    type: "vendor";
    url?: string;
    payment: Payment;
    warehouses: Warehouses;
    products: Products;
    orderTypes: null;
    shippingTime: string;
    freeShipping: boolean;
    freeShippingThreshold: string;
}

interface ResellerCommunity extends CommunityBase {
    type: "reseller";
    url?: string;
    payment: Payment;
    warehouses: Warehouses;
    products: Products;
    orderTypes: OrderTypes;
    shippingTime: string;
    freeShipping: boolean;
    freeShippingThreshold: string;
}

interface OtherCommunity extends CommunityBase {
    type: "other";
}

type Community = VendorCommunity | ResellerCommunity | OtherCommunity;
type CommerceCommunity = VendorCommunity | ResellerCommunity;

interface Review {
    id: string; vendorId: string; vendorType: string;
    reviewerName: string; rating: number; text: string; date: string;
}
interface SubmitForm {
    type: "vendor" | "reseller" | "other";
    name: string;
    inviteLink: string;
    serverId: string;
    url: string;
    payment: Payment;
    warehouses: Warehouses;
    products: Products;
    orderTypes: OrderTypes;
    notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<keyof Payment, string> = {
    cc: "CC", btc: "BTC", pp: "PP", zelle: "ZL", venmo: "VM", bt: "BT", chk: "CHK",
};
const WAREHOUSE_LABELS: Record<keyof Warehouses, string> = { us: "US", eu: "EU", aus: "AUS" };
const PRODUCT_LABELS: Record<keyof Products, string> = {
    pep: "PEP", oil: "OIL", tabs: "TABS", raw: "RAW", amn: "AMN", sup: "SUP", aas: "AAS",
};
const ORDER_LABELS: Record<keyof OrderTypes, string> = {
    single: "1V", halfkit: "½K", fullkit: "FK",
};

type FilterKey = "us" | "eu" | "aus" | "cc" | "crypto" | "freeShipping" | "raw" | "oil" | "aas" | "amn" | "sup";

const COMMERCE_FILTERS: { key: FilterKey; label: string; emoji: string }[] = [
    { key: "us", label: "US", emoji: "🇺🇸" },
    { key: "eu", label: "EU", emoji: "🇪🇺" },
    { key: "aus", label: "AU", emoji: "🇦🇺" },
    { key: "cc", label: "Credit Card", emoji: "💳" },
    { key: "crypto", label: "Crypto", emoji: "₿" },
    { key: "freeShipping", label: "Free Ship", emoji: "📦" },
    { key: "raw", label: "Raws", emoji: "🧪" },
    { key: "oil", label: "Oils", emoji: "💧" },
    { key: "aas", label: "AAS", emoji: "⚗️" },
    { key: "amn", label: "Aminos", emoji: "🔬" },
    { key: "sup", label: "Supplies", emoji: "🛒" },
];

const LEGEND = [
    {
        category: "Payment",
        items: [
            { abbr: "CC", label: "Credit Card" }, { abbr: "BTC", label: "Bitcoin / Crypto" },
            { abbr: "PP", label: "PayPal" }, { abbr: "ZL", label: "Zelle" },
            { abbr: "VM", label: "Venmo" }, { abbr: "BT", label: "Bank Transfer" },
            { abbr: "CHK", label: "Check" },
        ],
    },
    {
        category: "Countries",
        items: [
            { abbr: "US", label: "United States" },
            { abbr: "EU", label: "Europe" },
            { abbr: "AUS", label: "Australia" },
        ],
    },
    {
        category: "Products",
        items: [
            { abbr: "PEP", label: "Peptides" }, { abbr: "OIL", label: "Oils" },
            { abbr: "TABS", label: "Tablets" }, { abbr: "RAW", label: "Raw Powder" },
            { abbr: "AMN", label: "Amino Acids" }, { abbr: "SUP", label: "Supplies" },
            { abbr: "AAS", label: "Anabolic-Androgenic Steroids" },
        ],
    },
    {
        category: "Order Types",
        items: [
            { abbr: "1V", label: "Single Vial" },
            { abbr: "½K", label: "Half Kit" },
            { abbr: "FK", label: "Full Kit" },
        ],
    },
];

// ─── Sheet URLs ───────────────────────────────────────────────────────────────

const SHEET_COMMUNITIES = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRIOkigL7Zu8jsYMF0AKu8CAw1az-8EFiAhHCrXBzSASrhQDocU-U5mezf2u08uO_imVvWvmi3rH-NX/pub?gid=0&single=true&output=csv";
const SHEET_REVIEWS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRIOkigL7Zu8jsYMF0AKu8CAw1az-8EFiAhHCrXBzSASrhQDocU-U5mezf2u08uO_imVvWvmi3rH-NX/pub?gid=1967322747&single=true&output=csv";

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (lines.length < 2) return [];
    const headers = splitCSVRow(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = splitCSVRow(line);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h.trim()] = values[idx]?.trim() ?? ""; });
        rows.push(row);
    }
    return rows;
}

function splitCSVRow(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuote = !inQuote;
        } else if (ch === "," && !inQuote) {
            result.push(cur); cur = "";
        } else {
            cur += ch;
        }
    }
    result.push(cur);
    return result;
}

function toBool(v: string): boolean { return v === "TRUE" || v === "true" || v === "1"; }
function toNum(v: string): number { return parseFloat(v) || 0; }

function rowToCommunity(r: Record<string, string>): Community | null {
    const type = r["type"] as "vendor" | "reseller" | "other";
    if (!type || !r["id"]) return null;
    const base: CommunityBase = {
        id: r["id"],
        type,
        name: r["name"] || "",
        logo: r["logo"] || null,
        inviteLink: r["inviteLink"] || "",
        serverId: r["serverId"] || null,
        ageDays: toNum(r["ageDays"]),
        verified: toBool(r["verified"]),
        memberCount: toNum(r["memberCount"]),
        onlineCount: toNum(r["onlineCount"]),
        rating: toNum(r["rating"]),
        notes: r["notes"] || "",
    };
    if (type === "other") return base as OtherCommunity;
    const commerce = {
        ...base,
        url: r["url"] || undefined,
        payment: {
            cc: toBool(r["cc"]), btc: toBool(r["btc"]), pp: toBool(r["pp"]),
            zelle: toBool(r["zelle"]), venmo: toBool(r["venmo"]), bt: toBool(r["bt"]), chk: toBool(r["chk"]),
        },
        warehouses: { us: toBool(r["us"]), eu: toBool(r["eu"]), aus: toBool(r["aus"]) },
        products: {
            pep: toBool(r["pep"]), oil: toBool(r["oil"]), tabs: toBool(r["tabs"]),
            raw: toBool(r["raw"]), amn: toBool(r["amn"]), sup: toBool(r["sup"]), aas: toBool(r["aas"]),
        },
        shippingTime: r["shippingTime"] || "",
        freeShipping: toBool(r["freeShipping"]),
        freeShippingThreshold: r["freeShippingThreshold"] || "",
    };
    if (type === "reseller") {
        return {
            ...commerce,
            type: "reseller",
            orderTypes: {
                single: toBool(r["orderSingle"]),
                halfkit: toBool(r["orderHalfkit"]),
                fullkit: toBool(r["orderFullkit"]),
            },
        } as ResellerCommunity;
    }
    return { ...commerce, type: "vendor", orderTypes: null } as VendorCommunity;
}

function rowToReview(r: Record<string, string>): Review | null {
    if (!r["id"] || !r["vendorId"]) return null;
    return {
        id: r["id"],
        vendorId: r["vendorId"],
        vendorType: r["vendorType"] || "vendor",
        reviewerName: r["reviewerName"] || "Anonymous",
        rating: toNum(r["rating"]) || 5,
        text: r["text"] || "",
        date: r["date"] || "",
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
}

function matchesFilters(c: CommerceCommunity, active: Set<FilterKey>): boolean {
    if (active.size === 0) return true;
    for (const f of active) {
        if (f === "us" && !c.warehouses.us) return false;
        if (f === "eu" && !c.warehouses.eu) return false;
        if (f === "aus" && !c.warehouses.aus) return false;
        if (f === "cc" && !c.payment.cc) return false;
        if (f === "crypto" && !c.payment.btc) return false;
        if (f === "freeShipping" && !c.freeShipping) return false;
        if (f === "raw" && !c.products.raw) return false;
        if (f === "oil" && !c.products.oil) return false;
        if (f === "aas" && !c.products.aas) return false;
        if (f === "amn" && !c.products.amn) return false;
        if (f === "sup" && !c.products.sup) return false;
    }
    return true;
}

function toggle<T extends object>(obj: T, key: keyof T): T {
    return { ...obj, [key]: !obj[key] };
}

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
`;

// ─── Color helpers ────────────────────────────────────────────────────────────

const ac = (a: number) => `rgba(0,119,182,${a})`;
const cy = (a: number) => `rgba(0,180,216,${a})`;
const gr = (a: number) => `rgba(16,185,129,${a})`;
const pu = (a: number) => `rgba(144,224,239,${a})`;
const or = (a: number) => `rgba(250,163,82,${a})`;
const bk = (a: number) => `rgba(0,0,0,${a})`;

const DIR_ACCENT = "#0077b6";

// ─── Page wrapper ─────────────────────────────────────────────────────────────

const Page = styled.div<{ $dark?: boolean }>`
    height: 100%;
    width: 100%;
    max-width: 100vw;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    font-family: var(--font, "Inter", "Open Sans"), sans-serif;
    font-size: 14px;
    -webkit-tap-highlight-color: transparent;

    --dir-accent:          #0077b6;
    --background:          #caf0f8;
    --primary-background:  #FFFFFF;
    --secondary-background:#e8f8fc;
    --foreground:          #03045e;
    --secondary-foreground:#0077b6;
    --tertiary-foreground: #00b4d8;
    --block:               rgba(0,119,182,0.18);
    --success:             #10B981;
    --warning:             #F59E0B;
    --error:               #EF4444;

    --dir-surface-nav:    #03045e;
    --dir-surface-card:   #FFFFFF;
    --dir-surface-modal:  rgba(255,255,255,0.97);
    --dir-surface-table:  #f0fafd;
    --dir-surface-thead:  #ddf3fa;
    --dir-row-hover:      #e2f5fb;
    --dir-hero-from:      #03045e;
    --dir-hero-mid:       #0077b6;
    --dir-hero-to:        #00b4d8;
    --dir-border-nav:     rgba(0,180,216,0.25);
    --dir-border-card:    rgba(0,180,216,0.2);
    --dir-border-table:   rgba(0,119,182,0.18);
    --dir-thead-color:    #0077b6;
    --dir-overlay-sm:     rgba(0,0,0,0.03);
    --dir-overlay-md:     rgba(0,0,0,0.07);
    --dir-overlay-lg:     rgba(0,0,0,0.12);
    --dir-modal-shadow:   0 8px 40px rgba(0,119,182,0.18), 0 2px 8px rgba(0,0,0,0.08);

    ${(p) => p.$dark && css`
        --background:          #01060f;
        --primary-background:  #031d33;
        --secondary-background:#042540;
        --foreground:          #caf0f8;
        --secondary-foreground:#90e0ef;
        --tertiary-foreground: rgba(144,224,239,0.55);
        --block:               rgba(0,180,216,0.22);
        --success:             #34d399;
        --warning:             #fbbf24;

        --dir-surface-nav:    #010c1a;
        --dir-surface-card:   #031d33;
        --dir-surface-modal:  rgba(3,29,51,0.98);
        --dir-surface-table:  #031d33;
        --dir-surface-thead:  #042540;
        --dir-row-hover:      #053050;
        --dir-hero-from:      #010c1a;
        --dir-hero-mid:       #03045e;
        --dir-hero-to:        #0077b6;
        --dir-border-nav:     rgba(0,180,216,0.2);
        --dir-border-card:    rgba(0,180,216,0.15);
        --dir-border-table:   rgba(0,180,216,0.12);
        --dir-thead-color:    #90e0ef;
        --dir-overlay-sm:     rgba(255,255,255,0.04);
        --dir-overlay-md:     rgba(255,255,255,0.08);
        --dir-overlay-lg:     rgba(255,255,255,0.14);
        --dir-modal-shadow:   0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
    `}

    background: var(--background);
    color: var(--foreground);

    scrollbar-width: thin;
    scrollbar-color: ${cy(0.5)} transparent;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: ${cy(0.5)}; border-radius: 2px; }
    &::-webkit-scrollbar-track { background: transparent; }
`;

// ─── Header ───────────────────────────────────────────────────────────────────

const Header = styled.header`
    background: var(--dir-surface-nav);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--dir-border-nav);
    padding: 0 24px;
    height: 56px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
    min-width: 0;

    @media (max-width: 1024px) { padding: 0 18px; }
    @media (max-width: 768px) { padding: 0 14px; gap: 10px; }
    @media (max-width: 480px) { padding: 0 12px; gap: 8px; }
`;

const LogoImg = styled.img`
    height: 22px;
    display: block;
    flex-shrink: 0;
    @media (max-width: 360px) { height: 19px; }
`;

const DirectoryBadge = styled.span`
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: 20px;
    background: ${cy(0.15)};
    color: #90e0ef;
    border: 1px solid ${cy(0.3)};
    flex-shrink: 0;
    @media (max-width: 500px) { display: none; }
`;

const HeaderSpacer = styled.div`flex: 1; min-width: 8px;`;

const HeaderNav = styled.nav`
    display: flex;
    align-items: center;
    gap: 8px;
    @media (max-width: 500px) { gap: 6px; }
`;

const NavBtn = styled.a<{ $primary?: boolean }>`
    && {
        padding: 7px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none !important;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        line-height: 1;

        ${(p) =>
        p.$primary
            ? css`
                background: var(--dir-accent);
                color: #fff !important;
                border: 1px solid var(--dir-accent);
                &:hover { filter: brightness(1.1); box-shadow: 0 4px 14px ${ac(0.4)}; text-decoration: none !important; }
            `
            : css`
                background: transparent;
                color: rgba(202,240,248,0.8) !important;
                border: 1px solid rgba(255,255,255,0.15);
                &:hover { background: rgba(255,255,255,0.08); color: #ffffff !important; border-color: rgba(255,255,255,0.3); text-decoration: none !important; }
            `}

        @media (max-width: 380px) { padding: 6px 12px; font-size: 12px; }
    }
`;

const DesktopAuthGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    @media (max-width: 500px) { display: none; }
`;

const MobileAuthBtn = styled.a`
    && {
        display: none;
        padding: 7px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none !important;
        cursor: pointer;
        white-space: nowrap;
        background: var(--dir-accent);
        color: #fff !important;
        border: 1px solid var(--dir-accent);
        transition: all 0.15s;
        &:hover { filter: brightness(1.1); }
        @media (max-width: 500px) { display: inline-flex; align-items: center; }
    }
`;

// ─── Hero ─────────────────────────────────────────────────────────────────────

const Hero = styled.section`
    background: linear-gradient(160deg, var(--dir-hero-from) 0%, var(--dir-hero-mid) 58%, var(--dir-hero-to) 100%);
    padding: clamp(28px, 6vw, 48px) clamp(14px, 4vw, 24px) clamp(28px, 5vw, 40px);
    text-align: center;
    position: relative;
    overflow: hidden;
    border-bottom: none;

    @media (max-width: 480px) {
        padding-left: max(14px, env(safe-area-inset-left, 0px));
        padding-right: max(14px, env(safe-area-inset-right, 0px));
    }

    @media (max-height: 480px) and (orientation: landscape) {
        padding-top: 20px;
        padding-bottom: 20px;
    }

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px);
        background-size: 24px 24px;
        pointer-events: none;
        z-index: 0;
    }

    &::after {
        content: '';
        position: absolute;
        bottom: -80px;
        left: 50%;
        transform: translateX(-50%);
        width: min(700px, 100vw);
        height: 400px;
        background: radial-gradient(ellipse at 50% 80%, ${cy(0.35)} 0%, ${ac(0.12)} 50%, transparent 75%);
        pointer-events: none;
        z-index: 0;
    }
`;

const HeroInner = styled.div`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    max-width: min(560px, 100%);
    margin: 0 auto;
    box-sizing: border-box;
    padding: 0 clamp(0px, 2vw, 4px);
    @media (max-width: 480px) { gap: 14px; padding: 0; }
`;

const HeroTitle = styled.h1`
    font-size: clamp(1.1875rem, 0.5rem + 4.2vw, 1.75rem);
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1.2;
    margin: 0;
    color: #ffffff;
    span { color: #90e0ef; }
    @media (max-width: 480px) { letter-spacing: -0.35px; }
`;

const HeroSub = styled.p`
    font-size: clamp(0.8125rem, 0.72rem + 0.35vw, 0.875rem);
    color: rgba(202,240,248,0.85);
    margin: 0;
    line-height: 1.6;
    max-width: min(440px, 100%);
    width: 100%;
    box-sizing: border-box;
`;

const TabToggle = styled.div`
    display: inline-flex;
    background: rgba(3,4,94,0.4);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 7px;
    padding: 3px;
    gap: 3px;
    max-width: 100%;
    box-sizing: border-box;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    @media (max-width: 400px) { width: 100%; justify-content: stretch; }
`;

const ToggleTab = styled.button<{ $active: boolean }>`
    padding: 7px 22px;
    border-radius: 5px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.15s;
    background: ${(p) => (p.$active ? "#ffffff" : "transparent")};
    color: ${(p) => (p.$active ? "#03045e" : "rgba(202,240,248,0.75)")};
    box-shadow: ${(p) => (p.$active ? "0 2px 10px rgba(0,0,0,0.2)" : "none")};

    &:hover {
        background: ${(p) => (p.$active ? "#ffffff" : "rgba(255,255,255,0.1)")};
        color: ${(p) => (p.$active ? "#03045e" : "#ffffff")};
    }

    @media (max-width: 480px) { padding: 7px 14px; font-size: 13px; }
    @media (max-width: 400px) { flex: 1; padding: 8px 8px; font-size: 12px; }
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

const Main = styled.main`
    max-width: 1440px;
    margin: 0 auto;
    padding: clamp(18px, 2.5vw, 28px) clamp(12px, 3.5vw, 28px) 60px;
    width: 100%;
    box-sizing: border-box;

    @media (max-width: 767px) {
        padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px));
    }

    @media (max-width: 480px) {
        padding-left: max(12px, env(safe-area-inset-left, 0px));
        padding-right: max(12px, env(safe-area-inset-right, 0px));
    }
`;

const SectionHeader = styled.div`
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 18px;
    flex-wrap: wrap;

    h2 {
        font-size: clamp(1rem, 0.92rem + 0.35vw, 1.0625rem);
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.2px;
        color: var(--foreground);
    }
    .count { font-size: 13px; color: var(--tertiary-foreground); }

    @media (max-width: 480px) { margin-bottom: 14px; h2 { font-size: 16px; } }
`;

// ─── Filter ───────────────────────────────────────────────────────────────────

const FilterWrap = styled.div`
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    align-items: center;
    @media (max-width: 767px) { gap: 8px; }
`;

const SearchWrap = styled.label`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid var(--block);
    background: var(--secondary-background);
    width: 240px;
    flex-shrink: 0;
    box-sizing: border-box;
    transition: border-color 0.14s;
    &:focus-within { border-color: var(--dir-accent); }
    .icon { font-size: 13px; opacity: 0.45; flex-shrink: 0; }

    @media (max-width: 1024px) { flex: 1 1 200px; width: auto; min-width: 0; max-width: min(360px, 100%); }
    @media (max-width: 767px) { flex: 1 1 100%; width: 100%; max-width: none; }
`;

const SearchInput = styled.input`
    flex: 1;
    padding: 8px 0;
    border: none;
    background: transparent;
    color: var(--foreground);
    font-size: 13px;
    font-family: inherit;
    &::placeholder { color: var(--tertiary-foreground); }
    &:focus { outline: none; }
`;

const FilterPills = styled.div`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    flex: 1;
    min-width: 0;
    @media (max-width: 767px) { flex: 1 1 100%; }
`;

const Pill = styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 11px;
    border-radius: 6px;
    border: 1px solid ${(p) => (p.$active ? "var(--dir-accent)" : "var(--block)")};
    background: ${(p) => (p.$active ? ac(0.12) : "transparent")};
    color: ${(p) => (p.$active ? "var(--dir-accent)" : "var(--secondary-foreground)")};
    font-size: 12px;
    font-weight: ${(p) => (p.$active ? 600 : 400)};
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s;
    &:hover { border-color: var(--dir-accent); color: var(--dir-accent); background: ${ac(0.07)}; }
    @media (max-width: 480px) { min-height: 36px; padding: 6px 12px; }
`;

const ClearBtn = styled.button`
    padding: 5px 10px;
    border: none;
    background: none;
    color: var(--tertiary-foreground);
    font-size: 12px;
    cursor: pointer;
    transition: color 0.12s;
    &:hover { color: var(--dir-accent); }
`;

const LegendToggle = styled.button`
    padding: 5px 12px;
    border: 1px solid var(--block);
    border-radius: 6px;
    background: transparent;
    color: var(--tertiary-foreground);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s;
    &:hover { border-color: var(--secondary-foreground); color: var(--foreground); }
    @media (max-width: 767px) { flex: 0 0 auto; align-self: flex-start; }
`;

const LegendBox = styled.div`
    background: var(--dir-surface-card);
    border: 1px solid var(--dir-border-card);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 18px 22px;
    margin-bottom: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    animation: ${fadeUp} 0.18s ease both;

    @media (max-width: 767px) { padding: 14px 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 140px), 1fr)); gap: 12px; }
    @media (max-width: 380px) { grid-template-columns: 1fr; }
`;

const LegendCat = styled.div`
    h4 { font-size: 10px; font-weight: 700; color: var(--dir-accent); text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    li {
        font-size: 12px;
        color: var(--secondary-foreground);
        display: flex;
        gap: 8px;
        span { font-weight: 700; color: var(--foreground); min-width: 30px; }
    }
`;

// ─── Badges ───────────────────────────────────────────────────────────────────

type BV = "accent" | "green" | "purple" | "orange" | "dim" | "teal" | "red";

const bv: Record<BV, ReturnType<typeof css>> = {
    accent: css`background:${ac(0.12)};color:var(--dir-accent);border-color:${ac(0.28)};`,
    green: css`background:${gr(0.1)};color:var(--success);border-color:${gr(0.25)};`,
    purple: css`background:${cy(0.1)};color:#00b4d8;border-color:${cy(0.25)};`,
    orange: css`background:${or(0.1)};color:var(--warning);border-color:${or(0.25)};`,
    dim: css`background:var(--dir-overlay-sm);color:var(--tertiary-foreground);border-color:var(--block);`,
    teal: css`background:rgba(0,180,216,0.15);color:#00b4d8;border-color:rgba(0,180,216,0.4);`,
    red: css`background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.3);`,
};

const Badge = styled.span<{ $v?: BV }>`
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
    white-space: nowrap;
    ${(p) => bv[p.$v ?? "dim"]}
`;

const BadgeRow = styled.div`display: flex; gap: 4px; flex-wrap: wrap;`;

// ─── Stars ────────────────────────────────────────────────────────────────────

const Stars = styled.span`color: var(--warning); font-size: 12px; letter-spacing: 0.5px;`;
const StarNum = styled.span`font-size: 12px; font-weight: 700; color: var(--warning); margin-left: 3px;`;

// ─── Community Card header row ────────────────────────────────────────────────

const CommunityMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 5px;
    font-size: 11.5px;
    color: var(--secondary-foreground);
`;

const MetaItem = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
`;

const JoinBtn = styled.a`
    && {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 700;
        background: var(--dir-accent);
        color: #fff !important;
        text-decoration: none !important;
        border: none;
        transition: filter 0.13s;
        white-space: nowrap;
        cursor: pointer;
        &:hover { filter: brightness(1.15); }
    }
`;

// ─── Cards ────────────────────────────────────────────────────────────────────

const CardGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 12px;

    @media (min-width: 481px) and (max-width: 767px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 480px) {
        grid-template-columns: 1fr;
        gap: 10px;
    }
`;

const Card = styled.div`
    background: var(--dir-surface-card);
    border: 1px solid var(--dir-border-card);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 2px 8px ${ac(0.06)};
    &:hover { border-color: ${cy(0.6)}; transform: translateY(-3px); box-shadow: 0 10px 32px ${ac(0.12)}; }
`;

const CardHead = styled.div`
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    user-select: none;
    &:hover { background: var(--dir-overlay-sm); }
`;

const CardLeft = styled.div`flex: 1; min-width: 0;`;

const CardName = styled.div`
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const CardRight = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
    flex-shrink: 0;
`;

const Chevron = styled.span<{ $open: boolean }>`
    font-size: 10px;
    color: var(--tertiary-foreground);
    transition: transform 0.18s;
    transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
    display: inline-block;
`;

const CardDivider = styled.div`height: 1px; background: var(--dir-overlay-md); margin: 0 16px;`;

const CardBody = styled.div<{ $open: boolean }>`
    display: ${(p) => (p.$open ? "block" : "none")};
    padding: 14px 16px;
    animation: ${fadeUp} 0.15s ease both;
`;

const SectionLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    color: var(--dir-accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 12px 0 6px;
    &:first-child { margin-top: 0; }
`;

const InfoLine = styled.div`
    font-size: 12px;
    color: var(--secondary-foreground);
    margin-bottom: 4px;
    line-height: 1.5;
    strong { color: var(--foreground); font-weight: 600; }
`;


// ─── Desktop Table ────────────────────────────────────────────────────────────

const TableWrap = styled.div`
    border: 1px solid var(--dir-border-table);
    border-radius: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    background: var(--dir-surface-table);
    box-shadow: 0 2px 16px ${ac(0.07)};

    @media (min-width: 768px) {
        scrollbar-width: thin;
        scrollbar-color: ${cy(0.4)} transparent;
        &::-webkit-scrollbar { height: 4px; }
        &::-webkit-scrollbar-thumb { background: ${cy(0.4)}; border-radius: 2px; }
    }
`;

const Table = styled.table`
    width: 100%;
    min-width: 900px;
    border-collapse: collapse;
    font-size: 13px;

    @media (max-width: 1200px) { font-size: 12px; th, td { padding: 9px 10px; } }

    th {
        padding: 11px 13px;
        text-align: left;
        font-size: 10px;
        font-weight: 700;
        color: var(--dir-thead-color);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        background: var(--dir-surface-thead);
        border-bottom: 1px solid var(--dir-border-table);
        transition: color 0.12s;
        &:hover { color: var(--foreground); }
    }

    td {
        padding: 10px 13px;
        border-top: 1px solid var(--dir-border-table);
        vertical-align: middle;
        background: var(--dir-surface-table);
    }

    tbody tr:hover td { background: var(--dir-row-hover); }
`;

const TableName = styled.div`
    font-weight: 700;
    font-size: 13px;
    color: var(--foreground);
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 1px;

    .verified {
        font-size: 11px;
        color: #00b4d8;
        font-weight: 700;
        flex-shrink: 0;
    }
`;
const TableUrl = styled.a`
    display: block;
    font-size: 11px;
    color: var(--tertiary-foreground) !important;
    text-decoration: none !important;
    margin-bottom: 5px;
    &:hover { color: var(--dir-accent) !important; }
`;
const TableMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--secondary-foreground);
    flex-wrap: nowrap;
    white-space: nowrap;

    .sep { color: var(--block); user-select: none; }
    .online { color: var(--success); }
`;

// ─── Empty State ──────────────────────────────────────────────────────────────


function Directory() {
    const {
        tab, search, setSearch, activeFilters, setActiveFilters, sortCol, sortDir,
        loading, loadError, showLegend, setShowLegend, showFilters, setShowFilters,
        reviewModal, setReviewModal, submitOpen, setSubmitOpen,
        submitInitialType, darkMode, setDarkMode,
        filtered, reviews, openSubmit, toggleFilter, handleSort, switchTab,
        reviewCount, handleSubmitReview, handleSubmitListing,
    } = useDirectory();

    const si = (col: "rating" | "name") => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    const loggedIn = clientController.isLoggedIn();

    return (
        <Page $dark={darkMode}>
            {/* ── Header ── */}
            <Header>
                <LogoImg src={wideSVG} alt="PepChat" draggable={false} />
                <DirectoryBadge>Directory</DirectoryBadge>
                <HeaderSpacer />
                <NavSubmitGroup>
                    <NavSubmitBtn onClick={() => openSubmit("vendor")}>+ Vendor</NavSubmitBtn>
                    <NavSubmitBtn onClick={() => openSubmit("reseller")}>+ Reseller</NavSubmitBtn>
                </NavSubmitGroup>
                <ThemeToggle onClick={() => setDarkMode((d) => !d)} title={darkMode ? "Light mode" : "Dark mode"}>
                    {darkMode ? "☀" : "☾"}
                </ThemeToggle>
                <NavDivider />
                <HeaderNav>
                    {loggedIn ? (
                        <NavBtn href="/" $primary>Open Chat</NavBtn>
                    ) : (
                        <>
                            <DesktopAuthGroup>
                                <NavBtn href="/login">Log In</NavBtn>
                                <NavBtn href="/login/create" $primary>Register</NavBtn>
                            </DesktopAuthGroup>
                            <MobileAuthBtn href="/login">Login</MobileAuthBtn>
                        </>
                    )}
                </HeaderNav>
            </Header>


            {/* ── Main ── */}
            <Main>
                <div style={{ marginBottom: "var(--space-4)" }}>
                    <TabToggle>
                        <ToggleTab $active={tab === "vendors"} onClick={() => switchTab("vendors")}>
                            Vendors
                        </ToggleTab>
                        <ToggleTab $active={tab === "resellers"} onClick={() => switchTab("resellers")}>
                            Resellers
                        </ToggleTab>
                        <ToggleTab $active={tab === "other"} onClick={() => switchTab("other")}>
                            Other
                        </ToggleTab>
                    </TabToggle>
                </div>

                {/* Filters — commerce tabs only */}
                <FilterWrap>
                    <SearchWrap>
                        <span className="icon">🔍</span>
                        <SearchInput
                            value={search}
                            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                            placeholder="Search communities..."
                        />
                    </SearchWrap>
                    {tab !== "other" && (
                        <FilterToggleBtn
                            onClick={() => setShowFilters(!showFilters)}
                            $active={showFilters}
                            title="Filters"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V6.58579C21 6.851 20.8946 7.10536 20.7071 7.29289L14.2929 13.7071C14.1054 13.8946 14 14.149 14 14.4142V19.5528C14 19.818 13.8946 20.0724 13.7071 20.2599L10.7071 23.2599C10.3166 23.6505 9.68342 23.6505 9.29289 23.2599C9.10536 23.0724 9 22.818 9 22.5528V14.4142C9 14.149 8.89464 13.8946 8.70711 13.7071L2.29289 7.29289C2.10536 7.10536 2 6.851 2 6.58579V4C2 3.44772 2.44772 3 3 3Z" />
                            </svg>
                        </FilterToggleBtn>
                    )}
                    <MobileBreak />
                    {tab !== "other" && (
                        <FilterPills $showMobile={showFilters}>
                            {COMMERCE_FILTERS.map((f) => (
                                <Pill key={f.key} $active={activeFilters.has(f.key)} onClick={() => toggleFilter(f.key)}>
                                    {f.key === "us" || f.key === "eu" || f.key === "aus"
                                        ? f.label
                                        : `${f.emoji} ${f.label}`}
                                </Pill>
                            ))}
                            {activeFilters.size > 0 && (
                                <ClearBtn onClick={() => setActiveFilters(new Set())}>
                                    ✕ Clear ({activeFilters.size})
                                </ClearBtn>
                            )}
                        </FilterPills>
                    )}
                    <LegendToggle onClick={() => setShowLegend((s) => !s)}>
                        {showLegend ? "Hide Legend" : "? Legend"}
                    </LegendToggle>
                </FilterWrap>

                {showLegend && (
                    <LegendBox>
                        {LEGEND.map((cat) => (
                            <LegendCat key={cat.category}>
                                <h4>{cat.category}</h4>
                                <ul>
                                    {cat.items.map((item) => (
                                        <li key={item.abbr}><span>{item.abbr}</span>{item.label}</li>
                                    ))}
                                </ul>
                            </LegendCat>
                        ))}
                    </LegendBox>
                )}

                {/* Listings */}
                {loading ? (
                    <EmptyState>
                        <span className="icon" style={{ fontSize: "var(--font-size-title-1)", animation: "spin 1s linear infinite" }}>⟳</span>
                        Loading directory…
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </EmptyState>
                ) : loadError ? (
                    <EmptyState>
                        <span className="icon">⚠️</span>
                        Failed to load directory data. Please refresh and try again.
                    </EmptyState>
                ) : filtered.length === 0 ? (
                    <EmptyState>
                        <span className="icon">🔍</span>
                        No communities match your search or filters.
                    </EmptyState>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <TableWrap className={styles.desktopTable}>
                            <Table>
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort("rating")}>Rating{si("rating")}</th>
                                        <th onClick={() => handleSort("name")}>Name{si("name")}</th>
                                        {tab !== "other" && (
                                            <>
                                                <th>Payment</th>
                                                <th>Countries</th>
                                                <th>Products</th>
                                                <th>Guarantee</th>
                                                {tab === "resellers" && <th>Order Types</th>}
                                                <th>Free Ship</th>
                                                <th>Ship Time</th>
                                            </>
                                        )}
                                        {tab === "other" && <th>About</th>}
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((c) => (
                                        <CommunityRow
                                            key={c.id}
                                            community={c}
                                            reviewCount={reviewCount(c.id, c.type)}
                                            isReseller={tab === "resellers"}
                                            onReview={() => setReviewModal(c)}
                                        />
                                    ))}
                                </tbody>
                            </Table>
                        </TableWrap>

                        {/* Mobile Cards */}
                        <CardGrid className={styles.mobileCards}>
                            {filtered.map((c) => (
                                <CommunityCard
                                    key={c.id}
                                    community={c}
                                    reviewCount={reviewCount(c.id, c.type)}
                                    onReview={() => setReviewModal(c)}
                                />
                            ))}
                        </CardGrid>
                    </>
                )}
            </Main>

            <BottomNav className={styles.mobileNav}>
                <BottomTab $active={tab === "vendors"} onClick={() => switchTab("vendors")}>Vendors</BottomTab>
                <BottomTab $active={tab === "resellers"} onClick={() => switchTab("resellers")}>Resellers</BottomTab>
                <BottomTab $active={tab === "other"} onClick={() => switchTab("other")}>Other</BottomTab>
            </BottomNav>

            <FAB onClick={() => setSubmitOpen(true)}>+</FAB>

            {/* ── Modals ── */}
            {reviewModal && (
                <ReviewsModal
                    community={reviewModal}
                    reviews={reviews.filter(
                        (r) => r.vendorId === reviewModal.id && r.vendorType === reviewModal.type,
                    )}
                    onClose={() => setReviewModal(null)}
                    onSubmit={handleSubmitReview}
                />
            )}

            {submitOpen && (
                <SubmitModal
                    onClose={() => setSubmitOpen(false)}
                    onSubmit={handleSubmitListing}
                    initialType={submitInitialType}
                />
            )}
        </Page>
    );
}

export default observer(Directory);
