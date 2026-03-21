import { useState, useMemo } from "preact/hooks";
import { observer } from "mobx-react-lite";
import styled, { css, keyframes } from "styled-components/macro";

import { clientController } from "../../controllers/client/ClientController";

import wideSVG from "/assets/wide.svg";
import rawData from "./data.json";
import styles from "./Directory.module.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
    cc: boolean; btc: boolean; pp: boolean;
    zelle: boolean; venmo: boolean; bt: boolean; chk: boolean;
}
interface Warehouses { us: boolean; eu: boolean; aus: boolean; }
interface Products {
    pep: boolean; oil: boolean; tabs: boolean;
    raw: boolean; amn: boolean; sup: boolean;
}
interface OrderTypes { single: boolean; halfkit: boolean; fullkit: boolean; }
interface Vendor {
    id: string; name: string; url: string; rating: number;
    payment: Payment; warehouses: Warehouses; products: Products;
    shippingRoutes: string; shippingTime: string;
    freeShipping: boolean; freeShippingThreshold: string; notes: string;
}
interface Reseller extends Vendor { orderTypes: OrderTypes; }
interface Review {
    id: string; vendorId: string; vendorType: string;
    reviewerName: string; rating: number; text: string; date: string;
}
interface SubmitForm {
    type: "vendor" | "reseller"; name: string; url: string;
    payment: Payment; warehouses: Warehouses; products: Products;
    orderTypes: OrderTypes; notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<keyof Payment, string> = {
    cc: "CC", btc: "BTC", pp: "PP", zelle: "ZL", venmo: "VM", bt: "BT", chk: "CHK",
};
const WAREHOUSE_LABELS: Record<keyof Warehouses, string> = { us: "US", eu: "EU", aus: "AUS" };
const PRODUCT_LABELS: Record<keyof Products, string> = {
    pep: "PEP", oil: "OIL", tabs: "TABS", raw: "RAW", amn: "AMN", sup: "SUP",
};
const ORDER_LABELS: Record<keyof OrderTypes, string> = {
    single: "1V", halfkit: "½K", fullkit: "FK",
};

type FilterKey = "us" | "eu" | "aus" | "cc" | "crypto" | "freeShipping" | "raw" | "oil" | "amn" | "sup";

const FILTERS: { key: FilterKey; label: string; emoji: string }[] = [
    { key: "us", label: "US", emoji: "🇺🇸" },
    { key: "eu", label: "EU", emoji: "🇪🇺" },
    { key: "aus", label: "AU", emoji: "🇦🇺" },
    { key: "cc", label: "Credit Card", emoji: "💳" },
    { key: "crypto", label: "Crypto", emoji: "₿" },
    { key: "freeShipping", label: "Free Ship", emoji: "📦" },
    { key: "raw", label: "Raws", emoji: "🧪" },
    { key: "oil", label: "Oils", emoji: "💧" },
    { key: "amn", label: "Aminos", emoji: "⚗️" },
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
        category: "Warehouses",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchesFilters(v: Vendor, active: Set<FilterKey>): boolean {
    if (active.size === 0) return true;
    for (const f of active) {
        if (f === "us" && !v.warehouses.us) return false;
        if (f === "eu" && !v.warehouses.eu) return false;
        if (f === "aus" && !v.warehouses.aus) return false;
        if (f === "cc" && !v.payment.cc) return false;
        if (f === "crypto" && !v.payment.btc) return false;
        if (f === "freeShipping" && !v.freeShipping) return false;
        if (f === "raw" && !v.products.raw) return false;
        if (f === "oil" && !v.products.oil) return false;
        if (f === "amn" && !v.products.amn) return false;
        if (f === "sup" && !v.products.sup) return false;
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
// Palette: #03045e · #0077b6 · #00b4d8 · #90e0ef · #caf0f8
// Accent  = #0077b6 (ocean blue)   Cyan  = #00b4d8
// Success = #10B981 (emerald)      Warning = #F59E0B

const ac = (a: number) => `rgba(0,119,182,${a})`;     // primary accent  — #0077b6
const cy = (a: number) => `rgba(0,180,216,${a})`;     // secondary cyan  — #00b4d8
const gr = (a: number) => `rgba(16,185,129,${a})`;    // success / emerald
const pu = (a: number) => `rgba(144,224,239,${a})`;   // sky blue        — #90e0ef
const or = (a: number) => `rgba(250,163,82,${a})`;    // warning / orange
const bk = (a: number) => `rgba(0,0,0,${a})`;         // black alpha (light surface borders)

// Directory-scoped accent (ocean blue)
const DIR_ACCENT = "#0077b6";

// ─── Page wrapper ─────────────────────────────────────────────────────────────
// Must be scrollable inside the global `#app { position:fixed; height:100% }`

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

    /* ── Light mode — palette: #03045e · #0077b6 · #00b4d8 · #90e0ef · #caf0f8 ── */
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

    /* Surface tokens (light) */
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

    /* ── Dark mode overrides ── */
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

    @media (max-width: 1024px) {
        padding: 0 18px;
    }

    @media (max-width: 768px) {
        padding: 0 14px;
        gap: 10px;
    }

    @media (max-width: 480px) {
        padding: 0 12px;
        gap: 8px;
    }
`;

const LogoImg = styled.img`
    height: 22px;
    display: block;
    flex-shrink: 0;

    @media (max-width: 360px) {
        height: 19px;
    }
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

    @media (max-width: 500px) {
        display: none;
    }
`;

const HeaderSpacer = styled.div`
    flex: 1;
    min-width: 8px;
`;

const HeaderNav = styled.nav`
    display: flex;
    align-items: center;
    gap: 8px;

    @media (max-width: 500px) {
        gap: 6px;
    }
`;

// Use styled.a — styled(Link) drops children in the Preact/React-router setup.
// Use && to beat global `a { color: var(--accent) }` specificity.
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
                      &:hover {
                          filter: brightness(1.1);
                          box-shadow: 0 4px 14px ${ac(0.4)};
                          text-decoration: none !important;
                      }
                  `
            : css`
                      background: transparent;
                      color: rgba(202,240,248,0.8) !important;
                      border: 1px solid rgba(255,255,255,0.15);
                      &:hover {
                          background: rgba(255,255,255,0.08);
                          color: #ffffff !important;
                          border-color: rgba(255,255,255,0.3);
                          text-decoration: none !important;
                      }
                  `}

        @media (max-width: 380px) {
            padding: 6px 12px;
            font-size: 12px;
        }
    }
`;

// Wrapper that hides desktop auth pair on mobile
const DesktopAuthGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    @media (max-width: 500px) { display: none; }
`;

// Single combined auth button shown only on mobile
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

    /* Dot grid — white on dark, covers entire section */
    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px);
        background-size: 24px 24px;
        pointer-events: none;
        z-index: 0;
    }

    /* Cyan radial bloom */
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

    @media (max-width: 480px) {
        gap: 14px;
        padding: 0;
    }
