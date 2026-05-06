import styled, { css } from "styled-components/macro";

import { fadeUp } from "./stylesLayout";

// ─── Badges ───────────────────────────────────────────────────────────────────

type BV = "accent" | "green" | "purple" | "orange" | "dim" | "teal" | "red";

const chipTone = css`
    background: var(--color-surface);
    color: var(--color-text-primary) !important;
    border-color: var(--color-border);
`;

const bv: Record<BV, ReturnType<typeof css>> = {
    accent: chipTone,
    green: chipTone,
    purple: chipTone,
    orange: chipTone,
    dim: chipTone,
    teal: chipTone,
    red: chipTone,
};

export const Badge = styled.span<{ $v?: BV }>`
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-caption-1);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0;
    border: 1px solid transparent;
    white-space: nowrap;
    position: relative;
    transition: transform 0.13s ease;
    ${(p) => bv[p.$v ?? "dim"]}

    &:hover {
        transform: translateY(-1px);
    }

    &[data-tip]::after {
        content: attr(data-tip);
        position: absolute;
        left: 50%;
        bottom: calc(100% + var(--space-2));
        transform: translate(-50%, var(--space-1));
        min-width: 220px;
        max-width: min(300px, 70vw);
        width: max-content;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        border: 1px solid var(--dir-border-table);
        background: var(--dir-surface-card);
        color: var(--foreground);
        box-shadow: none;
        font-size: var(--font-size-caption-1);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0;
        line-height: var(--line-height-normal);
        white-space: pre-line;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        z-index: 25;
        transition: opacity 0.13s ease, transform 0.13s ease;
    }

    &[data-tip]::before {
        content: "";
        position: absolute;
        left: 50%;
        bottom: calc(100% + var(--space-1));
        transform: translateX(-50%);
        border: var(--space-2) solid transparent;
        border-top-color: var(--dir-border-table);
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        z-index: 24;
        transition: opacity 0.13s ease;
    }

    &[data-tip]:hover::after,
    &[data-tip]:hover::before {
        opacity: 1;
        visibility: visible;
    }

    &[data-tip]:hover::after {
        transform: translate(-50%, 0);
    }

    &[data-guarantee-chip][data-tip]::after {
        background: #1C1720;
        color: var(--color-text-primary);
        border-color: #49454c;
    }

    &[data-guarantee-chip][data-tip]::before {
        border-top-color: #49454c;
    }

    @media (max-width: 767px) {
        &[data-guarantee-chip]:hover {
            transform: none;
        }

        &[data-guarantee-chip][data-tip]:hover::after,
        &[data-guarantee-chip][data-tip]:hover::before {
            opacity: 0;
            visibility: hidden;
        }

        &[data-tip]::after {
            left: 0;
            right: auto;
            bottom: calc(100% + var(--space-2));
            transform: translate(0, var(--space-1));
            min-width: 0;
            width: max-content;
            max-width: min(280px, calc(100vw - 42px));
            white-space: normal;
        }

        &[data-tip]:hover::after {
            transform: translate(0, 0);
        }

        &[data-tip]::before {
            left: var(--space-4);
            transform: translateX(0);
        }
    }
`;

export const BadgeRow = styled.div`
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
`;

// ─── Stars ────────────────────────────────────────────────────────────────────

export const Stars = styled.span`
    color: var(--warning);
    font-size: var(--font-size-footnote);
    letter-spacing: 0;
`;

export const StarNum = styled.span`
    font-size: var(--font-size-footnote);
    font-weight: var(--font-weight-bold);
    color: var(--warning);
    margin-left: var(--space-1);
`;

// ─── Community Card header row ────────────────────────────────────────────────

export const CommunityMeta = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
    margin-top: var(--space-1);
    font-size: var(--font-size-caption-1);
    color: var(--secondary-foreground);
`;

export const MetaItem = styled.span`
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap;
`;

export const JoinBtn = styled.a`
    && {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        font-size: var(--font-size-subhead);
        font-weight: var(--font-weight-bold);
        background: #662d91;
        color: var(--color-text-primary) !important;
        text-decoration: none !important;
        border: 1px solid #662d91;
        transition: background-color 0.13s, transform 0.13s;
        white-space: nowrap;
        cursor: pointer;
        box-shadow: var(--shadow-sm);

        &:hover {
            background: #5b277f;
            transform: translateY(-1px);
        }
    }
