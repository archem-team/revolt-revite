import { X } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { useEffect, useRef, useState } from "preact/hooks";

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
    }

    .close {
        position: fixed;
        top: 18px;
        right: 18px;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
        cursor: pointer;
        transition: background 0.1s ease-in-out;

        &:hover {
            background: rgba(255, 255, 255, 0.24);
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
    src: string;
    onClose: () => void;
}

export default function ImageLightbox({ src, onClose }: Props) {
    // scale + pan offset (screen px), applied as translate(...) scale(...).
    const [t, setT] = useState({ scale: 1, x: 0, y: 0 });

    // Gesture bookkeeping kept in refs so handlers don't re-bind each frame.
    const pinch = useRef<{ dist: number; scale: number } | null>(null);
    const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
        null,
    );
    const lastTap = useRef(0);

    // Lock body scroll while open so the page behind doesn't move on mobile.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

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

    const onWheel = (e: WheelEvent) => {
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
        } else if (e.touches.length === 1 && t.scale > 1) {
            pan.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                tx: t.x,
                ty: t.y,
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
        pinch.current = null;
        pan.current = null;
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
    const onMouseMove = (e: MouseEvent) => {
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

    return (
        <LightboxBackdrop
            onClick={() => t.scale === 1 && onClose()}
            onWheel={onWheel}
            onMouseMove={onMouseMove}
            onMouseUp={endMouse}>
            <div className="close" onClick={onClose}>
                <X size={24} />
            </div>
            <img
                src={src}
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
            />
        </LightboxBackdrop>
    );
}
