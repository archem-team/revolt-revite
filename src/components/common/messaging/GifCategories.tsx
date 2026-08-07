import { TrendingUp } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { GifCategory } from "../../../lib/klipy";

/* Three columns, scrolled vertically by the parent. Narrower tiles fit
   more reactions per screen; auto-fill keeps them from turning into
   slivers if the panel is ever squeezed. */
const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
`;

const Tile = styled.a`
    position: relative;
    display: grid;
    place-items: center;

    aspect-ratio: 16 / 9;
    overflow: hidden;
    cursor: pointer;
    border-radius: var(--radius-md, 8px);
    background: var(--primary-header);

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
        justify-content: center;
        gap: 4px;
        padding: 0 6px;
        text-align: center;

        color: #fff;
        font-size: 0.8em;
        font-weight: 700;
        line-height: 1.2;
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
    return (
        <Grid>
            <Tile onClick={onTrending}>
                {trendingPreview && (
                    <img src={trendingPreview} alt="" draggable={false} />
                )}
                <span>
                    <TrendingUp size={16} />
                    Trending
                </span>
            </Tile>
            {categories.map((category) => (
                <Tile
                    key={category.query}
                    onClick={() => onPick(category.query)}>
                    <img
                        src={category.preview}
                        alt=""
                        loading="lazy"
                        draggable={false}
                    />
                    <span>{category.name}</span>
                </Tile>
            ))}
        </Grid>
    );
}
