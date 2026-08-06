import styled from "styled-components/macro";

import {
    CategoryInfo,
    DOSAGE_ALL,
    DosageInfo,
    GUARANTEE_FACETS,
    PAYMENT_FACETS,
    RATING_FACETS,
    VendorFacetCounts,
    VendorInfo,
    WAREHOUSE_FACETS,
} from "./utils";

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
    /* Dosage list can run long — keep it scrollable within the sidebar. */
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
    dosages: DosageInfo[];
    selected: string;
    onSelect: (dosage: string) => void;
    categories: CategoryInfo[];
    selectedCategories: string[];
    onToggleCategory: (category: string) => void;
    vendors: VendorInfo[];
    selectedVendors: string[];
    onToggleVendor: (serverId: string) => void;
    facetCounts: VendorFacetCounts;
    verified: boolean;
    onVerified: (value: boolean) => void;
    minRating: number;
    onMinRating: (value: number) => void;
    warehouses: string[];
    onToggleWarehouse: (key: string) => void;
    payment: string[];
    onTogglePayment: (key: string) => void;
    freeShipping: boolean;
    onFreeShipping: (value: boolean) => void;
    guarantees: string[];
    onToggleGuarantee: (key: string) => void;
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

/** A single toggle/select row with an optional count. */
function FacetRow({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <Row active={active} onClick={onClick}>
            <span className="label">{label}</span>
            {count != null && <span className="count">{count}</span>}
        </Row>
    );
}

/** Vendors sorted by product count so the fullest catalogs surface first. */
function sortedVendors(vendors: VendorInfo[]): VendorInfo[] {
    return [...vendors].sort((a, b) => b.productCount - a.productCount);
}

export function CatalogSidebar(props: FilterProps) {
    const {
        dosages,
        selected,
        onSelect,
        categories,
        selectedCategories,
        onToggleCategory,
        vendors,
        selectedVendors,
        onToggleVendor,
        facetCounts,
        verified,
        onVerified,
        minRating,
        onMinRating,
        warehouses,
        onToggleWarehouse,
        payment,
        onTogglePayment,
        freeShipping,
        onFreeShipping,
        guarantees,
        onToggleGuarantee,
    } = props;

    return (
        <SidebarWrap>
            {/* A lone "All products" row is noise — only render the facet
                once it has loaded. */}
            {dosages.length > 0 && (
                <Section>
                    <Title>Dosage</Title>
                    <List>
                        <FacetRow
                            label="All dosages"
                            active={selected === DOSAGE_ALL}
                            onClick={() => onSelect(DOSAGE_ALL)}
                        />
                        {dosages.map((d) => (
                            <FacetRow
                                key={d.dosage}
                                label={d.dosage}
                                count={d.count}
                                active={selected === d.dosage}
                                onClick={() => onSelect(d.dosage)}
                            />
                        ))}
                    </List>
                </Section>
            )}

            {categories.length > 0 && (
                <Section>
                    <Title>Category</Title>
                    <List>
                        {categories.map((c) => (
                            <FacetRow
                                key={c.category}
                                label={c.category}
                                count={c.count}
                                active={selectedCategories.includes(c.category)}
                                onClick={() => onToggleCategory(c.category)}
                            />
                        ))}
                    </List>
                </Section>
            )}

            {vendors.length > 0 && (
                <Section>
                    <Title>Vendor</Title>
                    <List>
                        {sortedVendors(vendors).map((v) => (
                            <FacetRow
                                key={v.serverId}
                                label={v.name}
                                count={v.productCount}
                                active={selectedVendors.includes(v.serverId)}
                                onClick={() => onToggleVendor(v.serverId)}
                            />
                        ))}
                    </List>
                </Section>
            )}

            <Section>
                <Title>Vendor quality</Title>
                <List>
                    <FacetRow
                        label="Verified only"
                        count={facetCounts.verified || undefined}
                        active={verified}
                        onClick={() => onVerified(!verified)}
                    />
                    <FacetRow
                        label="Free shipping"
                        count={facetCounts.freeShipping || undefined}
                        active={freeShipping}
                        onClick={() => onFreeShipping(!freeShipping)}
                    />
                </List>
            </Section>

            <Section>
                <Title>Minimum rating</Title>
                <List>
                    <FacetRow
                        label="Any rating"
                        active={minRating === 0}
                        onClick={() => onMinRating(0)}
                    />
                    {RATING_FACETS.map((r) => (
                        <FacetRow
                            key={r}
                            label={`${r}+ stars`}
                            active={minRating === r}
                            onClick={() => onMinRating(r)}
                        />
                    ))}
                </List>
            </Section>

            <Section>
                <Title>Location</Title>
                <List>
                    {WAREHOUSE_FACETS.map((w) => (
                        <FacetRow
                            key={w.key}
                            label={w.label}
                            count={facetCounts.warehouse[w.key] || undefined}
                            active={warehouses.includes(w.key)}
                            onClick={() => onToggleWarehouse(w.key)}
                        />
                    ))}
                </List>
            </Section>

            <Section>
                <Title>Payment</Title>
                <List>
                    {PAYMENT_FACETS.map((p) => (
                        <FacetRow
                            key={p.key}
                            label={p.label}
                            count={facetCounts.payment[p.key] || undefined}
                            active={payment.includes(p.key)}
                            onClick={() => onTogglePayment(p.key)}
                        />
                    ))}
                </List>
            </Section>

            <Section>
                <Title>Guarantees</Title>
                <List>
                    {GUARANTEE_FACETS.map((g) => (
                        <FacetRow
                            key={g.key}
                            label={g.label}
                            count={facetCounts.guarantee[g.key] || undefined}
                            active={guarantees.includes(g.key)}
                            onClick={() => onToggleGuarantee(g.key)}
                        />
                    ))}
                </List>
            </Section>

            <Section>
                <Title>Price</Title>
                <PriceFields {...props} />
            </Section>
        </SidebarWrap>
    );
}