`;

// HeroTag removed — too much visual noise

const HeroTitle = styled.h1`
    font-size: clamp(1.1875rem, 0.5rem + 4.2vw, 1.75rem);
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1.2;
    margin: 0;
    color: #ffffff;

    span { color: #90e0ef; }

    @media (max-width: 480px) {
        letter-spacing: -0.35px;
    }
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

    @media (max-width: 400px) {
        width: 100%;
        justify-content: stretch;
    }
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

    @media (max-width: 480px) { padding: 7px 16px; font-size: 13px; }

    @media (max-width: 400px) {
        flex: 1;
        padding: 8px 12px;
    }
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
    .count {
        font-size: 13px;
        color: var(--tertiary-foreground);
    }

    @media (max-width: 480px) {
        margin-bottom: 14px;
        h2 { font-size: 16px; }
    }
`;

// ─── Filter ───────────────────────────────────────────────────────────────────

const FilterWrap = styled.div`
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    align-items: center;

    @media (max-width: 767px) {
        gap: 8px;
    }
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

    &:focus-within {
        border-color: var(--dir-accent);
    }

    .icon {
        font-size: 13px;
        opacity: 0.45;
        flex-shrink: 0;
    }

    @media (max-width: 1024px) {
        flex: 1 1 200px;
        width: auto;
        min-width: 0;
        max-width: min(360px, 100%);
    }

    @media (max-width: 767px) {
        flex: 1 1 100%;
        width: 100%;
        max-width: none;
    }
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

    @media (max-width: 767px) {
        flex: 1 1 100%;
    }
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

    &:hover {
        border-color: var(--dir-accent);
        color: var(--dir-accent);
        background: ${ac(0.07)};
    }

    @media (max-width: 480px) {
        min-height: 36px;
        padding: 6px 12px;
    }
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

    @media (max-width: 767px) {
        flex: 0 0 auto;
        align-self: flex-start;
    }
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

    @media (max-width: 767px) {
        padding: 14px 16px;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 140px), 1fr));
        gap: 12px;
    }

    @media (max-width: 380px) {
        grid-template-columns: 1fr;
    }
`;

const LegendCat = styled.div`
    h4 {
        font-size: 10px;
        font-weight: 700;
        color: var(--dir-accent);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin: 0 0 8px;
    }
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

type BV = "accent" | "green" | "purple" | "orange" | "dim";

const bv: Record<BV, ReturnType<typeof css>> = {
    accent: css`background:${ac(0.12)};color:var(--dir-accent);border-color:${ac(0.28)};`,
    green: css`background:${gr(0.1)};color:var(--success);border-color:${gr(0.25)};`,
    purple: css`background:${cy(0.1)};color:#00b4d8;border-color:${cy(0.25)};`,
    orange: css`background:${or(0.1)};color:var(--warning);border-color:${or(0.25)};`,
    dim: css`background:var(--dir-overlay-sm);color:var(--tertiary-foreground);border-color:var(--block);`,
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

const Stars = styled.span`
    color: var(--warning);
    font-size: 12px;
    letter-spacing: 0.5px;
`;
const StarNum = styled.span`
    font-size: 12px;
    font-weight: 700;
    color: var(--warning);
    margin-left: 3px;
`;

// ─── Cards ────────────────────────────────────────────────────────────────────

const CardGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
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

    &:hover {
        border-color: ${cy(0.6)};
        transform: translateY(-3px);
        box-shadow: 0 10px 32px ${ac(0.12)};
    }
`;

const CardHead = styled.div`
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    user-select: none;

    &:hover {
        background: var(--dir-overlay-sm);
    }
`;

const CardLeft = styled.div`flex: 1; min-width: 0;`;

const CardName = styled.div`
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const CardUrl = styled.a`
    font-size: 11px;
    color: var(--tertiary-foreground) !important;
    text-decoration: none !important;
    transition: color 0.12s;
    &:hover { color: var(--dir-accent) !important; }
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

const ReviewBtn = styled.button`
    margin-top: 12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--block);
    background: var(--secondary-background);
    color: var(--secondary-foreground);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.12s;
    &:hover { border-color: var(--dir-accent); color: var(--dir-accent); background: ${ac(0.06)}; }
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
    min-width: 880px;
    border-collapse: collapse;
    font-size: 13px;

    @media (max-width: 1200px) {
        font-size: 12px;
        th, td { padding: 9px 10px; }
    }

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

    tbody tr:hover td {
        background: var(--dir-row-hover);
    }
