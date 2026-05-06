import styled from "styled-components/macro";

import { fadeUp } from "./stylesLayout";

// ─── Modals ───────────────────────────────────────────────────────────────────

export const Overlay = styled.div`
    position: fixed;
    inset: 0;
    background: var(--color-scrim);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(var(--space-3), env(safe-area-inset-top, 0px))
        max(var(--space-3), env(safe-area-inset-right, 0px))
        max(var(--space-3), env(safe-area-inset-bottom, 0px))
        max(var(--space-3), env(safe-area-inset-left, 0px));
    box-sizing: border-box;

    @media (max-width: 768px) {
        align-items: flex-end;
        padding: 0;
        padding-bottom: env(safe-area-inset-bottom, 0px);
    }
`;

export const ModalBox = styled.div<{ $wide?: boolean }>`
    background: var(--dir-surface-modal);
    color: var(--foreground);
    border: 1px solid var(--dir-border-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: ${(p) => (p.$wide ? "580px" : "540px")};
    max-height: 88vh;
    overflow-y: auto;
    box-shadow: var(--dir-modal-shadow);
    animation: ${fadeUp} 0.18s ease both;

    @media (max-width: 768px) {
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        max-height: 92vh;
        border-bottom: none;
        padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    @media (max-width: 480px) {
        max-height: 92vh;
    }
`;

export const DragHandle = styled.div`
    display: none;
    width: var(--space-8);
    height: var(--space-1);
    background: var(--dir-overlay-lg);
    border-radius: var(--radius-xs);
    margin: var(--space-2) auto 0;

    @media (max-width: 768px) {
        display: block;
    }
`;

export const ModalHead = styled.div`
    padding: var(--space-5) var(--space-6) var(--space-4);
    border-bottom: 1px solid var(--dir-overlay-md);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);

    h2 {
        font-size: var(--font-size-body-2);
        font-weight: var(--font-weight-bold);
        margin: 0 0 var(--space-1);
        letter-spacing: 0;
        color: var(--color-text-primary);
    }

    @media (max-width: 480px) {
        padding: var(--space-4) var(--space-4) var(--space-3);

        h2 {
            font-size: var(--font-size-body-3);
        }
    }
`;

export const ModalClose = styled.button`
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    width: var(--space-6);
    height: var(--space-6);
    padding: 0;
    border-radius: var(--radius-pill);
    display: grid;
    place-items: center;
    font-size: var(--font-size-subhead);
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.12s;

    &:hover {
        background: var(--dir-accent);
        color: var(--color-text-primary);
    }
`;

export const ModalBody = styled.div`
    padding: var(--space-5) var(--space-6);

    @media (max-width: 480px) {
        padding: var(--space-4) var(--space-4) var(--space-5);
    }
`;

// ─── Form Elements ────────────────────────────────────────────────────────────

export const FormGroup = styled.div`
    margin-bottom: var(--space-3);

    label {
        display: block;
        font-size: var(--font-size-caption-1);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: var(--space-2);
    }

    input[type="text"],
    input[type="url"],
    textarea {
        width: 100%;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        background: var(--color-surface-alt);
        color: var(--foreground);
        font-size: var(--font-size-subhead);
        font-family: inherit;
        box-sizing: border-box;
        transition: border-color 0.12s;

        &::placeholder {
            color: var(--tertiary-foreground);
        }

        &:focus {
            outline: none;
            border-color: var(--dir-accent);
        }
    }

    textarea {
        min-height: 78px;
        resize: vertical;
    }
`;

export const CheckboxGrid = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
`;

export const CheckLabel = styled.label<{ $checked: boolean }>`
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
    border: 1px solid
        ${(p) => (p.$checked ? "var(--dir-accent)" : "var(--color-border)")};
    background: ${(p) =>
        p.$checked ? "var(--color-accent-darker)" : "var(--color-surface-alt)"};
    cursor: pointer;
    font-size: var(--font-size-footnote);
    font-weight: ${(p) =>
        p.$checked
            ? "var(--font-weight-semibold)"
            : "var(--font-weight-regular)"};
    color: ${(p) =>
        p.$checked
            ? "var(--color-text-primary)"
            : "var(--secondary-foreground)"};
    transition: all 0.1s;

    input {
        display: none;
    }

    &:hover {
        border-color: var(--dir-accent);
    }
`;

export const TypeToggle = styled.div`
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;

    @media (max-width: 380px) {
        flex-direction: column;
    }
`;

export const TypeBtn = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    border: 1px solid
        ${(p) => (p.$active ? "var(--dir-accent)" : "var(--color-border)")};
    background: ${(p) =>
        p.$active
            ? "var(--color-accent-darker)"
            : "var(--secondary-background)"};
    color: ${(p) =>
        p.$active
            ? "var(--color-text-primary)"
            : "var(--secondary-foreground)"};
    font-size: var(--font-size-body-4);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all 0.12s;

    &:hover {
        border-color: var(--dir-accent);
    }
`;

export const PrimaryBtn = styled.button`
    width: 100%;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--dir-accent);
    background: var(--dir-accent);
    color: var(--color-text-primary);
    font-size: var(--font-size-body-4);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    margin-top: var(--space-2);
    transition: all 0.15s;

    &:hover {
        background: var(--color-accent-deep);
        box-shadow: var(--shadow-sm);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export const ErrorMsg = styled.div`
    color: var(--color-danger);
    font-size: var(--font-size-footnote);
    margin-bottom: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-danger-subtle);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-danger-border);
`;

export const SuccessMsg = styled.div`
    text-align: center;
    padding: var(--space-5) 0;
    color: var(--color-success);
    font-size: var(--font-size-body-4);
    font-weight: var(--font-weight-semibold);
`;

// ─── Review cards ─────────────────────────────────────────────────────────────

export const RevCard = styled.div`
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--dir-overlay-md);

    &:last-child {
        border-bottom: none;
    }
`;

export const RevMeta = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    flex-wrap: wrap;

    .name {
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-subhead);
    }

    .date {
        font-size: var(--font-size-caption-1);
        color: var(--tertiary-foreground);
    }
`;
