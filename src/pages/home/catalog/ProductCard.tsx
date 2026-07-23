import { Store } from "@styled-icons/boxicons-regular";
import { BadgeCheck } from "@styled-icons/boxicons-solid";
import styled from "styled-components/macro";

import { CompoundVisual } from "./CompoundVisual";
import { CatalogItem, VendorInfo, priceParts } from "./utils";

const Card = styled.button`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px;
    border: none;
    border-radius: 10px;
    background: var(--secondary-background);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.12s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    }

    @media (prefers-reduced-motion: reduce) {
        transition: none;

        &:hover {
            transform: none;
        }
    }

    @media (max-width: 520px) {
        gap: 8px;
        padding: 10px;
    }
`;

const CardVendor = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    font-size: 12px;
    color: var(--secondary-foreground);

    img {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--primary-background);
    }

    .glyph {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        background: var(--primary-background);
        color: var(--tertiary-foreground);
    }

    .name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .verified {
        flex-shrink: 0;
        color: var(--accent);
        display: flex;
    }
`;

const CardName = styled.div`
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--foreground);

    /* keep cards even: clamp long product names to two lines */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    @media (max-width: 520px) {
        font-size: 13px;
    }
`;

const CardPrice = styled.div`
    margin-top: auto;
    display: flex;
    align-items: baseline;
    gap: 5px;
    flex-wrap: wrap;

    .from {
        font-size: 11px;
        color: var(--tertiary-foreground);
    }

    .amount {
        font-size: 18px;
        font-weight: 700;
        color: var(--foreground);
    }

    .range {
        font-size: 13px;
        font-weight: 500;
        color: var(--secondary-foreground);
    }

    @media (max-width: 520px) {
        .amount {
            font-size: 16px;
        }
    }
`;

const CardTags = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    span {
        font-size: 10px;
        font-weight: 600;
        line-height: 1;
        padding: 4px 7px;
        border-radius: 6px;
        background: var(--primary-background);
        color: var(--secondary-foreground);
    }

    @media (max-width: 520px) {
        display: none;
    }
`;

export function ProductCard({
    item,
    vendor,
    autumn,
    onOpen,
}: {
    item: CatalogItem;
    vendor?: VendorInfo;
    autumn: string;
    onOpen: (id: string) => void;
}) {
    const vendorName = vendor?.name ?? item.vendorName;
    const price = priceParts(item);

    return (
        <Card onClick={() => onOpen(item.id)}>
            <CompoundVisual
                compound={item.compound}
                fallback={item.product}
                categories={item.categories}
            />

            <CardVendor>
                {vendor?.logo ? (
                    <img
                        src={`${autumn}/icons/${vendor.logo}?max_side=64`}
                        loading="lazy"
                        onError={(e) =>
                            ((
                                e.currentTarget as HTMLImageElement
                            ).style.display = "none")
                        }
                    />
                ) : (
                    <div className="glyph">
                        <Store size={12} />
                    </div>
                )}
                <span className="name">{vendorName ?? "Unknown vendor"}</span>
                {item.serverId && (
                    <span className="verified" title="Linked community">
                        <BadgeCheck size={13} />
                    </span>
                )}
            </CardVendor>

            <CardName>{item.product}</CardName>

            <CardPrice>
                {price.hasRange && <span className="from">from</span>}
                <span className="amount">{price.from}</span>
                {price.to && <span className="range">– {price.to}</span>}
            </CardPrice>

            {item.categories.length > 0 && (
                <CardTags>
                    {item.categories.slice(0, 3).map((c) => (
                        <span key={c}>{c}</span>
                    ))}
                </CardTags>
            )}
        </Card>
    );
}