`;

const TableName = styled.div`font-weight: 600; font-size: 13px; margin-bottom: 2px;`;
const TableUrl = styled.a`
    font-size: 11px;
    color: var(--tertiary-foreground) !important;
    text-decoration: none !important;
    &:hover { color: var(--dir-accent) !important; }
`;
const TableRevBtn = styled.button`
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--block);
    background: transparent;
    color: var(--secondary-foreground);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s;
    &:hover { border-color: var(--dir-accent); color: var(--dir-accent); }
`;

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = styled.div`
    text-align: center;
    padding: clamp(40px, 12vw, 72px) clamp(16px, 4vw, 20px);
    color: var(--tertiary-foreground);
    .icon { font-size: clamp(28px, 8vw, 36px); display: block; margin-bottom: 12px; opacity: 0.4; }
`;

// ─── Modals ───────────────────────────────────────────────────────────────────

const Overlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
        max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
    box-sizing: border-box;

    @media (max-width: 768px) {
        align-items: flex-end;
        padding: 0;
        padding-bottom: env(safe-area-inset-bottom, 0px);
    }
`;

const ModalBox = styled.div<{ $wide?: boolean }>`
    background: var(--dir-surface-modal);
    border: 1px solid var(--dir-border-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 8px;
    width: 100%;
    max-width: ${(p) => (p.$wide ? "580px" : "540px")};
    max-height: 88vh;
    overflow-y: auto;
    box-shadow: var(--dir-modal-shadow);
    animation: ${fadeUp} 0.18s ease both;

    @media (max-width: 768px) {
        border-radius: 12px 12px 0 0;
        max-height: 92vh;
        border-bottom: none;
        padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    @media (max-width: 480px) {
        max-height: 92vh;
    }
`;

const DragHandle = styled.div`
    display: none;
    width: 32px; height: 3px;
    background: var(--dir-overlay-lg);
    border-radius: 2px;
    margin: 8px auto 0;
    @media (max-width: 768px) { display: block; }
`;

const ModalHead = styled.div`
    padding: 18px 22px 14px;
    border-bottom: 1px solid var(--dir-overlay-md);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;

    h2 { font-size: 16px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.2px; }

    @media (max-width: 480px) {
        padding: 14px 16px 12px;
        h2 { font-size: 15px; }
    }
`;

const ModalClose = styled.button`
    background: var(--dir-overlay-md);
    border: none;
    color: var(--secondary-foreground);
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.12s;
    &:hover { background: var(--dir-accent); color: white; }
`;

const ModalBody = styled.div`
    padding: 18px 22px;

    @media (max-width: 480px) {
        padding: 14px 16px 18px;
    }
`;

const FormGroup = styled.div`
    margin-bottom: 14px;

    label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        color: var(--dir-accent);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 6px;
    }

    input[type="text"], input[type="url"], textarea {
        width: 100%;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--block);
        background: var(--secondary-background);
        color: var(--foreground);
        font-size: 13px;
        font-family: inherit;
        box-sizing: border-box;
        transition: border-color 0.12s;

        &::placeholder { color: var(--tertiary-foreground); }
        &:focus { outline: none; border-color: var(--dir-accent); }
    }

    textarea { min-height: 78px; resize: vertical; }
`;

const CheckboxGrid = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;

const CheckLabel = styled.label<{ $checked: boolean }>`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid ${(p) => (p.$checked ? "var(--dir-accent)" : "var(--block)")};
    background: ${(p) => (p.$checked ? ac(0.1) : "transparent")};
    cursor: pointer;
    font-size: 12px;
    font-weight: ${(p) => (p.$checked ? 600 : 400)};
    color: ${(p) => (p.$checked ? "var(--dir-accent)" : "var(--secondary-foreground)")};
    transition: all 0.1s;
    input { display: none; }
    &:hover { border-color: var(--dir-accent); }
`;

const TypeToggle = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
    flex-wrap: wrap;

    @media (max-width: 380px) {
        flex-direction: column;
    }
`;
const TypeBtn = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 9px;
    border-radius: 6px;
    border: 1px solid ${(p) => (p.$active ? "var(--dir-accent)" : "var(--block)")};
    background: ${(p) => (p.$active ? ac(0.12) : "var(--secondary-background)")};
    color: ${(p) => (p.$active ? "var(--dir-accent)" : "var(--secondary-foreground)")};
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
    &:hover { border-color: var(--dir-accent); }
`;

