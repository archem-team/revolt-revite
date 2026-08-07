import styled from "styled-components/macro";

import { klipyEnabled } from "../../../lib/klipy";

import GifPicker from "./GifPicker";

/**
 * One panel housing the emoji and GIF pickers, opened from a single
 * composer button. Geometry matches @revoltchat/ui's Picker, which
 * renders `embedded` inside here so there is one surface, not two
 * stacked sheets.
 */
const Base = styled.div`
    overflow: hidden;
    user-select: none;
    position: absolute;
    z-index: 3;

    right: 10px;
    bottom: 10px;

    /* Width tracks the emoji grid's own maths (9 columns of 40px, plus
       row padding, scrollbar and the category rail) so neither tab ends
       up with dead space. Both axes shrink to the viewport, so the panel
       still fits a short window or a phone. */
    width: min(calc(9 * 40px + 12px + 10px + 44px), calc(100vw - 20px));
    height: min(560px, calc(100vh - 120px));

    display: flex;
    flex-direction: column;

    background: var(--background);
    border-radius: var(--radius-xl, 20px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
`;

const Tabs = styled.div`
    flex-shrink: 0;
    display: flex;
    gap: 6px;
    padding: 12px 14px 4px;

    button {
        cursor: pointer;
        border: none;
        padding: 7px 16px;
        font-size: 0.75em;
        font-weight: 600;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        font-family: inherit;
        color: var(--secondary-foreground);
        background: transparent;
        border-radius: var(--radius-xl, 20px);
        transition: background-color 80ms ease, color 80ms ease;

        &:hover {
            color: var(--foreground);
        }

        &[data-active="true"] {
            color: var(--foreground);
            background: var(--primary-header);
        }
    }
`;

const Body = styled.div`
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
`;

export type MediaTab = "emoji" | "gif";

interface Props {
    /** The emoji picker, rendered with its own panel chrome disabled. */
    children: (props: { embedded: true }) => preact.ComponentChild;
    /** Controlled by the composer, so each button opens its own tab. */
    tab: MediaTab;
    setTab: (tab: MediaTab) => void;
    onSelectGif: (url: string) => void;
    onClose: () => void;
}

export default function MediaPicker({
    children,
    tab,
    setTab,
    onSelectGif,
    onClose,
}: Props) {
    // Without a KLIPY key there is nothing to switch to, so the panel is
    // just the emoji picker as before.
    if (!klipyEnabled) return <>{children({ embedded: true })}</>;

    return (
        <Base>
            <Tabs>
                <button
                    data-active={tab === "emoji"}
                    onClick={() => setTab("emoji")}>
                    Emoji
                </button>
                <button
                    data-active={tab === "gif"}
                    onClick={() => setTab("gif")}>
                    GIF
                </button>
            </Tabs>
            <Body>
                {tab === "emoji" ? (
                    children({ embedded: true })
                ) : (
                    <GifPicker onSelect={onSelectGif} onClose={onClose} />
                )}
            </Body>
        </Base>
    );
}
