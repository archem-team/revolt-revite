import styled from "styled-components/macro";

export const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.65);
    animation: catalog-fade 0.12s ease-out;

    @keyframes catalog-fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    /* Bottom sheet on phones — easier one-handed reach and dismissal. */
    @media (max-width: 600px) {
        place-items: end stretch;
        padding: 0;
    }
`;

export const Sheet = styled.div`
    width: 100%;
    max-width: 520px;
    max-height: min(86vh, 640px);
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: 12px;
    background: var(--primary-background);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
    overflow-y: auto;

    @media (max-width: 600px) {
        max-width: none;
        max-height: 88vh;
        border-radius: 14px 14px 0 0;
        padding: 16px;
        animation: catalog-sheet-up 0.18s ease-out;

        @keyframes catalog-sheet-up {
            from {
                transform: translateY(24px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
    }

    @media (prefers-reduced-motion: reduce) {
        animation: none !important;
    }
`;

export const Head = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;

    .title {
        flex: 1;
        min-width: 0;

        h3 {
            margin: 0;
            font-size: 18px;
            line-height: 1.3;
            color: var(--foreground);
        }

        .sku {
            margin-top: 4px;
            font-size: 11px;
            color: var(--tertiary-foreground);
        }
    }

    .close {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        color: var(--tertiary-foreground);
        background: var(--secondary-background);
        cursor: pointer;
        transition: color 0.1s ease-in-out;

        &:hover {
            color: var(--foreground);
        }
    }
`;

export const VendorBlock = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--secondary-background);

    img,
    .glyph {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    img {
        object-fit: cover;
        background: var(--primary-background);
    }

    .glyph {
        display: grid;
        place-items: center;
        background: var(--primary-background);
        color: var(--tertiary-foreground);
    }

    .meta {
        flex: 1;
        min-width: 0;

        .name {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 14px;
            font-weight: 600;
            color: var(--foreground);

            svg {
                color: var(--accent);
                flex-shrink: 0;
            }
        }

        .sub {
            font-size: 12px;
            color: var(--tertiary-foreground);
        }
    }
`;

export const ActionIcon = styled.div`
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;

    & > svg {
        display: block;
        color: var(--accent-contrast, #11171c);
    }

    &:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
    }
`;

export const VariationTable = styled.div`
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    overflow: hidden;
    background: var(--secondary-background);
`;

export const VariationRow = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 10px 12px;
    font-size: 13px;

    & + & {
        border-top: 1px solid var(--primary-background);
    }

    .dosage {
        font-weight: 600;
        color: var(--foreground);
    }

    .qty {
        color: var(--secondary-foreground);
    }

    .price {
        margin-left: auto;
        font-weight: 600;
        color: var(--foreground);
        white-space: nowrap;
    }

    .unit {
        color: var(--tertiary-foreground);
        font-weight: 400;
        font-size: 12px;
    }
`;

export const VariationNote = styled.div`
    padding: 0 12px 10px;
    font-size: 12px;
    color: var(--tertiary-foreground);
    background: var(--secondary-background);
`;

export const Meta = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    span {
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        padding: 5px 8px;
        border-radius: 6px;
        background: var(--secondary-background);
        color: var(--secondary-foreground);
    }
`;

export const Centered = styled.div`
    display: flex;
    justify-content: center;
    color: var(--tertiary-foreground);
    font-size: 14px;
    margin: 32px 0;
`;