`;

// ─── Cards ────────────────────────────────────────────────────────────────────

export const CardGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: var(--space-3);

    @media (min-width: 481px) and (max-width: 767px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 480px) {
        grid-template-columns: 1fr;
        gap: var(--space-2);
    }
`;

export const Card = styled.div`
    background: var(--dir-surface-table);
    border: 1px solid var(--dir-border-table);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: background-color 0.2s, border-color 0.2s;
    box-shadow: none;

    &:hover {
        background: var(--dir-row-hover);
        border-color: var(--dir-border-table);
        box-shadow: none;
    }
`;

export const CardHead = styled.div`
    padding: var(--space-3) var(--space-4);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    cursor: pointer;
    user-select: none;
`;

export const CardLeft = styled.div`
    flex: 1;
    min-width: 0;
`;

export const CardName = styled.div`
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-subhead);
    margin-bottom: var(--space-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const CardRight = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-1);
    flex-shrink: 0;
`;

export const MobileMetaBadgesRow = styled.div`
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-2);

    @media (min-width: 768px) {
        display: none;
    }
`;

export const Chevron = styled.span<{ $open: boolean }>`
    font-size: var(--font-size-caption-1);
    color: var(--tertiary-foreground);
    transition: transform 0.18s;
    transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
    display: inline-block;
`;

export const CardDivider = styled.div`
    height: 1px;
    background: var(--dir-border-table);
    margin: 0 var(--space-4);
`;

export const CardBody = styled.div<{ $open: boolean }>`
    display: ${(p) => (p.$open ? "block" : "none")};
    padding: var(--space-3) var(--space-4);
    animation: ${fadeUp} 0.15s ease both;
`;

export const SectionLabel = styled.div`
    font-size: var(--font-size-caption-1);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--space-3) 0 var(--space-2);

    &:first-child {
        margin-top: 0;
    }
`;

export const InfoLine = styled.div`
    font-size: var(--font-size-footnote);
    color: var(--secondary-foreground);
    margin-bottom: var(--space-1);
    line-height: var(--line-height-loose);

    strong {
        color: var(--foreground);
        font-weight: var(--font-weight-semibold);
    }
`;

// ─── Desktop Table ────────────────────────────────────────────────────────────

export const TableWrap = styled.div`
    border: 1px solid var(--dir-border-table);
    border-radius: var(--radius-lg);
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    background: var(--dir-surface-table);
    box-shadow: none;

    @media (min-width: 768px) {
        scrollbar-width: thin;
        scrollbar-color: var(--color-border-strong) transparent;

        &::-webkit-scrollbar {
            height: var(--space-1);
        }

        &::-webkit-scrollbar-thumb {
            background: var(--color-border-strong);
            border-radius: var(--radius-xs);
        }
    }
`;

export const Table = styled.table`
    width: 100%;
    min-width: 900px;
    border-collapse: collapse;
    font-size: var(--font-size-subhead);

    @media (max-width: 1200px) {
        font-size: var(--font-size-footnote);

        th,
        td {
            padding: var(--space-2) var(--space-3);
        }
    }

    th {
        padding: var(--space-3) var(--space-3);
        text-align: left;
        font-size: var(--font-size-caption-1);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        background: var(--dir-surface-thead);
        border-bottom: 1px solid var(--dir-border-table);
        transition: color 0.12s;

        &:hover {
            color: var(--dir-accent);
        }
    }

    td {
        padding: var(--space-2) var(--space-3);
        border-top: 1px solid var(--dir-border-table);
        vertical-align: middle;
        background: #06000A ;
        color: var(--color-text-primary);
        transition: color 0.12s;
    }

    tbody tr:hover td {
        background: #1C1720;
    }
`;

export const TableName = styled.div`
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-subhead);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-bottom: var(--space-1);
    transition: color 0.12s;

    .verified {
        font-size: var(--font-size-caption-1);
        color: var(--color-success);
        font-weight: var(--font-weight-bold);
        flex-shrink: 0;
    }
`;

export const TableMeta = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-caption-1);
    color: var(--color-text-primary);
    flex-wrap: nowrap;
    white-space: nowrap;
    transition: color 0.12s;

    .sep {
        color: var(--block);
        user-select: none;
    }

    .online {
        color: var(--success);
    }
`;

// ─── Empty State ──────────────────────────────────────────────────────────────

export const EmptyState = styled.div`
    text-align: center;
    padding: var(--space-12) var(--space-5);
    color: var(--tertiary-foreground);

    .icon {
        font-size: var(--font-size-title-1);
        display: block;
        margin-bottom: var(--space-3);
        opacity: 1;
    }
`;
