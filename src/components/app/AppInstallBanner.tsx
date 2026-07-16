import { isAndroid, isIOS } from "react-device-detect";
import styled from "styled-components/macro";

import { useEffect, useState } from "preact/hooks";

/**
 * Height of the banner. Kept in sync with the `--app-banner-height` CSS
 * variable so the rest of the app can reserve space for it (see
 * `src/styles/_page.scss` and `src/context/Theme.tsx`).
 */
const BANNER_HEIGHT = 44;

/**
 * How long a dismissal is respected before the banner shows again.
 */
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 1 day

const DISMISS_KEY = "appInstallBannerDismissedAt";

/**
 * Store links (locale-neutral; the stores resolve the visitor's storefront).
 */
const IOS_URL = "https://apps.apple.com/app/id6756353165";
const ANDROID_URL =
    "https://play.google.com/store/apps/details?id=com.zekochat";

/**
 * iPadOS 13+ Safari reports a desktop (macOS) user-agent, so react-device-detect
 * flags it as macOS and `isIOS` is false. Detect it via the Mac UA + a touch
 * screen (real Macs report 0 touch points; iPads report several). Treated as iOS.
 */
const isIpadOS =
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 1 &&
    /Macintosh/.test(navigator.userAgent);

const isApple = isIOS || isIpadOS;

const Banner = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9000;

    height: ${BANNER_HEIGHT}px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;

    font-size: 13px;
    user-select: none;
    color: var(--foreground);
    background: var(--secondary-background);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);

    .text {
        flex-grow: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .open {
        flex-shrink: 0;
        padding: 6px 12px;
        border-radius: var(--border-radius);
        background: var(--accent);
        color: var(--accent-contrast, #fff);
        font-weight: 600;
        cursor: pointer;
    }

    .dismiss {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        cursor: pointer;
        color: var(--tertiary-foreground);
        font-size: 20px;
        line-height: 1;
    }
`;

/**
 * Decide whether the install banner should be shown on this load.
 * Only mobile-web (iOS / Android browser, not the desktop-native build),
 * and not dismissed within the last day.
 */
function shouldShow(): boolean {
    if (window.isNative) return false;
    if (!isApple && !isAndroid) return false;

    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (raw) {
            const ts = parseInt(raw, 10);
            if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_DURATION) {
                return false;
            }
        }
    } catch (e) {
        // localStorage may be unavailable (private mode); default to showing.
    }

    return true;
}

/**
 * Dismissible banner nudging mobile-web users towards the native apps.
 */
export default function AppInstallBanner() {
    const [visible, setVisible] = useState(shouldShow);

    // Reserve / release vertical space for the fixed banner.
    useEffect(() => {
        const root = document.documentElement.style;
        root.setProperty(
            "--app-banner-height",
            visible ? `${BANNER_HEIGHT}px` : "0px",
        );
        return () => root.setProperty("--app-banner-height", "0px");
    }, [visible]);

    if (!visible) return null;

    const url = isApple ? IOS_URL : ANDROID_URL;

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISS_KEY, Date.now().toString());
        } catch (e) {
            // ignore write failures
        }
        setVisible(false);
    };

    return (
        <Banner>
            <div className="text">
                {"⚡Faster, with reply notifications — Get the app"}
            </div>
            {/* Opening the store does NOT dismiss — a user who bounces off the
                store without installing should keep seeing the nudge. Only the
                explicit × below persists a dismissal. */}
            <a
                className="open"
                href={url}
                target="_blank"
                rel="noreferrer">
                {"Open App"}
            </a>
            <div className="dismiss" onClick={dismiss} aria-label="Dismiss">
                {"×"}
            </div>
        </Banner>
    );
}
