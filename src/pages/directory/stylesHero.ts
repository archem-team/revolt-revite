import styled from "styled-components/macro";
import { cy, ac, fadeUp } from "./stylesLayout";

// ─── Hero ─────────────────────────────────────────────────────────────────────

export const Hero = styled.section`
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

export const HeroInner = styled.div`
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

export const HeroTitle = styled.h1`
    font-size: clamp(1.1875rem, 0.5rem + 4.2vw, 1.75rem);
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1.2;
    margin: 0;
    color: #ffffff;
    span { color: #90e0ef; }
    @media (max-width: 480px) { letter-spacing: -0.35px; }
`;

export const HeroSub = styled.p`
    font-size: clamp(0.8125rem, 0.72rem + 0.35vw, 0.875rem);
    color: rgba(202,240,248,0.85);
    margin: 0;
    line-height: 1.6;
    max-width: min(440px, 100%);
    width: 100%;
    box-sizing: border-box;
`;

export const TabToggle = styled.div`
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

export const ToggleTab = styled.button<{ $active: boolean }>`
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

export const Main = styled.main`
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

export const SectionHeader = styled.div`
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

export const FilterWrap = styled.div`
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    align-items: center;
    @media (max-width: 767px) { gap: 8px; }
`;

export const SearchWrap = styled.label`
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

export const SearchInput = styled.input`
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

export const FilterPills = styled.div`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    flex: 1;
    min-width: 0;
    @media (max-width: 767px) { flex: 1 1 100%; }
`;

export const Pill = styled.button<{ $active: boolean }>`
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

export const ClearBtn = styled.button`
    padding: 5px 10px;
    border: none;
    background: none;
    color: var(--tertiary-foreground);
    font-size: 12px;
    cursor: pointer;
    transition: color 0.12s;
    &:hover { color: var(--dir-accent); }
`;

export const LegendToggle = styled.button`
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

export const LegendBox = styled.div`
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

export const LegendCat = styled.div`
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
