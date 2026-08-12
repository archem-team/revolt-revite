const POSITION_DELAYS_MS = [0, 100, 300, 750, 1500, 3000, 5000];

/**
 * Keep the main routes track selected while OverlappingPanels and async page
 * content finish laying out. iOS WebKit can re-snap the horizontal grid after
 * an initially successful scroll, especially when restoring a deep link.
 * Reassert the route during the boot window, but stop immediately when the
 * user intentionally starts a gesture so navigation never fights their input.
 */
export function keepRoutesPanelInView() {
    let cancelled = false;
    const timers: number[] = [];

    const position = () => {
        if (cancelled) return;

        const routes = document.querySelector<HTMLElement>(
            '[data-component="routes"]',
        );
        const panels = routes?.parentElement;
        if (!routes || !panels) return;

        routes.scrollIntoView({
            behavior: "auto",
            block: "nearest",
            inline: "center",
        });
        // scrollIntoView is the reliable WebKit path; the explicit assignment
        // keeps Chromium and older browsers aligned to the exact grid track.
        panels.scrollLeft = routes.offsetLeft;
    };

    const stopForGesture = () => {
        cancelled = true;
        for (const timer of timers) window.clearTimeout(timer);
    };

    for (const delay of POSITION_DELAYS_MS) {
        timers.push(window.setTimeout(position, delay));
    }
    window.addEventListener("pageshow", position);
    window.addEventListener("resize", position);
    document.addEventListener("touchstart", stopForGesture, {
        once: true,
        passive: true,
    });

    return () => {
        cancelled = true;
        for (const timer of timers) window.clearTimeout(timer);
        window.removeEventListener("pageshow", position);
        window.removeEventListener("resize", position);
        document.removeEventListener("touchstart", stopForGesture);
    };
}
