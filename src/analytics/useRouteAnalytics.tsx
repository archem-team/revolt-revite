import { useEffect, useRef } from "preact/hooks";
import { useLocation } from "react-router-dom";

import analytics from "./posthog";
import { trackPageLoadTime } from "./events";

/**
 * Hook that tracks:
 * 1. Page views on every route change
 * 2. Page load time (once, on initial mount) using the Performance API
 *
 * Mount this once inside RevoltApp (the authenticated shell).
 */
export function useRouteAnalytics() {
    const location = useLocation();
    const hasMeasuredLoadTime = useRef(false);

    // Track page load time once using the Navigation Timing API
    useEffect(() => {
        if (hasMeasuredLoadTime.current) return;
        hasMeasuredLoadTime.current = true;

        // Use the Performance Navigation Timing API (Level 2)
        const measureLoad = () => {
            const [entry] = performance.getEntriesByType(
                "navigation",
            ) as PerformanceNavigationTiming[];
            if (entry) {
                const loadTimeMs = entry.loadEventEnd - entry.startTime;
                if (loadTimeMs > 0) {
                    trackPageLoadTime(loadTimeMs);
                }
            }
        };

        // If the page is already loaded, measure immediately; otherwise wait
        if (document.readyState === "complete") {
            measureLoad();
        } else {
            window.addEventListener("load", measureLoad, { once: true });
        }
    }, []);

    // Track a pageview on every route change
    useEffect(() => {
        analytics.pageview(location.pathname);
    }, [location.pathname]);
}
