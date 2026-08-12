/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · component: bounded accessible message image carousel · genre: atmospheric · theme: existing PepChat */
import { ChevronLeft, ChevronRight, X } from "@styled-icons/boxicons-regular";
import styled from "styled-components";

import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { Modal } from "@revoltchat/ui";

import { useTranslation } from "../../../lib/i18n";

import AttachmentActions from "../../../components/common/messaging/attachments/AttachmentActions";
import EmbedMediaActions from "../../../components/common/messaging/embed/EmbedMediaActions";
import { useClient } from "../../client/ClientController";
import { modalController } from "../ModalController";
import { ModalProps } from "../types";

const Viewer = styled.div`
    position: relative;
    display: flex;
    max-width: 100vw;
    overflow: hidden;
    flex-direction: column;
    border-end-end-radius: var(--radius-sm);
    border-end-start-radius: var(--radius-sm);

    &:focus {
        outline: none;
    }

    .stage {
        position: relative;
        display: grid;
        place-items: center;
        min-width: min(90vw, 320px);
        min-height: min(60vh, 360px);
        overflow: hidden;
        background: var(--background);
        touch-action: pan-y pinch-zoom;
    }

    .stageImage {
        display: block;
        width: auto;
        height: auto;
        max-width: 90vw;
        max-height: 75vh;
        object-fit: contain;
        border-bottom: thin solid var(--tertiary-foreground);
        -webkit-touch-callout: default;
    }

    .status {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        padding: var(--space-4);
        color: var(--secondary-foreground);
        background: var(--background);
        text-align: center;
    }

    .errorActions {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: var(--space-3);
    }

    .retry {
        min-height: 40px;
        padding: 0 var(--space-4);
        border: 0;
        border-radius: var(--radius-md);
        color: var(--foreground);
        background: var(--secondary-background);
        cursor: pointer;
        font: inherit;
    }

    .navigation,
    .close {
        position: absolute;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-pill);
        color: var(--foreground);
        background: color-mix(in srgb, var(--background) 82%, transparent);
        cursor: pointer;
    }

    .navigation {
        inset-block-start: 50%;
        transform: translateY(-50%);
    }

    .navigation.previous {
        inset-inline-start: var(--space-3);
    }

    .navigation.next {
        inset-inline-end: var(--space-3);
    }

    .close {
        inset-block-start: var(--space-3);
        inset-inline-end: var(--space-3);
    }

    .navigation:focus-visible,
    .close:focus-visible,
    .retry:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 2px;
    }

    .navigation:active:not(:disabled),
    .close:active:not(:disabled),
    .retry:active:not(:disabled) {
        background: var(--tertiary-background);
    }

    .navigation:disabled,
    .close:disabled,
    .retry:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .counter {
        position: absolute;
        z-index: 2;
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
        .navigation:hover:not(:disabled),
        .close:hover:not(:disabled),
        .retry:hover:not(:disabled) {
            background: var(--tertiary-background);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .navigation,
        .close,
        .retry {
            transition: none;
        }
    }
`;

const FOCUSABLE = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "textarea:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
].join(",");

type ImageState = "loading" | "loaded" | "error";

