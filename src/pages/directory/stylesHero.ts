import styled from "styled-components/macro";

import { fadeUp } from "./stylesLayout";

// ─── Hero ─────────────────────────────────────────────────────────────────────

export const Hero = styled.section`
    background: linear-gradient(
        160deg,
        var(--dir-hero-from) 0%,
        var(--dir-hero-mid) 58%,
        var(--dir-hero-to) 100%
    );
    padding: var(--space-8) var(--space-4) var(--space-8);
    text-align: center;
    position: relative;
    overflow: hidden;
    border-bottom: none;

    @media (max-width: 480px) {
        padding-left: max(var(--space-4), env(safe-area-inset-left, 0px));
        padding-right: max(var(--space-4), env(safe-area-inset-right, 0px));
    }

    @media (max-height: 480px) and (orientation: landscape) {
        padding-top: var(--space-5);
        padding-bottom: var(--space-5);
    }

    &::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: radial-gradient(
            var(--color-border-quiet) var(--space-1),
            transparent var(--space-1)
        );
        background-size: var(--space-6) var(--space-6);
        pointer-events: none;
        z-index: 0;
    }

    &::after {
        content: "";
        position: absolute;
        bottom: calc(var(--space-16) * -1);
        left: 50%;
        transform: translateX(-50%);
        width: min(700px, 100vw);
        height: 400px;
        background: radial-gradient(
            ellipse at 50% 80%,
            var(--color-accent) 0%,
            var(--color-accent-darker) 50%,
            transparent 75%
        );
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
    gap: var(--space-4);
    width: 100%;
    max-width: min(560px, 100%);
    margin: 0 auto;
    box-sizing: border-box;
    padding: 0;

    @media (max-width: 480px) {
        gap: var(--space-3);
    }
`;

export const HeroTitle = styled.h1`
    font-size: var(--font-size-title-1);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0;
    line-height: var(--line-height-tight);
    margin: 0;
    color: var(--color-text-primary);

    span {
        color: var(--color-text-tertiary);
    }

    @media (max-width: 480px) {
        font-size: var(--font-size-title-2);
    }
`;

export const HeroSub = styled.p`
    font-size: var(--font-size-callout);
    color: var(--color-text-secondary);
    margin: 0;
    line-height: var(--line-height-loose);
    max-width: min(440px, 100%);
    width: 100%;
    box-sizing: border-box;
`;

export const TabToggle = styled.div`
    display: inline-flex;
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-1);
    gap: var(--space-1);
    max-width: 100%;
    box-sizing: border-box;

    @media (max-width: 400px) {
        width: 100%;
        justify-content: stretch;
    }
`;

export const ToggleTab = styled.button<{ $active: boolean }>`
    padding: var(--space-2) var(--space-5);
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    font-size: var(--font-size-subhead);
    font-weight: var(--font-weight-semibold);
    transition: all 0.15s;
    background: ${(p) =>
        p.$active ? "var(--color-surface-inverse)" : "transparent"};
    color: ${(p) =>
        p.$active
            ? "var(--color-text-inverse)"
            : "var(--color-text-secondary)"};
    box-shadow: ${(p) => (p.$active ? "var(--shadow-sm)" : "none")};

    &:hover {
        background: ${(p) =>
            p.$active
                ? "var(--color-surface-inverse)"
                : "var(--color-surface)"};
        color: ${(p) =>
            p.$active
                ? "var(--color-text-inverse)"
                : "var(--color-text-primary)"};
    }

    @media (max-width: 480px) {
        padding: var(--space-2) var(--space-3);
        font-size: var(--font-size-subhead);
    }

    @media (max-width: 400px) {
        flex: 1;
        padding: var(--space-2) var(--space-2);
        font-size: var(--font-size-footnote);
    }
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

export const Main = styled.main`
    flex: 1;
    max-width: 1440px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-3) var(--space-16);
    width: 100%;
    box-sizing: border-box;

    @media (max-width: 767px) {
        padding-bottom: calc(var(--space-16) + var(--space-10));
    }

    @media (max-width: 480px) {
        padding-left: max(var(--space-3), env(safe-area-inset-left, 0px));
        padding-right: max(var(--space-3), env(safe-area-inset-right, 0px));
    }
`;

export const SectionHeader = styled.div`
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;

    h2 {
        font-size: var(--font-size-body-2);
        font-weight: var(--font-weight-bold);
        margin: 0;
        letter-spacing: 0;
        color: var(--foreground);
    }

    .count {
        font-size: var(--font-size-subhead);
        color: var(--tertiary-foreground);
    }
`;

// ─── Filter ───────────────────────────────────────────────────────────────────

export const FilterWrap = styled.div`
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
    align-items: flex-start;
