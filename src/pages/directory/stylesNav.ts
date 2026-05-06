import styled from "styled-components/macro";

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
    padding: var(--space-3) var(--space-2);
    border: none;
    background: transparent;
    color: ${(p) =>
        p.$active
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)"};
    font-size: var(--font-size-footnote);
    font-weight: ${(p) =>
        p.$active ? "var(--font-weight-bold)" : "var(--font-weight-regular)"};
    cursor: pointer;
    transition: color 0.14s;
    position: relative;

    &::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 20%;
        right: 20%;
        height: var(--space-1);
        background: var(--color-accent);
        border-radius: var(--radius-xs) var(--radius-xs) 0 0;
        transform: scaleX(${(p) => (p.$active ? 1 : 0)});
        transition: transform 0.18s;
    }
`;

export const FAB = styled.button`
    position: fixed;
    bottom: var(--space-8);
    right: var(--space-8);
    width: var(--space-12);
    height: var(--space-12);
    border-radius: var(--radius-pill);
    background: var(--dir-accent);
    border: 1px solid var(--color-accent-deep);
    color: var(--color-text-primary);
    font-size: var(--font-size-title-2);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    z-index: 51;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    &:hover {
        background: var(--color-accent-deep);
        transform: scale(1.05);
    }

    @media (max-width: 768px) {
        bottom: calc(var(--space-16) + env(safe-area-inset-bottom, 0px));
        right: max(var(--space-4), env(safe-area-inset-right, 0px));
    }
`;

// ─── Footer ───────────────────────────────────────────────────────────────────

export const Footer = styled.footer`
    --footer-logo-h: var(--space-5);
    background: var(--dir-surface-nav);
    border-top: 1px solid var(--dir-border-nav);
    padding: var(--space-6) var(--space-8);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-3);

    .left {
        display: flex;
        align-items: center;
        gap: var(--space-3);
    }
    .disclaimer {
        font-size: var(--font-size-footnote);
        color: var(--color-text-secondary);
        max-width: 480px;
        line-height: var(--line-height-loose);
        margin: 0;
        margin-left: calc(var(--footer-logo-h) * 157 / 240);
    }

    @media (max-width: 767px) {
        flex-direction: column;
        align-items: flex-start;
        padding: var(--space-5) var(--space-3);
        .disclaimer {
            max-width: 100%;
        }
    }

    @media (max-width: 480px) {
        padding: var(--space-4)
            max(var(--space-3), env(safe-area-inset-left, 0px)) var(--space-4)
            max(var(--space-3), env(safe-area-inset-right, 0px));
    }
`;

export const FooterLinks = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-4);
    align-items: center;
    a {
        font-size: var(--font-size-footnote);
        color: var(--color-text-secondary) !important;
        text-decoration: none !important;
        transition: color 0.12s;
        &:hover {
            color: var(--color-text-primary) !important;
        }
    }
`;

// ─── Theme Toggle + Nav extras ────────────────────────────────────────────────

export const ThemeToggle = styled.button`
    width: calc(var(--space-8) + var(--space-1));
    height: calc(var(--space-8) + var(--space-1));
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-body-2);
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
    line-height: 1;
    &:hover {
        background: var(--color-surface-alt);
        border-color: var(--color-border-strong);
        color: var(--color-text-primary);
        transform: rotate(20deg);
    }
    @media (max-width: 500px) {
        width: var(--space-8);
        height: var(--space-8);
        font-size: var(--font-size-body-4);
    }
`;

export const NavDivider = styled.div`
    width: 1px;
    height: var(--space-5);
    background: var(--color-border);
    flex-shrink: 0;
    @media (max-width: 560px) {
        display: none;
    }
`;

export const NavSubmitGroup = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);
`;

export const NavSubmitBtn = styled.button`
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--font-size-footnote);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    background: var(--dir-accent);
    color: var(--color-text-primary) !important;
    border: 1px solid var(--dir-accent);
    &:hover {
        background: var(--color-accent-deep);
        box-shadow: var(--shadow-sm);
    }

    @media (max-width: 560px) {
        padding: var(--space-1) var(--space-2);
        font-size: var(--font-size-caption-1);
    }
`;
