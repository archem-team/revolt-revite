import styled from "styled-components/macro";
import { ac, cy } from "./stylesLayout";

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

export const BottomNav = styled.div`
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

export const BottomTab = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 12px 10px;
    border: none;
    background: transparent;
    color: ${(p) => (p.$active ? "#90e0ef" : "rgba(202,240,248,0.45)")};
    font-size: 12px;
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

export const FAB = styled.button`
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

export const Footer = styled.footer`
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
        margin-left: calc(var(--footer-logo-h) * 157 / 240);
    }

    @media (max-width: 767px) {
        flex-direction: column;
        align-items: flex-start;
        padding: 20px clamp(12px, 3.5vw, 18px);
        .disclaimer { max-width: 100%; }
    }

    @media (max-width: 480px) {
        padding: 18px max(12px, env(safe-area-inset-left, 0px)) 18px max(12px, env(safe-area-inset-right, 0px));
    }
`;

export const FooterLinks = styled.div`
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

export const ThemeToggle = styled.button`
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
    &:hover { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.35); transform: rotate(20deg); }
    @media (max-width: 500px) { width: 30px; height: 30px; font-size: 14px; }
`;

export const NavDivider = styled.div`
    width: 1px;
    height: 20px;
    background: rgba(255,255,255,0.15);
    flex-shrink: 0;
    @media (max-width: 560px) { display: none; }
`;

export const NavSubmitGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    @media (max-width: 560px) { display: none; }
`;

export const NavSubmitBtn = styled.button`
    padding: 6px 13px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    border: 1px solid ${cy(0.45)};
    background: ${cy(0.12)};
    color: #90e0ef;
    &:hover { background: ${cy(0.22)}; border-color: #00b4d8; color: #caf0f8; }
`;
