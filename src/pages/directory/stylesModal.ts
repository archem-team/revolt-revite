import styled from "styled-components/macro";
import { ac, fadeUp } from "./stylesLayout";

// ─── Modals ───────────────────────────────────────────────────────────────────

export const Overlay = styled.div`
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
    @media (max-width: 768px) { align-items: flex-end; padding: 0; padding-bottom: env(safe-area-inset-bottom, 0px); }
`;

export const ModalBox = styled.div<{ $wide?: boolean }>`
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
    @media (max-width: 768px) { border-radius: 12px 12px 0 0; max-height: 92vh; border-bottom: none; padding-bottom: env(safe-area-inset-bottom, 0px); }
    @media (max-width: 480px) { max-height: 92vh; }
`;

export const DragHandle = styled.div`
    display: none;
    width: 32px; height: 3px;
    background: var(--dir-overlay-lg);
    border-radius: 2px;
    margin: 8px auto 0;
    @media (max-width: 768px) { display: block; }
`;

export const ModalHead = styled.div`
    padding: 18px 22px 14px;
    border-bottom: 1px solid var(--dir-overlay-md);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    h2 { font-size: 16px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.2px; }
    @media (max-width: 480px) { padding: 14px 16px 12px; h2 { font-size: 15px; } }
`;

export const ModalClose = styled.button`
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

export const ModalBody = styled.div`
    padding: 18px 22px;
    @media (max-width: 480px) { padding: 14px 16px 18px; }
`;

// ─── Form Elements ────────────────────────────────────────────────────────────

export const FormGroup = styled.div`
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

export const CheckboxGrid = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;

export const CheckLabel = styled.label<{ $checked: boolean }>`
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

export const TypeToggle = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
    flex-wrap: wrap;
    @media (max-width: 380px) { flex-direction: column; }
`;

export const TypeBtn = styled.button<{ $active: boolean }>`
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

export const PrimaryBtn = styled.button`
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

export const ErrorMsg = styled.div`
    color: var(--error);
    font-size: 12px;
    margin-bottom: 10px;
    padding: 7px 11px;
    background: rgba(237,66,69,0.08);
    border-radius: 6px;
    border: 1px solid rgba(237,66,69,0.2);
`;

export const SuccessMsg = styled.div`
    text-align: center;
    padding: 18px 0;
    color: var(--success);
    font-size: 14px;
    font-weight: 600;
`;

// ─── Review cards ─────────────────────────────────────────────────────────────

export const RevCard = styled.div`
    padding: 12px 0;
    border-bottom: 1px solid var(--dir-overlay-md);
    &:last-child { border-bottom: none; }
`;

export const RevMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 6px;
    flex-wrap: wrap;
    .name { font-weight: 600; font-size: 13px; }
    .date { font-size: 11px; color: var(--tertiary-foreground); }
`;
