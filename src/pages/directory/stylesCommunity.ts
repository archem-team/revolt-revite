import styled, { css } from "styled-components/macro";
import { ac, cy, gr, or, fadeUp } from "./stylesLayout";

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

export const Badge = styled.span<{ $v?: BV }>`
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

export const BadgeRow = styled.div`display: flex; gap: 4px; flex-wrap: wrap;`;

// ─── Stars ────────────────────────────────────────────────────────────────────

export const Stars = styled.span`color: var(--warning); font-size: 12px; letter-spacing: 0.5px;`;
export const StarNum = styled.span`font-size: 12px; font-weight: 700; color: var(--warning); margin-left: 3px;`;

// ─── Community Card header row ────────────────────────────────────────────────

export const CommunityMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 5px;
    font-size: 11.5px;
    color: var(--secondary-foreground);
`;

export const MetaItem = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
`;

export const JoinBtn = styled.a`
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

export const CardGrid = styled.div`
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

export const Card = styled.div`
    background: var(--dir-surface-card);
    border: 1px solid var(--dir-border-card);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 2px 8px ${ac(0.06)};
    &:hover { border-color: ${cy(0.6)}; transform: translateY(-3px); box-shadow: 0 10px 32px ${ac(0.12)}; }
`;

export const CardHead = styled.div`
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    user-select: none;
    &:hover { background: var(--dir-overlay-sm); }
`;

export const CardLeft = styled.div`flex: 1; min-width: 0;`;

export const CardName = styled.div`
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const CardRight = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
    flex-shrink: 0;
`;

export const Chevron = styled.span<{ $open: boolean }>`
    font-size: 10px;
    color: var(--tertiary-foreground);
    transition: transform 0.18s;
    transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
    display: inline-block;
`;

export const CardDivider = styled.div`height: 1px; background: var(--dir-overlay-md); margin: 0 16px;`;

export const CardBody = styled.div<{ $open: boolean }>`
    display: ${(p) => (p.$open ? "block" : "none")};
    padding: 14px 16px;
    animation: ${fadeUp} 0.15s ease both;
`;

export const SectionLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    color: var(--dir-accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 12px 0 6px;
    &:first-child { margin-top: 0; }
`;

export const InfoLine = styled.div`
    font-size: 12px;
    color: var(--secondary-foreground);
    margin-bottom: 4px;
    line-height: 1.5;
    strong { color: var(--foreground); font-weight: 600; }
`;

// ─── Desktop Table ────────────────────────────────────────────────────────────

export const TableWrap = styled.div`
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

export const Table = styled.table`
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

export const TableName = styled.div`
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

export const TableMeta = styled.div`
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

export const EmptyState = styled.div`
    text-align: center;
    padding: clamp(40px, 12vw, 72px) clamp(16px, 4vw, 20px);
    color: var(--tertiary-foreground);
    .icon { font-size: clamp(28px, 8vw, 36px); display: block; margin-bottom: 12px; opacity: 0.4; }
`;
