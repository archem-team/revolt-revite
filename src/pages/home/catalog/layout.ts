import styled from "styled-components/macro";

export const Wrapper = styled.div`
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

export const Toolbar = styled.div`
    display: flex;
    gap: 10px;
    align-items: center;

    @media (max-width: 480px) {
        flex-wrap: wrap;
    }
`;

export const SearchWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;

    input {
        padding-left: 42px;
        padding-right: 42px;
    }

    .search-icon {
        position: absolute;
        left: 14px;
        color: var(--tertiary-foreground);
        pointer-events: none;
    }

    .clear {
        position: absolute;
        right: 12px;
        display: flex;
        cursor: pointer;
        color: var(--tertiary-foreground);

        &:hover {
            color: var(--foreground);
        }
    }

    @media (max-width: 480px) {
        flex-basis: 100%;
    }
`;

export const SortSelect = styled.select`
    height: 38px;
    padding: 0 32px 0 12px;
    border: none;
    border-radius: var(--border-radius);
    background-color: var(--secondary-background);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23848484' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    color: var(--foreground);
    font-family: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    flex-shrink: 0;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;

    @media (max-width: 480px) {
        flex: 1;
    }
`;

// Sidebar + grid on desktop; single column with the mobile filter rail on
// narrow screens. Tablets keep the sidebar but tighter.
export const Body = styled.div`
    display: grid;
    grid-template-columns: 210px 1fr;
    gap: 20px;
    align-items: start;

    @media (max-width: 1024px) {
        grid-template-columns: 180px 1fr;
        gap: 16px;
    }

    @media (max-width: 768px) {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
`;

export const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;

    /* Phones: two compact columns beat one giant card per row. */
    @media (max-width: 520px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }
`;

export const ResultMeta = styled.div`
    font-size: 12px;
    color: var(--tertiary-foreground);
    margin-bottom: 8px;
`;

export const Pagination = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 16px;

    button {
        height: 38px;
        padding: 0 18px;
        border: none;
        border-radius: var(--border-radius);
        background: var(--secondary-background);
        color: var(--foreground);
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.1s ease-in-out;

        &:hover:not(:disabled) {
            background: var(--accent);
            color: var(--accent-contrast, #11171c);
        }

        &:disabled {
            opacity: 0.35;
            cursor: default;
        }
    }

    span {
        font-size: 13px;
        color: var(--secondary-foreground);
    }
`;