export default function ImageViewer({
    embed,
    attachment,
    attachments,
    ...props
}: ModalProps<"image_viewer">) {
    const client = useClient();
    const translate = useTranslation();
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
    const [imageState, setImageState] = useState<ImageState>("loading");
    const [retryAttempt, setRetryAttempt] = useState(0);
    const [displaySource, setDisplaySource] = useState("");
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const loadVersion = useRef(0);
    const currentAttachment = gallery[currentIndex];
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < gallery.length - 1;

    const previewSource = currentAttachment
        ? client.generateFileURL(currentAttachment, { max_side: 1600 }, true)!
        : embed
        ? client.proxyFile(embed.url) ?? ""
        : "";
    const originalSource = currentAttachment
        ? client.generateFileURL(currentAttachment)!
        : previewSource;
    const sourceWithRetry = previewSource
        ? `${previewSource}${
              previewSource.includes("?") ? "&" : "?"
          }retry=${retryAttempt}`
        : "";

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
        loadVersion.current += 1;
        setImageState("loading");
        setDisplaySource(sourceWithRetry);
    }, [currentAttachment?._id, embed?.url, retryAttempt, sourceWithRetry]);

    useEffect(() => {
        for (const index of [currentIndex - 1, currentIndex + 1]) {
            const item = gallery[index];
            if (!item) continue;
            const image = new Image();
            image.decoding = "async";
            image.src = client.generateFileURL(item, { max_side: 1600 }, true)!;
        }
    }, [client, currentIndex, gallery]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        let portalRoot: HTMLElement = dialog;
        while (
            portalRoot.parentElement &&
            portalRoot.parentElement !== document.body
        ) {
            portalRoot = portalRoot.parentElement;
        }

        const background = Array.from(document.body.children).filter(
            (element): element is HTMLElement =>
                element instanceof HTMLElement && element !== portalRoot,
        );
        const previousState = background.map((element) => ({
            element,
            inert: element.hasAttribute("inert"),
            ariaHidden: element.getAttribute("aria-hidden"),
        }));
        for (const element of background) {
            element.setAttribute("inert", "");
            element.setAttribute("aria-hidden", "true");
        }

        const focusFrame = requestAnimationFrame(() =>
            closeRef.current?.focus(),
        );
        const trapFocus = (event: KeyboardEvent) => {
            if (event.key !== "Tab") return;
            const focusable = Array.from(
                dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
            ).filter((element) => element.offsetParent !== null);
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", trapFocus, true);

        return () => {
            cancelAnimationFrame(focusFrame);
            document.removeEventListener("keydown", trapFocus, true);
            for (const state of previousState) {
                if (!state.inert) state.element.removeAttribute("inert");
                if (state.ariaHidden === null) {
                    state.element.removeAttribute("aria-hidden");
                } else {
                    state.element.setAttribute("aria-hidden", state.ariaHidden);
                }
            }
            previouslyFocused?.focus();
        };
    }, []);

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
            `Attempted to use a non valid attachment type in the image viewer: ${attachment.metadata.type}`,
        );
        return null;
    }

    const filename = currentAttachment?.filename ?? embed?.url ?? "";
    const viewerLabel = translate("app.main.channel.media.viewer", {
        filename,
    });

    const onImageLoad = () => {
        setImageState("loaded");
        if (!currentAttachment || displaySource === originalSource) return;

        const version = loadVersion.current;
        const original = new Image();
        original.decoding = "async";
        original.onload = () => {
            if (loadVersion.current === version)
                setDisplaySource(originalSource);
        };
        original.src = originalSource;
    };

    return (
        <Modal {...props} transparent maxHeight="100vh" maxWidth="100vw">
            <Viewer
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={viewerLabel}
                tabIndex={-1}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.stopPropagation();
                }}>
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
                    {displaySource && imageState !== "error" && (
                        <img
                            key={`${
                                currentAttachment?._id ?? embed?.url
                            }-${displaySource}`}
                            className="stageImage"
                            loading="eager"
                            decoding="async"
                            src={displaySource}
                            alt={filename}
                            width={
                                currentAttachment
                                    ? (currentAttachment.metadata as any).width
                                    : embed?.width
                            }
                            height={
                                currentAttachment
                                    ? (currentAttachment.metadata as any).height
                                    : embed?.height
                            }
                            onLoad={onImageLoad}
                            onError={() => setImageState("error")}
                        />
                    )}
                    {imageState === "loading" && (
                        <div
                            className="status"
                            role="status"
                            aria-live="polite">
                            {translate("app.main.channel.media.loading_image")}
                        </div>
                    )}
                    {imageState === "error" && (
                        <div className="status" role="alert">
                            <div className="errorActions">
                                <span>
                                    {translate(
                                        "app.main.channel.media.failed_image",
                                    )}
                                </span>
                                <button
                                    type="button"
                                    className="retry"
                                    onClick={() =>
                                        setRetryAttempt(
                                            (attempt) => attempt + 1,
                                        )
                                    }>
                                    {translate("app.main.channel.media.retry")}
                                </button>
                            </div>
                        </div>
                    )}
                    <button
                        ref={closeRef}
                        type="button"
                        className="close"
                        aria-label={translate(
                            "app.main.channel.media.close_viewer",
                        )}
                        onClick={() => modalController.pop("close")}>
                        <X size={26} aria-hidden="true" />
                    </button>
                    {gallery.length > 1 && (
                        <>
                            <button
                                type="button"
                                className="navigation previous"
                                aria-label={translate(
                                    "app.main.channel.media.previous_image",
                                )}
                                disabled={!hasPrevious}
                                onClick={showPrevious}>
                                <ChevronLeft size={28} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className="navigation next"
                                aria-label={translate(
                                    "app.main.channel.media.next_image",
                                )}
                                disabled={!hasNext}
                                onClick={showNext}>
                                <ChevronRight size={28} aria-hidden="true" />
                            </button>
                            <span className="counter" aria-live="polite">
                                {currentIndex + 1} {"/"} {gallery.length}
                            </span>
                        </>
                    )}
                </div>
                {currentAttachment && (
                    <AttachmentActions attachment={currentAttachment} />
                )}
                {embed && <EmbedMediaActions embed={embed} />}
            </Viewer>
        </Modal>
    );
}
