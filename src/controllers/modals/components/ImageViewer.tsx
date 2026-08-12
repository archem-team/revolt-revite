/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · component: bounded message image carousel · genre: atmospheric · theme: existing PepChat */
import { ChevronLeft, ChevronRight } from "@styled-icons/boxicons-regular";
import styled from "styled-components";

import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { Modal } from "@revoltchat/ui";

import AttachmentActions from "../../../components/common/messaging/attachments/AttachmentActions";
import EmbedMediaActions from "../../../components/common/messaging/embed/EmbedMediaActions";
import { useClient } from "../../client/ClientController";
import { ModalProps } from "../types";

const Viewer = styled.div`
    display: flex;
    overflow: hidden;
    flex-direction: column;
    border-end-end-radius: 4px;
    border-end-start-radius: 4px;

    max-width: 100vw;

    .stage {
        position: relative;
        display: grid;
        place-items: center;
        min-width: min(90vw, 320px);
        touch-action: pan-y pinch-zoom;
    }

    img {
        width: auto;
        height: auto;
        max-width: 90vw;
        max-height: 75vh;
        object-fit: contain;
        border-bottom: thin solid var(--tertiary-foreground);

        -webkit-touch-callout: default;
    }

    .navigation {
        position: absolute;
        inset-block-start: 50%;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-pill);
        color: var(--foreground);
        background: color-mix(in srgb, var(--background) 82%, transparent);
        transform: translateY(-50%);
        cursor: pointer;
    }

    .navigation.previous {
        inset-inline-start: var(--space-3);
    }

    .navigation.next {
        inset-inline-end: var(--space-3);
    }

    .navigation:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 2px;
    }

    .navigation:active:not(:disabled) {
        background: var(--secondary-background);
    }

    .navigation:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .counter {
        position: absolute;
        inset-block-start: var(--space-3);
        inset-inline-start: 50%;
        min-width: 54px;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-pill);
        color: var(--foreground);
        background: color-mix(in srgb, var(--background) 82%, transparent);
        font-size: var(--font-size-subhead);
        font-variant-numeric: tabular-nums;
        text-align: center;
        transform: translateX(-50%);
        pointer-events: none;
    }

    @media (hover: hover) and (pointer: fine) {
        .navigation:hover:not(:disabled) {
            background: var(--secondary-background);
        }
    }
`;

export default function ImageViewer({
    embed,
    attachment,
    attachments,
    ...props
}: ModalProps<"image_viewer">) {
    const client = useClient();
    const gallery = (attachments ?? (attachment ? [attachment] : [])).filter(
        (item) => item.metadata.type === "Image",
    );
    const initialIndex = attachment
        ? Math.max(
              0,
              gallery.findIndex((item) => item._id === attachment._id),
          )
        : 0;
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const currentAttachment = gallery[currentIndex];
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < gallery.length - 1;

    const showPrevious = useCallback(
        () => setCurrentIndex((index) => Math.max(0, index - 1)),
        [],
    );
    const showNext = useCallback(
        () =>
            setCurrentIndex((index) => Math.min(gallery.length - 1, index + 1)),
        [gallery.length],
    );

    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [attachment?._id, attachments, initialIndex]);

    useEffect(() => {
        if (gallery.length <= 1) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft" && hasPrevious) {
                event.preventDefault();
                showPrevious();
            } else if (event.key === "ArrowRight" && hasNext) {
                event.preventDefault();
                showNext();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [gallery.length, hasNext, hasPrevious, showNext, showPrevious]);

    if (attachment && attachment.metadata.type !== "Image") {
        console.warn(
            `Attempted to use a non valid attatchment type in the image viewer: ${attachment.metadata.type}`,
        );
        return null;
    }

    return (
        <Modal {...props} transparent maxHeight="100vh" maxWidth="100vw">
            <Viewer>
                {currentAttachment && (
                    <>
                        <div
                            className="stage"
                            onTouchStart={(event) => {
                                const touch = event.touches[0];
                                touchStart.current = touch
                                    ? { x: touch.clientX, y: touch.clientY }
                                    : null;
                            }}
                            onTouchEnd={(event) => {
                                const start = touchStart.current;
                                const touch = event.changedTouches[0];
                                touchStart.current = null;
                                if (!start || !touch) return;

                                const deltaX = touch.clientX - start.x;
                                const deltaY = touch.clientY - start.y;
                                if (
                                    Math.abs(deltaX) < 50 ||
                                    Math.abs(deltaX) <= Math.abs(deltaY)
                                ) {
                                    return;
                                }

                                if (deltaX < 0 && hasNext) showNext();
                                if (deltaX > 0 && hasPrevious) showPrevious();
                            }}>
                            <img
                                key={currentAttachment._id}
                                loading="eager"
                                src={client.generateFileURL(currentAttachment)}
                                alt={`${currentAttachment.filename} · ${
                                    currentIndex + 1
                                } of ${gallery.length}`}
                                width={
                                    (currentAttachment.metadata as any).width
                                }
                                height={
                                    (currentAttachment.metadata as any).height
                                }
                            />
                            {gallery.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        className="navigation previous"
                                        aria-label="Previous image"
                                        disabled={!hasPrevious}
                                        onClick={showPrevious}>
                                        <ChevronLeft size={28} />
                                    </button>
                                    <button
                                        type="button"
                                        className="navigation next"
                                        aria-label="Next image"
                                        disabled={!hasNext}
                                        onClick={showNext}>
                                        <ChevronRight size={28} />
                                    </button>
                                    <span
                                        className="counter"
                                        aria-live="polite">
                                        {currentIndex + 1} {"of"}{" "}
                                        {gallery.length}
                                    </span>
                                </>
                            )}
                        </div>
                        <AttachmentActions attachment={currentAttachment} />
                    </>
                )}
                {embed && (
                    <>
                        <img
                            loading="eager"
                            src={client.proxyFile(embed.url)}
                            width={embed.width}
                            height={embed.height}
                        />
                        <EmbedMediaActions embed={embed} />
                    </>
                )}
            </Viewer>
        </Modal>
    );
}
