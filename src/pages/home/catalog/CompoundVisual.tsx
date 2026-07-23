import {
    Capsule,
    Droplet,
    TestTube,
    Vial,
} from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

// Deterministic visual identity per compound: a stable hue hashed from the
// name drives a soft gradient tile with an oversized icon watermark, so the
// same compound always looks the same and the grid reads like a real
// storefront even though the API has no product photography.

/** Stable 0–359 hue from a string. */
export function compoundHue(name: string): number {
    let hash = 0;
    const key = name.toLowerCase();
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
}

/** Icon by dominant category — vials for GLP-1, capsules for peptides. */
export function categoryIcon(categories: string[] | undefined) {
    const joined = (categories ?? []).join(" ").toLowerCase();
    if (joined.includes("glp")) return Vial;
    if (joined.includes("peptide")) return Capsule;
    if (joined.includes("oil") || joined.includes("liquid")) return Droplet;
    return TestTube;
}

// Alpha-blended hsl layers over the theme background keep the tiles legible
// in both light and dark themes without hardcoding either.
const Tile = styled.div<{ hue: number; compact?: boolean }>`
    position: relative;
    height: ${(props) => (props.compact ? "58px" : "76px")};
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: linear-gradient(
            130deg,
            hsla(${(props) => props.hue}, 70%, 55%, 0.32),
            hsla(${(props) => (props.hue + 45) % 360}, 65%, 45%, 0.12) 70%
        ),
        var(--primary-background);

    .watermark {
        position: absolute;
        right: -10px;
        bottom: -16px;
        transform: rotate(-14deg);
        color: hsla(${(props) => props.hue}, 75%, 62%, 0.5);
        pointer-events: none;
    }

    .chip {
        position: absolute;
        left: 8px;
        bottom: 8px;
        max-width: calc(100% - 48px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        line-height: 1;
        padding: 4px 7px;
        border-radius: 6px;
        color: var(--foreground);
        background: color-mix(
            in srgb,
            var(--secondary-background) 78%,
            transparent
        );
        backdrop-filter: blur(4px);
    }
`;

export function CompoundVisual({
    compound,
    fallback,
    categories,
    compact,
}: {
    /** Derived compound name; drives colour and the corner chip. */
    compound?: string | null;
    /** Shown when no compound exists (e.g. product name). */
    fallback: string;
    categories?: string[];
    compact?: boolean;
}) {
    const label = compound || fallback;
    const hue = compoundHue(label);
    const Icon = categoryIcon(categories);

    return (
        <Tile hue={hue} compact={compact}>
            <Icon className="watermark" size={compact ? 64 : 84} />
            {compound && <span className="chip">{compound}</span>}
        </Tile>
    );
}

/** Small colour swatch used next to compound names in the sidebar/rail. */
export const CompoundDot = styled.span<{ hue: number }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: hsla(${(props) => props.hue}, 70%, 55%, 0.9);
`;
