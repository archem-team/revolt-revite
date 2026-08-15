const POSITION_DELAYS_MS = [0, 100, 300, 750, 1500, 3000, 5000];
const POSITION_TOLERANCE_PX = 1;

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

        const target = routes.offsetLeft;
        if (Math.abs(panels.scrollLeft - target) <= POSITION_TOLERANCE_PX)
            return;

        // Only move the horizontal snap container. Element-level scrolling can
        // also move ancestor containers and repeatedly re-layer the off-screen
        // server rail; on iOS WebKit that can leave its virtualized list
        // unpainted when the user swipes the rail back into view.
        panels.scrollLeft = target;
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
