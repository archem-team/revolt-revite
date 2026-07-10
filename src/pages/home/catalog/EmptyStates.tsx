import { Capsule, Search, Store } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { Button } from "@revoltchat/ui";

// Shimmering placeholder card shown while a page of products loads, so the
// grid keeps its shape instead of collapsing to a spinner.
const SkeletonCard = styled.div`
    height: 224px;
    border-radius: 10px;
    background: linear-gradient(
        100deg,
        var(--secondary-background) 40%,
        var(--tertiary-background, var(--hover)) 50%,
        var(--secondary-background) 60%
    );
    background-size: 200% 100%;
    animation: catalog-shimmer 1.4s ease-in-out infinite;

    @keyframes catalog-shimmer {
        from {
            background-position: 120% 0;
        }
        to {
            background-position: -80% 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }

    @media (max-width: 520px) {
        height: 176px;
    }
`;

export function SkeletonCards({ count = 9 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <SkeletonCard key={i} />
            ))}
        </>
    );
}

const Empty = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 56px 24px;
    gap: 6px;

    h3 {
        margin: 18px 0 0;
        font-size: 19px;
        color: var(--foreground);
    }

    p {
        margin: 0;
        max-width: 380px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--secondary-foreground);
    }

    .cta {
        margin-top: 18px;
    }

    @media (max-width: 520px) {
        padding: 40px 16px;
    }
`;

// Decorative glyph on a soft accent halo with floating price chips —
// matches the Promos empty-state treatment.
const Glyph = styled.div`
    position: relative;
    width: 96px;
    height: 96px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--accent);
    background: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--accent) 22%, transparent),
        transparent 70%
    );

    &::before {
        content: "";
        position: absolute;
        inset: 18px;
        border-radius: 50%;
        border: 2px dashed color-mix(in srgb, var(--accent) 45%, transparent);
        animation: catalog-spin 18s linear infinite;
    }

    .float {
        position: absolute;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 7px;
        border-radius: 8px;
        color: var(--accent-contrast, #11171c);
        background: var(--accent);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        animation: catalog-bob 3.4s ease-in-out infinite;
    }

    .float.a {
        top: -6px;
        right: -14px;
    }

    .float.b {
        bottom: -2px;
        left: -18px;
        animation-delay: 1.2s;
        background: var(--primary-background);
        color: var(--accent);
    }

    @keyframes catalog-spin {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes catalog-bob {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-6px);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        &::before,
        .float {
            animation: none;
        }
    }
`;

export function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <Empty>
            <Glyph>
                <Store size={40} />
            </Glyph>
            <h3>Couldn&rsquo;t load the catalog</h3>
            <p>
                Something went wrong while fetching products. Check your
                connection and try again.
            </p>
            <div className="cta">
                <Button compact palette="secondary" onClick={onRetry}>
                    Retry
                </Button>
            </div>
        </Empty>
    );
}

export function NoMatchState({ onClear }: { onClear: () => void }) {
    return (
        <Empty>
            <Glyph>
                <Search size={40} />
            </Glyph>
            <h3>No products match</h3>
            <p>
                Try a different compound name, widen the price range, or clear
                the filters to browse the full catalog.
            </p>
            <div className="cta">
                <Button compact palette="secondary" onClick={onClear}>
                    Clear filters
                </Button>
            </div>
        </Empty>
    );
}

export function NoDataState() {
    return (
        <Empty>
            <Glyph>
                <span className="float a">$115</span>
                <span className="float b">10mg</span>
                <Capsule size={40} />
            </Glyph>
            <h3>The catalog is filling up</h3>
            <p>
                Vendors are still listing their products. Check back soon — new
                compounds and prices land here as communities publish their
                catalogs.
            </p>
        </Empty>
    );
}
