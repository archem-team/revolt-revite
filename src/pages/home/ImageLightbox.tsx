import {
    ChevronLeft,
    ChevronRight,
    X,
} from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { useEffect, useRef, useState } from "preact/hooks";
import type {
    MouseEvent as ReactMouseEvent,
    WheelEvent as ReactWheelEvent,
} from "react";

// Full-screen image dialog. Supports double-tap / wheel zoom, two-finger
// pinch, and drag-to-pan. Native pinch is disabled app-wide
// (user-scalable=no), so gestures are handled manually.
const LightboxBackdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.82);
    animation: promo-fade 0.12s ease-out;
    overflow: hidden;
    touch-action: none;

    .lightbox-content {
        display: contents;
    }

    img {
        max-width: 92vw;
        max-height: 88vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
        user-select: none;
        -webkit-user-drag: none;
        will-change: transform;
        transition: transform 0.08s ease-out;
        animation: lightbox-image-in 180ms cubic-bezier(0.2, 0.75, 0.25, 1);
    }

    @keyframes lightbox-image-in {
        from {
            opacity: 0;
            filter: blur(2px);
            transform: scale(0.985);
        }
        to {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        img {
            animation: none;
        }
    }

    .close,
    .nav {
        position: fixed;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
        cursor: pointer;
        transition: background 0.1s ease-in-out;
        z-index: 1;

        &:hover {
            background: rgba(255, 255, 255, 0.24);
        }

        &:focus-visible {
            outline: 2px solid #fff;
            outline-offset: 2px;
        }
    }

    .close {
        top: 18px;
        right: 18px;
    }

    .nav {
        top: 50%;
        transform: translateY(-50%);
    }

    .previous {
        left: 18px;
    }

    .next {
        right: 18px;
    }

    .counter {
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        padding: 5px 10px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        z-index: 1;
    }

    @media (max-width: 600px) {
        padding: 12px;

        .previous {
            left: 8px;
        }

        .next {
            right: 8px;
        }
    }

    @keyframes promo-fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;

const MAX_ZOOM = 5;

interface Props {
    images: string[];
    initialIndex?: number;
    onClose: () => void;
}

export default function ImageLightbox({
    images,
    initialIndex = 0,
    onClose,
}: Props) {
    const [index, setIndex] = useState(() =>
        Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
    );
    // scale + pan offset (screen px), applied as translate(...) scale(...).
    const [t, setT] = useState({ scale: 1, x: 0, y: 0 });

    // Gesture bookkeeping kept in refs so handlers don't re-bind each frame.
    const pinch = useRef<{ dist: number; scale: number } | null>(null);
    const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
        null,
    );
    const swipe = useRef<{ x: number; y: number } | null>(null);
    const lastTap = useRef(0);

    // Lock the app's actual scroll container while open. The document itself is
    // fixed; Home's overlay owns page scrolling.
    useEffect(() => {
        const scrollRoot = document.querySelector<HTMLElement>(
            "[data-home-scroll]",
        );
        const previousOverflow = scrollRoot?.style.overflowY;
        const previousBodyOverflow = document.body.style.overflow;

        if (scrollRoot) scrollRoot.style.overflowY = "hidden";
        else document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (images.length > 1 && e.key === "ArrowLeft") {
                setIndex((current) =>
                    (current - 1 + images.length) % images.length,
                );
            }
            if (images.length > 1 && e.key === "ArrowRight") {
                setIndex((current) => (current + 1) % images.length);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            if (scrollRoot) {
                scrollRoot.style.overflowY = previousOverflow || "";
            } else {
                document.body.style.overflow = previousBodyOverflow;
            }
            document.removeEventListener("keydown", onKey);
        };
    }, [images.length, onClose]);

    useEffect(() => {
        setIndex(
            Math.min(
                Math.max(initialIndex, 0),
                Math.max(images.length - 1, 0),
            ),
        );
    }, [images, initialIndex]);

    useEffect(() => {
        setT({ scale: 1, x: 0, y: 0 });
    }, [index]);

    const clamp = (s: number) => Math.min(MAX_ZOOM, Math.max(1, s));
    const touchDist = (ts: TouchList) =>
        Math.hypot(
            ts[0].clientX - ts[1].clientX,
            ts[0].clientY - ts[1].clientY,
        );

    const toggleZoom = () =>
        setT((p) =>
            p.scale > 1 ? { scale: 1, x: 0, y: 0 } : { ...p, scale: 2.5 },
        );

    const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        setT((p) => {
            const scale = clamp(p.scale - e.deltaY * 0.002);
            return scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...p, scale };
        });
    };

    const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
            pinch.current = { dist: touchDist(e.touches), scale: t.scale };
            pan.current = null;
            swipe.current = null;
        } else if (e.touches.length === 1 && t.scale > 1) {
            pan.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                tx: t.x,
                ty: t.y,
            };
            swipe.current = null;
        } else if (e.touches.length === 1) {
            swipe.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };
        }
    };

    const onTouchMove = (e: TouchEvent) => {
        if (pinch.current && e.touches.length === 2) {
            e.preventDefault();
            const ratio = touchDist(e.touches) / pinch.current.dist;
            setT((p) => ({ ...p, scale: clamp(pinch.current!.scale * ratio) }));
        } else if (pan.current && e.touches.length === 1) {
            e.preventDefault();
            setT((p) => ({
                ...p,
                x: pan.current!.tx + (e.touches[0].clientX - pan.current!.x),
                y: pan.current!.ty + (e.touches[0].clientY - pan.current!.y),
            }));
        }
    };

    const onTouchEnd = (e: TouchEvent) => {
        const swipeStart = swipe.current;
        pinch.current = null;
        pan.current = null;
        swipe.current = null;

        // At the normal zoom level, a deliberate horizontal swipe advances the
        // gallery. Panning remains reserved for zoomed images.
        if (
            t.scale <= 1 &&
            images.length > 1 &&
            swipeStart &&
            e.changedTouches.length > 0
        ) {
            const deltaX = e.changedTouches[0].clientX - swipeStart.x;
            const deltaY = e.changedTouches[0].clientY - swipeStart.y;
            const isHorizontalSwipe =
                Math.abs(deltaX) >= 48 &&
                Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

            if (isHorizontalSwipe) {
                setIndex((current) =>
                    deltaX < 0
                        ? (current + 1) % images.length
                        : (current - 1 + images.length) % images.length,
                );
                lastTap.current = 0;
                return;
            }
        }

        // Snap back to centred when fully zoomed out.
        setT((p) => (p.scale <= 1 ? { scale: 1, x: 0, y: 0 } : p));
        // Double-tap to toggle zoom.
        if (e.touches.length === 0) {
            const now = Date.now();
            if (now - lastTap.current < 300) {
                toggleZoom();
                lastTap.current = 0;
            } else {
                lastTap.current = now;
            }
        }
    };

    // Mouse drag-to-pan when zoomed (desktop).
    const onMouseDown = (e: MouseEvent) => {
        if (t.scale <= 1) return;
        e.preventDefault();
        pan.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
    };
    const onMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (!pan.current) return;
        setT((p) => ({
            ...p,
            x: pan.current!.tx + (e.clientX - pan.current!.x),
            y: pan.current!.ty + (e.clientY - pan.current!.y),
        }));
    };
    const endMouse = () => {
        pan.current = null;
    };

    if (images.length === 0) return null;

    const showPrevious = () =>
        setIndex((current) =>
            (current - 1 + images.length) % images.length,
        );
    const showNext = () =>
        setIndex((current) => (current + 1) % images.length);

    return (
        <LightboxBackdrop
            onClick={() => t.scale === 1 && onClose()}
            onWheel={onWheel}
            onMouseMove={onMouseMove}
            onMouseUp={endMouse}>
            <div className="lightbox-content">
                <button
                    type="button"
                    className="close"
                    aria-label="Close image gallery"
                    onClick={(event) => {
                        event.stopPropagation();
                        onClose();
                    }}>
                    <X size={24} />
                </button>
                {images.length > 1 && (
                    <>
                        <button
                            type="button"
                            className="nav previous"
                            aria-label="Previous promotion photo"
                            onClick={(event) => {
                                event.stopPropagation();
                                showPrevious();
                            }}>
                            <ChevronLeft size={28} />
                        </button>
                        <button
                            type="button"
                            className="nav next"
                            aria-label="Next promotion photo"
                            onClick={(event) => {
                                event.stopPropagation();
                                showNext();
                            }}>
                            <ChevronRight size={28} />
                        </button>
                        <span className="counter" aria-live="polite">
                            {index + 1} {"/"} {images.length}
                        </span>
                    </>
                )}
                <img
                    key={`${index}-${images[index]}`}
                    src={images[index]}
                    alt={`Promotion photo ${index + 1} of ${images.length}`}
                    style={{
                        transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
                        cursor:
                            t.scale > 1
                                ? pan.current
                                    ? "grabbing"
                                    : "grab"
                                : "zoom-in",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDblClick={toggleZoom}
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onTouchCancel={() => {
                        pinch.current = null;
                        pan.current = null;
                        swipe.current = null;
                    }}
                />
            </div>
        </LightboxBackdrop>
    );
}
