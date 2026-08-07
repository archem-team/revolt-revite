import styled, { css, keyframes } from "styled-components/macro";

import { useMemo } from "preact/hooks";

/**
 * Placeholders for the GIF panel, in the shape of whatever is loading:
 * category tiles when browsing, masonry blocks when fetching results.
 *
 * Same shimmer language as MessageSkeleton — one gradient swept across
 * every shape, flat and still under `prefers-reduced-motion`.
 */

const shimmer = keyframes`
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
`;

/** Also used by the tiles themselves, to cover each image's own load. */
export const shimmerSurface = css`
    background: linear-gradient(
        90deg,
        var(--tertiary-background) 25%,
        color-mix(in srgb, var(--tertiary-background) 88%, var(--foreground))
            50%,
        var(--tertiary-background) 75%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s infinite;

    @media (prefers-reduced-motion: reduce) {
        background: var(--tertiary-background);
        animation: none;
    }
`;

const Shape = styled.div.attrs({ "data-component": "skeleton-shape" })`
    ${shimmerSurface}
    border-radius: var(--radius-md, 8px);
`;

const Tiles = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;

    ${Shape} {
        aspect-ratio: 16 / 9;
    }
`;

/* Matches the results masonry, so the swap to real GIFs doesn't shift
   the layout more than the differing heights already do. */
const Masonry = styled.div`
    column-count: 3;
    column-gap: 8px;

    ${Shape} {
        margin-bottom: 8px;
    }
`;

/* Fills the panel and clips at its edge: the shapes are furniture, not
   content, so a partly-cut last row reads better than a short grid
   floating above dead space — and it must never raise a scrollbar. */
const Base = styled.div`
    flex-grow: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0 14px 14px;
    pointer-events: none;
    user-select: none;
`;

interface Props {
    variant: "tiles" | "results";
    count?: number;
}

export default function GifSkeleton({ variant, count }: Props) {
    // Enough to overfill the tallest panel the viewport allows; the
    // overflow is clipped rather than scrolled.
    const total = count ?? (variant === "tiles" ? 24 : 21);

    // Fixed per mount — re-renders must not re-roll the heights.
    const heights = useMemo(
        () =>
            Array.from(
                { length: total },
                () => `${Math.floor(Math.random() * 50 + 70)}px`,
            ),
        [total],
    );

    if (variant === "tiles") {
        return (
            <Base>
                <Tiles>
                    {heights.map((_, i) => (
                        <Shape key={i} />
                    ))}
                </Tiles>
            </Base>
        );
    }

    return (
        <Base>
            <Masonry>
                {heights.map((height, i) => (
                    <Shape key={i} style={{ height }} />
                ))}
            </Masonry>
        </Base>
    );
}