`;

export const SearchWrap = styled.label`
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    width: 240px;
    height: var(--space-8);
    flex-shrink: 0;
    box-sizing: border-box;
    transition: border-color 0.14s;

    &:focus-within {
        border-color: var(--dir-accent);
    }

    .icon {
        font-size: var(--font-size-subhead);
        opacity: 1;
        color: var(--color-icon-secondary);
        flex-shrink: 0;
    }

    @media (max-width: 1024px) {
        flex: 1 1 200px;
        width: auto;
        min-width: 0;
        max-width: min(360px, 100%);
    }

    @media (max-width: 767px) {
        flex: 1;
        width: auto;
        max-width: none;
    }
`;

export const SearchInput = styled.input`
    flex: 1;
    padding: 0;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--foreground);
    font-size: var(--font-size-subhead);
    font-family: inherit;

    &::placeholder {
        color: var(--color-text-disabled);
    }

    &:focus {
        outline: none;
    }
`;

export const FilterToggleBtn = styled.button<{ $active?: boolean }>`
    background: var(--color-surface);
    border: 1px solid
        ${(p) => (p.$active ? "var(--dir-accent)" : "var(--color-border)")};
    border-radius: var(--radius-md);
    color: ${(p) =>
        p.$active ? "var(--dir-accent)" : "var(--color-text-primary)"};
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-3);
    height: var(--space-8);
    cursor: pointer;
    transition: all 0.14s;
    outline: none;
    flex-shrink: 0;

    &:hover {
        border-color: var(--dir-accent);
        color: var(--dir-accent);
    }

    svg {
        width: var(--space-4);
        height: var(--space-4);
        fill: currentColor;
    }

    @media (max-width: 767px) {
        display: flex;
    }
`;

export const MobileBreak = styled.div`
    display: none;

    @media (max-width: 767px) {
        display: block;
        flex-basis: 100%;
        height: 0;
    }
`;

export const FilterPills = styled.div<{ $showMobile: boolean }>`
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
    flex: 1;
    min-width: 0;

    @media (max-width: 767px) {
        display: ${(p) => (p.$showMobile ? "flex" : "none")};
        flex: 1 1 100%;
        width: 100%;
        background: var(--color-surface);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-border);
        box-shadow: none;
        animation: ${fadeUp} 0.15s ease both;
    }
`;

export const Pill = styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-3);
    height: var(--space-8);
    border-radius: var(--radius-pill);
    border: 1px solid
        ${(p) => (p.$active ? "var(--dir-accent)" : "var(--color-border)")};
    background: ${(p) =>
        p.$active ? "var(--color-accent-darker)" : "var(--color-surface)"};
    color: var(--color-text-primary);
    font-size: var(--font-size-footnote);
    font-weight: ${(p) =>
        p.$active
            ? "var(--font-weight-semibold)"
            : "var(--font-weight-regular)"};
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s;

    &:hover {
        border-color: var(--dir-accent);
        background: var(--color-accent-darker);
    }

    @media (max-width: 480px) {
        min-height: var(--space-8);
        padding: var(--space-2) var(--space-3);
    }
`;

export const ClearBtn = styled.button`
    padding: var(--space-1) var(--space-2);
    border: none;
    background: none;
    color: var(--tertiary-foreground);
    font-size: var(--font-size-footnote);
    cursor: pointer;
    transition: color 0.12s;

    &:hover {
        color: var(--dir-accent);
    }
`;

export const LegendToggle = styled.button`
    padding: 0 var(--space-3);
    height: var(--space-8);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--tertiary-foreground);
    font-size: var(--font-size-footnote);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s;

    &:hover {
        border-color: var(--secondary-foreground);
        color: var(--foreground);
    }

    @media (max-width: 767px) {
        flex: 0 0 auto;
        align-self: flex-start;
    }
`;

export const LegendBox = styled.div`
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    margin-bottom: var(--space-4);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-6) var(--space-8);
    animation: ${fadeUp} 0.18s ease both;

    @media (max-width: 767px) {
        padding: var(--space-4);
        grid-template-columns: 1fr 1fr;
        gap: var(--space-4);
    }

    @media (max-width: 480px) {
        grid-template-columns: 1fr;
    }
`;

export const LegendCat = styled.div`
    h4 {
        font-size: var(--font-size-caption-1);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin: 0 0 var(--space-2);
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    li {
        font-size: var(--font-size-footnote);
        color: var(--color-text-primary);
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        line-height: var(--line-height-loose);

        span {
            font-weight: var(--font-weight-bold);
            color: var(--color-text-primary);
            min-width: var(--space-16);
            flex-shrink: 0;
        }
    }
`;