const PrimaryBtn = styled.button`
    width: 100%;
    padding: 11px;
    border-radius: 6px;
    border: none;
    background: var(--dir-accent);
    color: white;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 6px;
    transition: all 0.15s;
    &:hover { filter: brightness(1.1); box-shadow: 0 4px 14px ${ac(0.35)}; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ErrorMsg = styled.div`
    color: var(--error);
    font-size: 12px;
    margin-bottom: 10px;
    padding: 7px 11px;
    background: rgba(237,66,69,0.08);
    border-radius: 6px;
    border: 1px solid rgba(237,66,69,0.2);
`;

const SuccessMsg = styled.div`
    text-align: center;
    padding: 18px 0;
    color: var(--success);
    font-size: 14px;
    font-weight: 600;
`;

const RevCard = styled.div`
    padding: 12px 0;
    border-bottom: 1px solid var(--dir-overlay-md);
    &:last-child { border-bottom: none; }
`;

const RevMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 6px;
    flex-wrap: wrap;
    .name { font-weight: 600; font-size: 13px; }
    .date { font-size: 11px; color: var(--tertiary-foreground); }
`;

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

const BottomNav = styled.div`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--dir-surface-nav);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--dir-border-nav);
    display: flex;
    z-index: 50;
`;

const BottomTab = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 12px 10px;
    border: none;
    background: transparent;
    color: ${(p) => (p.$active ? "#90e0ef" : "rgba(202,240,248,0.45)")};
    font-size: 13px;
    font-weight: ${(p) => (p.$active ? 700 : 400)};
    cursor: pointer;
    transition: color 0.14s;
    position: relative;

    &::after {
        content: '';
        position: absolute;
        bottom: 0; left: 20%; right: 20%;
        height: 2px;
        background: #00b4d8;
        border-radius: 2px 2px 0 0;
        transform: scaleX(${(p) => (p.$active ? 1 : 0)});
        transition: transform 0.18s;
    }
`;

const FAB = styled.button`
    position: fixed;
    bottom: 28px;
    right: 28px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--dir-accent);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 16px ${ac(0.45)};
    z-index: 51;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    &:hover { filter: brightness(1.1); transform: scale(1.05); }

    @media (max-width: 768px) {
        bottom: calc(64px + env(safe-area-inset-bottom, 0px));
        right: max(18px, env(safe-area-inset-right, 0px));
    }
`;

// ─── Footer ───────────────────────────────────────────────────────────────────

const Footer = styled.footer`
    /* Matches LogoImg height in footer — used to inset disclaimer with SVG wordmark (wide.svg has left padding in viewBox). */
    --footer-logo-h: 22px;
    background: var(--dir-surface-nav);
    border-top: 1px solid var(--dir-border-nav);
    padding: 24px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;

    .left { display: flex; align-items: center; gap: 12px; }
    .disclaimer {
        font-size: 12px;
        color: rgba(202,240,248,0.55);
        max-width: 480px;
        line-height: 1.5;
        margin: 0;
        /* Inset = rendered logo width × (glyph start / viewBox width); simplifies to h × 157/240 for uniform scale. */
        margin-left: calc(var(--footer-logo-h) * 157 / 240);
    }

    @media (max-width: 767px) {
        flex-direction: column;
        align-items: flex-start;
        padding: 20px clamp(12px, 3.5vw, 18px);

        .disclaimer {
            max-width: 100%;
        }
    }

    @media (max-width: 480px) {
        padding: 18px max(12px, env(safe-area-inset-left, 0px)) 18px max(12px, env(safe-area-inset-right, 0px));
    }
`;

const FooterLinks = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
    align-items: center;
    a {
        font-size: 12px;
        color: rgba(202,240,248,0.7) !important;
        text-decoration: none !important;
        transition: color 0.12s;
        &:hover { color: #90e0ef !important; }
    }
`;

// ─── Theme Toggle + Nav extras ────────────────────────────────────────────────

const ThemeToggle = styled.button`
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.08);
    color: #caf0f8;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
    line-height: 1;
    &:hover {
        background: rgba(255,255,255,0.16);
        border-color: rgba(255,255,255,0.35);
        transform: rotate(20deg);
    }

    @media (max-width: 500px) {
        width: 30px;
        height: 30px;
        font-size: 14px;
    }
`;

const NavDivider = styled.div`
    width: 1px;
    height: 20px;
    background: rgba(255,255,255,0.15);
    flex-shrink: 0;

    @media (max-width: 560px) { display: none; }
`;

const NavSubmitGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;

    @media (max-width: 560px) { display: none; }
`;

const NavSubmitBtn = styled.button`
    padding: 6px 13px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    border: 1px solid rgba(0,180,216,0.45);
    background: rgba(0,180,216,0.12);
    color: #90e0ef;
    &:hover {
        background: rgba(0,180,216,0.22);
        border-color: #00b4d8;
        color: #caf0f8;
    }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
    const full = Math.round(rating);
    return (
        <>
            <Stars>{"★".repeat(full)}{"☆".repeat(5 - full)}</Stars>
            <StarNum>{rating.toFixed(1)}</StarNum>
        </>
    );
}

