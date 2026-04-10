import styled, { css, keyframes } from "styled-components/macro";

// ─── Animations ───────────────────────────────────────────────────────────────

export const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
`;

// ─── Color helpers ────────────────────────────────────────────────────────────

export const ac = (a: number) => `rgba(0,119,182,${a})`;
export const cy = (a: number) => `rgba(0,180,216,${a})`;
export const gr = (a: number) => `rgba(16,185,129,${a})`;
export const or = (a: number) => `rgba(250,163,82,${a})`;
export const bk = (a: number) => `rgba(0,0,0,${a})`;

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export const Page = styled.div<{ $dark?: boolean }>`
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

export const Header = styled.header`
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

export const LogoImg = styled.img`
    height: 22px;
    display: block;
    flex-shrink: 0;
    @media (max-width: 360px) { height: 19px; }
`;

export const DirectoryBadge = styled.span`
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

export const HeaderSpacer = styled.div`flex: 1; min-width: 8px;`;

export const HeaderNav = styled.nav`
    display: flex;
    align-items: center;
    gap: 8px;
    @media (max-width: 500px) { gap: 6px; }
`;

export const NavBtn = styled.a<{ $primary?: boolean }>`
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

export const DesktopAuthGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    @media (max-width: 500px) { display: none; }
`;

export const MobileAuthBtn = styled.a`
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
