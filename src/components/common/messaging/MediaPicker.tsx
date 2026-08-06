import styled from "styled-components/macro";

import { useState } from "preact/hooks";

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

    width: calc(8 * 40px + 12px + 10px + 44px);
    height: 440px;

    max-width: calc(100vw - 20px);
    max-height: 75vh;

    display: flex;
    flex-direction: column;

    background: var(--background);
    border-radius: var(--radius-xl, 20px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
`;

const Tabs = styled.div`
    flex-shrink: 0;
    display: flex;
    gap: 4px;
    padding: 8px 10px 0;

    button {
        cursor: pointer;
        border: none;
        padding: 6px 14px;
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

type Tab = "emoji" | "gif";

interface Props {
    /** The emoji picker, rendered with its own panel chrome disabled. */
    children: (props: { embedded: true }) => preact.ComponentChild;
    onSelectGif: (url: string) => void;
    onClose: () => void;
}

export default function MediaPicker({ children, onSelectGif, onClose }: Props) {
    const [tab, setTab] = useState<Tab>("emoji");

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