// ─── Mobile filter rail ───────────────────────────────────────────────────────
// On phones/tablets the sidebar is hidden; dosages become a horizontal chip
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
    const {
        dosages,
        selected,
        onSelect,
        categories,
        selectedCategories,
        onToggleCategory,
        vendors,
        selectedVendors,
        onToggleVendor,
        verified,
        onVerified,
        minRating,
        onMinRating,
        warehouses,
        onToggleWarehouse,
        payment,
        onTogglePayment,
        freeShipping,
        onFreeShipping,
        guarantees,
        onToggleGuarantee,
    } = props;

    return (
        <MobileWrap>
            {dosages.length > 0 && (
                <Rail>
                    <Chip
                        active={selected === DOSAGE_ALL}
                        onClick={() => onSelect(DOSAGE_ALL)}>
                        All
                    </Chip>
                    {dosages.map((d) => (
                        <Chip
                            key={d.dosage}
                            active={selected === d.dosage}
                            onClick={() => onSelect(d.dosage)}>
                            {d.dosage}
                        </Chip>
                    ))}
                </Rail>
            )}

            {categories.length > 0 && (
                <Rail>
                    {categories.map((c) => (
                        <Chip
                            key={c.category}
                            active={selectedCategories.includes(c.category)}
                            onClick={() => onToggleCategory(c.category)}>
                            {c.category}
                        </Chip>
                    ))}
                </Rail>
            )}

            {vendors.length > 0 && (
                <Rail>
                    {sortedVendors(vendors).map((v) => (
                        <Chip
                            key={v.serverId}
                            active={selectedVendors.includes(v.serverId)}
                            onClick={() => onToggleVendor(v.serverId)}>
                            {v.name}
                        </Chip>
                    ))}
                </Rail>
            )}

            <Rail>
                <Chip active={verified} onClick={() => onVerified(!verified)}>
                    Verified
                </Chip>
                <Chip
                    active={freeShipping}
                    onClick={() => onFreeShipping(!freeShipping)}>
                    Free ship
                </Chip>
                {RATING_FACETS.map((r) => (
                    <Chip
                        key={r}
                        active={minRating === r}
                        onClick={() => onMinRating(minRating === r ? 0 : r)}>
                        {r}+ ★
                    </Chip>
                ))}
            </Rail>

            <Rail>
                {WAREHOUSE_FACETS.map((w) => (
                    <Chip
                        key={w.key}
                        active={warehouses.includes(w.key)}
                        onClick={() => onToggleWarehouse(w.key)}>
                        {w.label}
                    </Chip>
                ))}
                {PAYMENT_FACETS.map((p) => (
                    <Chip
                        key={p.key}
                        active={payment.includes(p.key)}
                        onClick={() => onTogglePayment(p.key)}>
                        {p.label}
                    </Chip>
                ))}
                {GUARANTEE_FACETS.map((g) => (
                    <Chip
                        key={g.key}
                        active={guarantees.includes(g.key)}
                        onClick={() => onToggleGuarantee(g.key)}>
                        {g.label}
                    </Chip>
                ))}
            </Rail>

            <MobilePriceRow>
                <span className="caption">Price</span>
                <PriceFields {...props} />
            </MobilePriceRow>
        </MobileWrap>
    );
}
