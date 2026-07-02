/**
 * Material Design "grid_3x3" glyph — the hashtag icon for text
 * channels (copied from @material-design-icons/svg/outlined/grid_3x3.svg).
 * Inlined so we don't pull in the whole icon set for one glyph.
 */
export function Grid3x3({ size = 24 }: { size?: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor">
            <path d="M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z" />
        </svg>
    );
}
