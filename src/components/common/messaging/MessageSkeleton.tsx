import styled, { css, keyframes } from "styled-components/macro";

import { useEffect, useMemo, useRef } from "preact/hooks";

/**
 * Skeleton placeholder rows shown while messages load: an avatar circle,
 * a name bar and one to three content bars per fake message, swept by a
 * single coherent shimmer (background-attachment: fixed keeps the
 * gradient aligned across every bar).
 */

const shimmer = keyframes`
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
`;

const Base = styled.div<{ align?: "start" | "end"; wall?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: var(--message-group-spacing, 12px);
    justify-content: ${(props) =>
        props.align === "start" ? "flex-start" : "flex-end"};
    flex-grow: 1;
    overflow: hidden;
    pointer-events: none;
    user-select: none;

    /* Edge "wall": a tall clipped block of ghosts at the ends of loaded
       history, so scrolling into unfetched territory reads as endless
       messages rather than a hard edge (reference uses 100rem). */
    ${(props) =>
        props.wall &&
        css`
            height: 100rem;
            flex-grow: 0;
            flex-shrink: 0;
        `}
`;

/* Mirrors the real message row geometry (54px gutter + 8px gap) so the
   swap from skeleton to content doesn't shift anything. */
const Row = styled.div`
    display: flex;
    gap: 8px;
    flex-shrink: 0;
`;

const AvatarFrame = styled.div`
    width: 54px;
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    padding: 2px 4px;
`;

const Lines = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const Frame = styled.div`
    /* The two stops need a visible step for the sweep to read (the
       reference uses its two lightest surfaces ~10 tones apart) — lift
       the highlight from the base surface instead of pairing two
       near-identical darks. */
    background: linear-gradient(
        90deg,
        var(--tertiary-background) 25%,
        color-mix(in srgb, var(--tertiary-background) 88%, var(--foreground))
            50%,
        var(--tertiary-background) 75%
    );
    background-size: 200% 100%;
    background-attachment: fixed;
    animation: ${shimmer} 1.5s infinite;
`;

const AvatarShape = styled(Frame)`
    width: 36px;
    height: 36px;
    border-radius: 50%;
`;

const NameShape = styled(Frame)`
    height: 0.8em;
    border-radius: 4px;
`;

const ContentShape = styled(Frame)`
    height: var(--message-size, 14px);
    border-radius: 4px;
`;

interface Props {
    count?: number;
    align?: "start" | "end";
    wall?: boolean;
    /** Called when the skeleton becomes visible (fetch sentinel). */
    onVisible?: () => void;
    /** Observer active only while true — recreated after each fetch, so a
     *  still-visible wall automatically pulls the next page. */
    permitFetching?: boolean;
}

export default function MessageSkeleton({
    count = 30,
    align,
    wall,
    onVisible,
    permitFetching,
}: Props) {
    const base = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = base.current;
        if (!el || !onVisible || permitFetching === false) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) onVisible();
                }
            },
            {
                // Observe within the message scroller, not the window.
                root: el.closest("[data-scroll-offset]"),
            },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [onVisible, permitFetching]);

    // Fixed per mount — re-renders must not re-roll the widths.
    const rows = useMemo(
        () =>
            Array.from({ length: count }, () => ({
                name: `${Math.floor(Math.random() * 5 + 5)}em`,
                lines: Array.from(
                    { length: Math.ceil(Math.random() * 3) },
                    () => `${Math.floor(Math.random() * 10 + 15)}em`,
                ),
            })),
        [count],
    );

    return (
        <Base ref={base} align={align} wall={wall}>
            {rows.map((row, i) => (
                <Row key={i}>
                    <AvatarFrame>
                        <AvatarShape />
                    </AvatarFrame>
                    <Lines>
                        <NameShape style={{ width: row.name }} />
                        {row.lines.map((width, j) => (
                            <ContentShape key={j} style={{ width }} />
                        ))}
                    </Lines>
                </Row>
            ))}
        </Base>
    );
}