function StarPicker({ rating, onChange }: { rating: number; onChange: (n: number) => void }) {
    return (
        <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span
                    key={n}
                    onClick={() => onChange(n)}
                    style={{
                        fontSize: 22,
                        cursor: "pointer",
                        color: n <= rating ? "var(--warning)" : "var(--block)",
                        transition: "color 0.1s",
                    }}>
                    ★
                </span>
            ))}
        </div>
    );
}

function PaymentBadges({ payment }: { payment: Payment }) {
    return (
        <BadgeRow>
            {(Object.keys(PAYMENT_LABELS) as (keyof Payment)[]).map((k) =>
                payment[k] ? <Badge key={k} $v="accent">{PAYMENT_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

function WarehouseBadges({ warehouses }: { warehouses: Warehouses }) {
    return (
        <BadgeRow>
            {(Object.keys(WAREHOUSE_LABELS) as (keyof Warehouses)[]).map((k) =>
                warehouses[k] ? <Badge key={k} $v="green">{WAREHOUSE_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

function ProductBadges({ products }: { products: Products }) {
    return (
        <BadgeRow>
            {(Object.keys(PRODUCT_LABELS) as (keyof Products)[]).map((k) =>
                products[k] ? <Badge key={k} $v="purple">{PRODUCT_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

function OrderBadges({ orderTypes }: { orderTypes: OrderTypes }) {
    return (
        <BadgeRow>
            {(Object.keys(ORDER_LABELS) as (keyof OrderTypes)[]).map((k) =>
                orderTypes[k] ? <Badge key={k} $v="orange">{ORDER_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────

function VendorCard({
    vendor, reviewCount, isReseller, onReview,
}: {
    vendor: Vendor | Reseller; reviewCount: number; isReseller: boolean; onReview: () => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Card>
            <CardHead onClick={() => setOpen((o) => !o)}>
                <CardLeft>
                    <CardName>{vendor.name}</CardName>
                    <CardUrl
                        href={`https://${vendor.url}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}>
                        {vendor.url} ↗
                    </CardUrl>
                </CardLeft>
                <CardRight>
                    <div><StarRating rating={vendor.rating} /></div>
                    <WarehouseBadges warehouses={vendor.warehouses} />
                    <Chevron $open={open}>▾</Chevron>
                </CardRight>
            </CardHead>

            {open && <CardDivider />}

            <CardBody $open={open}>
                <SectionLabel>Payment</SectionLabel>
                <PaymentBadges payment={vendor.payment} />

                <SectionLabel>Products</SectionLabel>
                <ProductBadges products={vendor.products} />

                {isReseller && (
                    <>
                        <SectionLabel>Order Types</SectionLabel>
                        <OrderBadges orderTypes={(vendor as Reseller).orderTypes} />
                    </>
                )}

                <SectionLabel>Shipping</SectionLabel>
                <InfoLine><strong>Routes</strong> · {vendor.shippingRoutes}</InfoLine>
                <InfoLine><strong>Time</strong> · {vendor.shippingTime}</InfoLine>
                {vendor.freeShipping && (
                    <InfoLine>
                        <Badge $v="green">Free Shipping</Badge>
                        {vendor.freeShippingThreshold && (
                            <span style={{ fontSize: 11, marginLeft: 6, color: "var(--tertiary-foreground)" }}>
                                over {vendor.freeShippingThreshold}
                            </span>
                        )}
                    </InfoLine>
                )}

                {vendor.notes && (
                    <>
                        <SectionLabel>Notes</SectionLabel>
                        <InfoLine>{vendor.notes}</InfoLine>
                    </>
                )}

                <ReviewBtn onClick={onReview}>
                    ⭐ {reviewCount} Review{reviewCount !== 1 ? "s" : ""}
                </ReviewBtn>
            </CardBody>
        </Card>
    );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function VendorRow({
    vendor, reviewCount, isReseller, onReview,
}: {
    vendor: Vendor | Reseller; reviewCount: number; isReseller: boolean; onReview: () => void;
}) {
    return (
        <tr>
            <td><StarRating rating={vendor.rating} /></td>
            <td>
                <TableName>{vendor.name}</TableName>
                <TableUrl href={`https://${vendor.url}`} target="_blank" rel="noreferrer">{vendor.url}</TableUrl>
            </td>
            <td><PaymentBadges payment={vendor.payment} /></td>
            <td><WarehouseBadges warehouses={vendor.warehouses} /></td>
            <td><ProductBadges products={vendor.products} /></td>
            {isReseller && <td><OrderBadges orderTypes={(vendor as Reseller).orderTypes} /></td>}
            <td>
                {vendor.freeShipping
                    ? <Badge $v="green">✓ {vendor.freeShippingThreshold || "Yes"}</Badge>
                    : <span style={{ color: "var(--tertiary-foreground)" }}>—</span>}
            </td>
            <td style={{ whiteSpace: "nowrap", color: "var(--secondary-foreground)" }}>{vendor.shippingTime}</td>
            <td style={{ maxWidth: 160, color: "var(--tertiary-foreground)", fontSize: 12 }}>{vendor.shippingRoutes}</td>
            <td><TableRevBtn onClick={onReview}>⭐ {reviewCount}</TableRevBtn></td>
        </tr>
    );
}

// ─── Reviews Modal ────────────────────────────────────────────────────────────

function ReviewsModal({
    vendor, vendorType, reviews, onClose, onSubmit,
}: {
    vendor: Vendor | Reseller; vendorType: "vendor" | "reseller";
    reviews: Review[]; onClose: () => void;
    onSubmit: (r: Omit<Review, "id" | "date">) => void;
}) {
    const [name, setName] = useState("");
    const [rating, setRating] = useState(5);
    const [text, setText] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    function handleSubmit(e: Event) {
        e.preventDefault();
        if (!name.trim() || !text.trim()) { setError("Name and review text are required."); return; }
        onSubmit({ vendorId: vendor.id, vendorType, reviewerName: name.trim(), rating, text: text.trim() });
        setSubmitted(true);
    }

    return (
        <Overlay onClick={onClose}>
            <ModalBox onClick={(e) => e.stopPropagation()}>
                <DragHandle />
                <ModalHead>
                    <div>
                        <h2>{vendor.name}</h2>
                        <StarRating rating={vendor.rating} />
                    </div>
                    <ModalClose onClick={onClose}>✕</ModalClose>
                </ModalHead>
                <ModalBody>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: "var(--secondary-foreground)" }}>
                        Community Reviews ({reviews.length})
                    </div>

                    {reviews.length === 0
                        ? <div style={{ color: "var(--tertiary-foreground)", fontSize: 13, padding: "8px 0" }}>
                            No reviews yet — be the first!
                        </div>
                        : reviews.map((r) => (
                            <RevCard key={r.id}>
                                <RevMeta>
                                    <Stars style={{ fontSize: 11 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Stars>
                                    <span className="name">{r.reviewerName}</span>
                                    <span className="date">{r.date}</span>
                                </RevMeta>
                                <div style={{ fontSize: 13, color: "var(--secondary-foreground)", lineHeight: 1.5 }}>{r.text}</div>
                            </RevCard>
                        ))
                    }

                    <div style={{ marginTop: 20, borderTop: `1px solid ${bk(0.06)}`, paddingTop: 18 }}>
                        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Leave a Review</div>
                        {submitted
                            ? <SuccessMsg>✓ Review submitted — thank you!</SuccessMsg>
                            : (
                                <form onSubmit={handleSubmit}>
                                    <FormGroup>
                                        <label>Your Name</label>
                                        <input type="text" value={name}
                                            onInput={(e) => setName((e.target as HTMLInputElement).value)}
                                            placeholder="Anonymous" />
                                    </FormGroup>
                                    <FormGroup>
                                        <label>Rating</label>
                                        <StarPicker rating={rating} onChange={setRating} />
                                    </FormGroup>
                                    <FormGroup>
                                        <label>Review</label>
                                        <textarea value={text}
                                            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
                                            placeholder="Share your experience..." />
                                    </FormGroup>
                                    {error && <ErrorMsg>{error}</ErrorMsg>}
                                    <PrimaryBtn type="submit">Submit Review</PrimaryBtn>
                                </form>
                            )
                        }
                    </div>
                </ModalBody>
            </ModalBox>
        </Overlay>
    );
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

const defPay: Payment = { cc: false, btc: false, pp: false, zelle: false, venmo: false, bt: false, chk: false };
const defWh: Warehouses = { us: false, eu: false, aus: false };
const defPr: Products = { pep: false, oil: false, tabs: false, raw: false, amn: false, sup: false };
const defOr: OrderTypes = { single: false, halfkit: false, fullkit: false };

function SubmitModal({ onClose, onSubmit, initialType = "vendor" }: { onClose: () => void; onSubmit: (f: SubmitForm) => void; initialType?: "vendor" | "reseller" }) {
    const [form, setForm] = useState<SubmitForm>({
        type: initialType, name: "", url: "",
        payment: { ...defPay }, warehouses: { ...defWh },
        products: { ...defPr }, orderTypes: { ...defOr }, notes: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    function handleSubmit(e: Event) {
        e.preventDefault();
        if (!form.name.trim()) { setError("Name is required."); return; }
        onSubmit(form);
        setSubmitted(true);
    }

    return (
        <Overlay onClick={onClose}>
            <ModalBox $wide onClick={(e) => e.stopPropagation()}>
                <DragHandle />
                <ModalHead>
                    <h2>Submit a Listing</h2>
                    <ModalClose onClick={onClose}>✕</ModalClose>
                </ModalHead>
                <ModalBody>
                    {submitted ? (
                        <div style={{ textAlign: "center", padding: "36px 0" }}>
                            <div style={{ fontSize: 44, marginBottom: 14 }}>🎉</div>
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Submission Received!</div>
                            <div style={{ color: "var(--secondary-foreground)", fontSize: 13, lineHeight: 1.6 }}>
                                Your listing will be reviewed and added shortly.
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <TypeToggle>
                                <TypeBtn type="button" $active={form.type === "vendor"}
                                    onClick={() => setForm((f) => ({ ...f, type: "vendor" }))}>Vendor</TypeBtn>
                                <TypeBtn type="button" $active={form.type === "reseller"}
                                    onClick={() => setForm((f) => ({ ...f, type: "reseller" }))}>Reseller</TypeBtn>
                            </TypeToggle>
                            <FormGroup>
                                <label>Name *</label>
                                <input type="text" value={form.name}
                                    onInput={(e) => setForm((f) => ({ ...f, name: (e.target as HTMLInputElement).value }))}
                                    placeholder="Company or shop name" />
                            </FormGroup>
                            <FormGroup>
                                <label>Website URL</label>
                                <input type="url" value={form.url}
                                    onInput={(e) => setForm((f) => ({ ...f, url: (e.target as HTMLInputElement).value }))}
                                    placeholder="https://example.com" />
                            </FormGroup>
                            <FormGroup>
                                <label>Payment Methods</label>
                                <CheckboxGrid>
                                    {(Object.keys(PAYMENT_LABELS) as (keyof Payment)[]).map((k) => (
                                        <CheckLabel key={k} $checked={form.payment[k]}>
                                            <input type="checkbox" checked={form.payment[k]}
                                                onChange={() => setForm((f) => ({ ...f, payment: toggle(f.payment, k) }))} />
                                            {PAYMENT_LABELS[k]}
                                        </CheckLabel>
                                    ))}
                                </CheckboxGrid>
                            </FormGroup>
                            <FormGroup>
                                <label>Warehouses</label>
                                <CheckboxGrid>
                                    {(Object.keys(WAREHOUSE_LABELS) as (keyof Warehouses)[]).map((k) => (
                                        <CheckLabel key={k} $checked={form.warehouses[k]}>
                                            <input type="checkbox" checked={form.warehouses[k]}
                                                onChange={() => setForm((f) => ({ ...f, warehouses: toggle(f.warehouses, k) }))} />
                                            {WAREHOUSE_LABELS[k]}
                                        </CheckLabel>
                                    ))}
                                </CheckboxGrid>
                            </FormGroup>
                            <FormGroup>
                                <label>Products</label>
                                <CheckboxGrid>
                                    {(Object.keys(PRODUCT_LABELS) as (keyof Products)[]).map((k) => (
                                        <CheckLabel key={k} $checked={form.products[k]}>
                                            <input type="checkbox" checked={form.products[k]}
                                                onChange={() => setForm((f) => ({ ...f, products: toggle(f.products, k) }))} />
                                            {PRODUCT_LABELS[k]}
                                        </CheckLabel>
                                    ))}
                                </CheckboxGrid>
                            </FormGroup>
                            {form.type === "reseller" && (
                                <FormGroup>
                                    <label>Order Types</label>
                                    <CheckboxGrid>
                                        {(Object.keys(ORDER_LABELS) as (keyof OrderTypes)[]).map((k) => (
                                            <CheckLabel key={k} $checked={form.orderTypes[k]}>
                                                <input type="checkbox" checked={form.orderTypes[k]}
                                                    onChange={() => setForm((f) => ({ ...f, orderTypes: toggle(f.orderTypes, k) }))} />
                                                {ORDER_LABELS[k]}
                                            </CheckLabel>
                                        ))}
                                    </CheckboxGrid>
                                </FormGroup>
                            )}
                            <FormGroup>
                                <label>Notes (optional)</label>
                                <textarea value={form.notes}
                                    onInput={(e) => setForm((f) => ({ ...f, notes: (e.target as HTMLTextAreaElement).value }))}
                                    placeholder="Additional info, shipping details, etc." />
                            </FormGroup>
                            {error && <ErrorMsg>{error}</ErrorMsg>}
                            <PrimaryBtn type="submit">Submit for Review</PrimaryBtn>
                        </form>
                    )}
                </ModalBody>
            </ModalBox>
        </Overlay>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Directory() {
    const [tab, setTab] = useState<"vendors" | "resellers">("vendors");
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
    const [sortCol, setSortCol] = useState<"rating" | "name">("rating");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [reviews, setReviews] = useState<Review[]>([...(rawData.reviews as Review[])]);
    const [showLegend, setShowLegend] = useState(false);
    const [reviewModal, setReviewModal] = useState<{ vendor: Vendor | Reseller; type: "vendor" | "reseller" } | null>(null);
    const [submitOpen, setSubmitOpen] = useState(false);
    const [submitInitialType, setSubmitInitialType] = useState<"vendor" | "reseller">("vendor");
    const [darkMode, setDarkMode] = useState(false);

    function openSubmit(type: "vendor" | "reseller") {
        setSubmitInitialType(type);
        setSubmitOpen(true);
    }

    const vendors = rawData.vendors as Vendor[];
    const resellers = rawData.resellers as Reseller[];

    function toggleFilter(key: FilterKey) {
        setActiveFilters((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    function handleSort(col: "rating" | "name") {
        if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortCol(col); setSortDir(col === "rating" ? "desc" : "asc"); }
    }

    const filtered = useMemo(() => {
        const list = (tab === "vendors" ? vendors : resellers) as (Vendor | Reseller)[];
        return list
            .filter((v) => {
                const q = search.toLowerCase();
                return !q || v.name.toLowerCase().includes(q) || v.url.toLowerCase().includes(q);
            })
            .filter((v) => matchesFilters(v, activeFilters))
            .sort((a, b) => {
                const cmp = sortCol === "rating" ? a.rating - b.rating : a.name.localeCompare(b.name);
                return sortDir === "asc" ? cmp : -cmp;
            });
    }, [tab, search, activeFilters, sortCol, sortDir]);

    const reviewCount = (id: string, type: string) =>
        reviews.filter((r) => r.vendorId === id && r.vendorType === type).length;

    function handleSubmitReview(rev: Omit<Review, "id" | "date">) {
        setReviews((prev) => [
            ...prev,
            { ...rev, id: `u${Date.now()}`, date: new Date().toISOString().split("T")[0] },
        ]);
    }

    function handleSubmitListing(form: SubmitForm) {
        const key = "pepchat_pending_submissions";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.push({ ...form, submittedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(existing));
    }

    const listType = tab === "vendors" ? "vendor" : "reseller";
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
                <NavDivider />
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

            {/* ── Hero ── */}
            <Hero>
                <HeroInner>
                    <HeroTitle>
                        Vendor &amp; Reseller<br /><span>Directory</span>
                    </HeroTitle>
                    <HeroSub>
                        Community-curated listings of trusted peptide vendors and resellers.
                        Compare payment methods, warehouses, shipping, and community reviews.
                    </HeroSub>

                    <TabToggle>
                        <ToggleTab $active={tab === "vendors"} onClick={() => setTab("vendors")}>
                            Vendors
                        </ToggleTab>
                        <ToggleTab $active={tab === "resellers"} onClick={() => setTab("resellers")}>
                            Resellers
                        </ToggleTab>
                    </TabToggle>
                </HeroInner>
            </Hero>

            {/* ── Main ── */}
            <Main>
                <SectionHeader>
                    <h2>{tab === "vendors" ? "Vendor Directory" : "Reseller Directory"}</h2>
                    <span className="count">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}</span>
                </SectionHeader>

                {/* Filters */}
                <FilterWrap>
                    <SearchWrap>
                        <span className="icon">🔍</span>
                        <SearchInput
                            value={search}
                            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                            placeholder="Search name or URL..."
                        />
                    </SearchWrap>
                    <FilterPills>
                        {FILTERS.map((f) => (
                            <Pill key={f.key} $active={activeFilters.has(f.key)} onClick={() => toggleFilter(f.key)}>
                                {f.emoji} {f.label}
                            </Pill>
                        ))}
                        {activeFilters.size > 0 && (
                            <ClearBtn onClick={() => setActiveFilters(new Set())}>
                                ✕ Clear ({activeFilters.size})
                            </ClearBtn>
                        )}
                    </FilterPills>
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
                {filtered.length === 0 ? (
                    <EmptyState>
                        <span className="icon">🔍</span>
                        No listings match your search or filters.
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
                                        <th>Payment</th>
                                        <th>Warehouses</th>
                                        <th>Products</th>
                                        {tab === "resellers" && <th>Order Types</th>}
                                        <th>Free Ship</th>
                                        <th>Ship Time</th>
                                        <th>Routes</th>
                                        <th>Reviews</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((v) => (
                                        <VendorRow
                                            key={v.id}
                                            vendor={v}
                                            reviewCount={reviewCount(v.id, listType)}
                                            isReseller={tab === "resellers"}
                                            onReview={() => setReviewModal({ vendor: v, type: listType })}
                                        />
                                    ))}
                                </tbody>
                            </Table>
                        </TableWrap>

                        {/* Mobile Cards */}
                        <CardGrid className={styles.mobileCards}>
                            {filtered.map((v) => (
                                <VendorCard
                                    key={v.id}
                                    vendor={v}
                                    reviewCount={reviewCount(v.id, listType)}
                                    isReseller={tab === "resellers"}
                                    onReview={() => setReviewModal({ vendor: v, type: listType })}
                                />
                            ))}
                        </CardGrid>
                    </>
                )}
            </Main>

            {/* ── Footer ── */}
            <Footer>
                <div>
                    <LogoImg src={wideSVG} alt="PepChat" draggable={false} style={{ marginBottom: 8 }} />
                    <p className="disclaimer">
                        Information is community-maintained and may not be current.
                        Not affiliated with or endorsing any listed vendor or reseller.
                    </p>
                </div>
                <FooterLinks>
                    {loggedIn ? (
                        <a href="/" style={{ color: "inherit", textDecoration: "none" }}>Open Chat</a>
                    ) : (
                        <>
                            <a href="/login" style={{ color: "inherit", textDecoration: "none" }}>Log In</a>
                            <a href="/login/create" style={{ color: "inherit", textDecoration: "none" }}>Register</a>
                        </>
                    )}
                </FooterLinks>
            </Footer>

            {/* ── Mobile Bottom Nav ── */}
            <BottomNav className={styles.mobileNav}>
                <BottomTab $active={tab === "vendors"} onClick={() => setTab("vendors")}>Vendors</BottomTab>
                <BottomTab $active={tab === "resellers"} onClick={() => setTab("resellers")}>Resellers</BottomTab>
            </BottomNav>

            <FAB onClick={() => setSubmitOpen(true)}>+</FAB>

            {/* ── Modals ── */}
            {reviewModal && (
                <ReviewsModal
                    vendor={reviewModal.vendor}
                    vendorType={reviewModal.type}
                    reviews={reviews.filter(
                        (r) => r.vendorId === reviewModal.vendor.id && r.vendorType === reviewModal.type,
                    )}
                    onClose={() => setReviewModal(null)}
                    onSubmit={handleSubmitReview}
                />
            )}

            {submitOpen && (
                <SubmitModal onClose={() => setSubmitOpen(false)} onSubmit={handleSubmitListing} initialType={submitInitialType} />
            )}
        </Page>
    );
}

export default observer(Directory);
