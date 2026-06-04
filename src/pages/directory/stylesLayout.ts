import styled, { css, keyframes } from "styled-components/macro";

// ─── Animations ───────────────────────────────────────────────────────────────

export const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(var(--space-2)); }
    to   { opacity: 1; transform: translateY(var(--space-0)); }
`;

// ─── Color helpers ────────────────────────────────────────────────────────────

export const ac = (_a: number) => "var(--color-accent)";
export const cy = (_a: number) => "var(--color-info)";
export const gr = (_a: number) => "var(--color-success)";
export const or = (_a: number) => "var(--color-caution)";
export const bk = (_a: number) => "var(--color-bg)";

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export const Page = styled.div<{ $dark?: boolean }>`
    height: 100%;
    min-height: 100%;
    width: 100%;
    max-width: 100vw;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    font-family: var(--font-family);
    font-size: var(--font-size-body-4);
    -webkit-tap-highlight-color: transparent;

    --dir-accent: var(--color-accent);
    --background: var(--color-bg);
    --primary-background: var(--color-surface);
    --secondary-background: var(--color-surface-alt);
    --foreground: var(--color-text-primary);
    --secondary-foreground: var(--color-text-secondary);
    --tertiary-foreground: var(--color-text-tertiary);
    --block: var(--color-border);
    --success: var(--color-success);
    --warning: var(--color-warning);
    --error: var(--color-danger);

    --dir-surface-nav: var(--color-surface-alt);
    --dir-surface-card: var(--color-surface);
    --dir-surface-modal: var(--color-surface);
    --dir-surface-table: var(--color-surface);
    --dir-surface-thead: var(--color-surface-alt);
    --dir-row-hover: var(--color-accent-darker);
    --dir-hero-from: var(--color-bg);
    --dir-hero-mid: var(--color-accent-darker);
    --dir-hero-to: var(--color-accent);
    --dir-border-nav: var(--color-border-quiet);
    --dir-border-card: var(--color-border);
    --dir-border-table: var(--color-border-quiet);
    --dir-thead-color: var(--color-text-secondary);
    --dir-overlay-sm: var(--color-surface-alt);
    --dir-overlay-md: var(--color-border-quiet);
    --dir-overlay-lg: var(--color-border-strong);
    --dir-modal-shadow: var(--shadow-md);

    ${(p) =>
        p.$dark &&
        css`
            --background: var(--color-bg);
            --primary-background: var(--color-surface);
            --secondary-background: var(--color-surface-alt);
            --foreground: var(--color-text-primary);
            --secondary-foreground: var(--color-text-secondary);
            --tertiary-foreground: var(--color-text-tertiary);
            --block: var(--color-border);
            --success: var(--color-success);
            --warning: var(--color-warning);

            --dir-surface-nav: var(--color-surface-alt);
            --dir-surface-card: var(--color-surface);
            --dir-surface-modal: var(--color-surface);
            --dir-surface-table: var(--color-surface);
            --dir-surface-thead: var(--color-surface-alt);
            --dir-row-hover: var(--color-accent-darker);
            --dir-hero-from: var(--color-bg);
            --dir-hero-mid: var(--color-accent-darker);
            --dir-hero-to: var(--color-accent);
            --dir-border-nav: var(--color-border-quiet);
            --dir-border-card: var(--color-border);
            --dir-border-table: var(--color-border-quiet);
            --dir-thead-color: var(--color-text-secondary);
            --dir-overlay-sm: var(--color-surface-alt);
            --dir-overlay-md: var(--color-border-quiet);
            --dir-overlay-lg: var(--color-border-strong);
            --dir-modal-shadow: var(--shadow-md);
        `}

    background: var(--background);
    color: var(--foreground);

    scrollbar-width: thin;
    scrollbar-color: var(--color-border-strong) transparent;

    &::-webkit-scrollbar {
        width: var(--space-1);
    }

    &::-webkit-scrollbar-thumb {
        background: var(--color-border-strong);
        border-radius: var(--radius-xs);
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }
`;

// ─── Header ───────────────────────────────────────────────────────────────────

export const Header = styled.header`
    background: var(--dir-surface-nav);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--dir-border-nav);
    padding: 0 var(--space-6);
    height: calc(var(--space-12) + var(--space-2));
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    position: sticky;
    top: 0;
    z-index: 100;

    @media (max-width: 767px) {
        padding-left: var(--space-3);
        padding-right: var(--space-5);
        gap: var(--space-3);
    }
`;

export const LogoImg = styled.img`
    height: var(--space-5);
    display: block;
    flex-shrink: 0;

    @media (max-width: 360px) {
        height: var(--space-4);
    }
`;

export const BrandGroup = styled.div`
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);

    @media (max-width: 767px) {
        gap: var(--space-1);
    }
`;

export const BrandText = styled.span`
    font-family: var(--font-family);
    font-size: var(--font-size-title-1);
    font-weight: var(--font-weight-bold);
    line-height: var(--line-height-tight);
    color: var(--color-text-primary);
    letter-spacing: 0;

    @media (max-width: 767px) {
        font-size: var(--font-size-title-3);
    }
`;

export const SidebarToggle = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    height: calc(var(--space-8) + var(--space-2));
    padding: 0 var(--space-2);
    border: 0;
    background: transparent;
    color: var(--color-icon-primary);
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
        color: var(--color-icon-tertiary);
    }

    > svg + svg {
        margin-left: calc(var(--space-1) * -1);
    }
`;

export const DirectoryBadge = styled.span`
    font-size: var(--font-size-caption-1);
    font-weight: var(--font-weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-accent-darker);
    color: var(--color-text-primary);
    border: 1px solid var(--color-accent);
    flex-shrink: 0;

    @media (max-width: 500px) {
        display: none;
    }
`;

export const HeaderSpacer = styled.div`
    flex: 1;
    min-width: var(--space-2);
`;

export const HeaderNav = styled.nav`
    display: flex;
    align-items: center;
    gap: var(--space-2);

    @media (max-width: 500px) {
        gap: var(--space-2);
    }
`;

export const NavBtn = styled.a<{ $primary?: boolean }>`
    && {
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        font-size: var(--font-size-subhead);
        font-weight: var(--font-weight-semibold);
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
                      color: var(--color-text-primary) !important;
                      border: 1px solid var(--dir-accent);

                      &:hover {
                          background: var(--color-accent-deep);
                          box-shadow: var(--shadow-sm);
                          text-decoration: none !important;
                      }
                  `
                : css`
                      background: transparent;
                      color: var(--color-text-secondary) !important;
                      border: 1px solid var(--color-border);

                      &:hover {
                          background: var(--color-surface);
                          color: var(--color-text-primary) !important;
                          border-color: var(--color-border-strong);
                          text-decoration: none !important;
                      }
                  `}

        @media (max-width: 380px) {
            padding: var(--space-2) var(--space-3);
            font-size: var(--font-size-footnote);
        }
    }
`;

export const DesktopAuthGroup = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);

    @media (max-width: 500px) {
        display: none;
    }
`;

export const MobileAuthBtn = styled.a`
    && {
        display: none;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        font-size: var(--font-size-subhead);
        font-weight: var(--font-weight-semibold);
        text-decoration: none !important;
        cursor: pointer;
        white-space: nowrap;
        background: var(--dir-accent);
        color: var(--color-text-primary) !important;
        border: 1px solid var(--dir-accent);
        transition: all 0.15s;

        &:hover {
            background: var(--color-accent-deep);
        }

        @media (max-width: 500px) {
            display: inline-flex;
            align-items: center;
        }
    }
`;
