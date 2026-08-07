import { TrendingUp } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { useState } from "preact/hooks";

import { GifCategory } from "../../../lib/klipy";

import { shimmerSurface } from "./GifSkeleton";

/* Two columns of wide tiles, scrolled vertically by the parent. */
const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
`;

const Tile = styled.a`
    position: relative;
    display: grid;
    place-items: center;

    aspect-ratio: 16 / 9;
    overflow: hidden;
    cursor: pointer;
    border-radius: var(--radius-md, 8px);

    /* Each tile shimmers until its own artwork paints, so the grid fills
       in progressively instead of flashing 36 empty boxes. Dropped once
       loaded: the gradient is covered by then, and leaving 36 of them
       animating would repaint the panel forever for nothing. */
    ${shimmerSurface}

    &[data-loaded="true"] {
        background: var(--primary-header);
        animation: none;
    }

    img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        /* Dim the preview so the label stays legible over any GIF. */
        filter: brightness(0.5);
        transition: filter 120ms ease, transform 160ms ease;
    }

    span {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 8px;
        text-align: center;

        color: #fff;
        font-size: 0.95em;
        font-weight: 700;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }

    &:hover img {
        filter: brightness(0.65);
        transform: scale(1.04);
    }

    @media (prefers-reduced-motion: reduce) {
        img {
            transition: none;
        }

        &:hover img {
            transform: none;
        }
    }
`;

interface Props {
    categories: GifCategory[];
    /** Preview for the trending tile — the first trending GIF. */
    trendingPreview?: string;
    onPick: (query: string) => void;
    onTrending: () => void;
}

export default function GifCategories({
    categories,
    trendingPreview,
    onPick,
    onTrending,
}: Props) {
    const [loaded, setLoaded] = useState<Set<string>>(new Set());

    /** Settle a tile once its artwork paints, so its shimmer can stop. */
    function markLoaded(key: string) {
        setLoaded((previous) => new Set(previous).add(key));
    }

    return (
        <Grid>
            <Tile
                onClick={onTrending}
                data-loaded={!trendingPreview || loaded.has("__trending")}>
                {trendingPreview && (
                    <img
                        src={trendingPreview}
                        alt=""
                        draggable={false}
                        onLoad={() => markLoaded("__trending")}
                        onError={() => markLoaded("__trending")}
                    />
                )}
                <span>
                    <TrendingUp size={16} />
                    Trending
                </span>
            </Tile>
            {categories.map((category) => (
                <Tile
                    key={category.query}
                    data-loaded={loaded.has(category.query)}
                    onClick={() => onPick(category.query)}>
                    <img
                        src={category.preview}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        onLoad={() => markLoaded(category.query)}
                        onError={() => markLoaded(category.query)}
                    />
                    <span>{category.name}</span>
                </Tile>
            ))}
        </Grid>
    );
}
