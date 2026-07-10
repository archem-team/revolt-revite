import styled from "styled-components/macro";

import { CompoundDot, compoundHue } from "./CompoundVisual";
import { COMPOUND_ALL, CompoundInfo } from "./utils";

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

const SidebarWrap = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 8px;

    @media (max-width: 768px) {
        display: none;
    }
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const Title = styled.div`
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tertiary-foreground);
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* Compound list can run long — keep it scrollable within the sidebar. */
    max-height: min(55vh, 480px);
    overflow-y: auto;
    scrollbar-width: thin;
`;

const Row = styled.button<{ active: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: none;
    border-radius: var(--border-radius);
    font-family: inherit;
    font-size: 13px;
    font-weight: ${(props) => (props.active ? 600 : 400)};
    text-align: left;
    cursor: pointer;
    color: ${(props) =>
        props.active ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) => (props.active ? "var(--accent)" : "transparent")};
    transition: background 0.1s ease-in-out;

    &:hover {
        background: ${(props) =>
            props.active ? "var(--accent)" : "var(--secondary-background)"};
    }

    .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .count {
        font-size: 11px;
        color: ${(props) =>
            props.active
                ? "var(--accent-contrast, #11171c)"
                : "var(--tertiary-foreground)"};
        opacity: ${(props) => (props.active ? 0.75 : 1)};
    }
`;

const PriceInputs = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;

    input {
        width: 100%;
        min-width: 0;
        height: 32px;
        padding: 0 8px;
        border: none;
        border-radius: var(--border-radius);
        background: var(--secondary-background);
        color: var(--foreground);
        font-family: inherit;
        font-size: 13px;
        box-sizing: border-box;

        &::placeholder {
            color: var(--tertiary-foreground);
        }

        &::-webkit-outer-spin-button,
        &::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        -moz-appearance: textfield;
    }

    .dash {
        color: var(--tertiary-foreground);
        flex-shrink: 0;
    }
`;

export interface FilterProps {
    compounds: CompoundInfo[];
    selected: string;
    onSelect: (compound: string) => void;
    minPrice: string;
    maxPrice: string;
    onMinPrice: (value: string) => void;
    onMaxPrice: (value: string) => void;
}

function PriceFields({
    minPrice,
    maxPrice,
    onMinPrice,
    onMaxPrice,
}: Pick<FilterProps, "minPrice" | "maxPrice" | "onMinPrice" | "onMaxPrice">) {
    return (
        <PriceInputs>
            <input
                type="number"
                min="0"
                placeholder="Min"
                value={minPrice}
                onInput={(e) =>
                    onMinPrice((e.target as HTMLInputElement).value)
                }
            />
            <span className="dash">–</span>
            <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxPrice}
                onInput={(e) =>
                    onMaxPrice((e.target as HTMLInputElement).value)
                }
            />
        </PriceInputs>
    );
}

export function CatalogSidebar(props: FilterProps) {
    const { compounds, selected, onSelect } = props;
    return (
        <SidebarWrap>
            {/* A lone "All products" row is noise — only render the facet
                once it has loaded. */}
            {compounds.length > 0 && (
                <Section>
                    <Title>Compounds</Title>
                    <List>
                        <Row
                            active={selected === COMPOUND_ALL}
                            onClick={() => onSelect(COMPOUND_ALL)}>
                            <span className="label">All products</span>
                        </Row>
                        {compounds.map((c) => (
                            <Row
                                key={c.compound}
                                active={selected === c.compound}
                                onClick={() => onSelect(c.compound)}>
                                <CompoundDot hue={compoundHue(c.compound)} />
                                <span className="label">{c.compound}</span>
                                <span className="count">{c.count}</span>
                            </Row>
                        ))}
                    </List>
                </Section>
            )}

            <Section>
                <Title>Price</Title>
                <PriceFields {...props} />
            </Section>
        </SidebarWrap>
    );
}

// ─── Mobile filter rail ───────────────────────────────────────────────────────
// On phones/tablets the sidebar is hidden; compounds become a horizontal chip
// rail and the price inputs slot in beside a compact label so every filter
// stays reachable.

const MobileWrap = styled.div`
    display: none;

    @media (max-width: 768px) {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
`;

const Rail = styled.div`
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
`;

const Chip = styled.button<{ active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 7px 12px;
    border: none;
    border-radius: 16px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    color: ${(props) =>
        props.active ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) =>
        props.active ? "var(--accent)" : "var(--secondary-background)"};
`;

const MobilePriceRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;

    .caption {
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--tertiary-foreground);
    }
`;

export function MobileFilters(props: FilterProps) {
    const { compounds, selected, onSelect } = props;
    return (
        <MobileWrap>
            {compounds.length > 0 && (
                <Rail>
                    <Chip
                        active={selected === COMPOUND_ALL}
                        onClick={() => onSelect(COMPOUND_ALL)}>
                        All
                    </Chip>
                    {compounds.map((c) => (
                        <Chip
                            key={c.compound}
                            active={selected === c.compound}
                            onClick={() => onSelect(c.compound)}>
                            <CompoundDot hue={compoundHue(c.compound)} />
                            {c.compound}
                        </Chip>
                    ))}
                </Rail>
            )}
            <MobilePriceRow>
                <span className="caption">Price</span>
                <PriceFields {...props} />
            </MobilePriceRow>
        </MobileWrap>
    );
}
