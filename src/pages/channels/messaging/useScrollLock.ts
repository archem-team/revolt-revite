import { useLayoutEffect } from "preact/hooks";

import { ChannelRenderer } from "../../../lib/renderer/Singleton";

/**
 * Holds the reader's place while they are up in history.
 *
 * The message list is a column-reverse scroller: the browser preserves
 * the view when content changes ABOVE the viewport (the far end), but
 * anything that changes height at or below the reading line — a live
 * message appending at the bottom, an embed resolving onto a recent
 * message, reactions, edits, deletes — slides the whole view by the
 * changed height. Native scroll anchoring does not cover this inside
 * the reverse scroller (it is disabled on the Area), so we do it here.
 *
 * Mechanism: on every scroll, remember the content-column child under
 * the viewport centre and where it sat. When the column resizes while
 * the reader is not at the bottom, put that element back, compensating
 * for any scrolling that happened in between. Layout changes below the
 * reading line then grow downward, away from the text being read;
 * changes above grow upward. Neither moves the reader.
 */

type Lock = { el: Element; top: number; st: number };

let active: (() => void) | null = null;

/** Re-capture after a programmatic scroll correction (the history-fetch
 *  anchor) so the next resize is not measured against a stale baseline,
 *  which would re-apply the correction's delta a second time. */
export function recaptureScrollLock() {
    active?.();
}

export function useScrollLock(
    ref: { current: HTMLDivElement | null },
    renderer: ChannelRenderer,
    isJumping: () => boolean,
) {
    useLayoutEffect(() => {
        const area = ref.current;
        const content = area?.firstElementChild;
        if (!area || !content) return;

        let lock: Lock | null = null;

        // First content-column child whose bottom crosses the viewport
        // centre — children are in document order, so binary search.
        function pick(): Element | null {
            const rect = area!.getBoundingClientRect();
            const centre = rect.top + rect.height / 2;
            const kids = content!.children;
            let lo = 0,
                hi = kids.length - 1,
                found: Element | null = null;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (kids[mid].getBoundingClientRect().bottom > centre) {
                    found = kids[mid];
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            }
            return found;
        }

        function capture() {
            const el = pick();
            lock = el
                ? {
                      el,
                      top: el.getBoundingClientRect().top,
                      st: area!.scrollTop,
                  }
                : null;
        }

        const observer = new ResizeObserver(() => {
            // At the bottom the reverse scroller pins natively; during a
            // jump animation the correction would fight the scroll.
            if (
                renderer.scrollAnchored ||
                isJumping() ||
                !lock ||
                !lock.el.isConnected
            ) {
                capture();
                return;
            }

            // Whatever the element moved beyond what scrolling accounts
            // for is a layout shift — undo it.
            const drift =
                lock.el.getBoundingClientRect().top -
                lock.top +
                (area!.scrollTop - lock.st);
            if (Math.abs(drift) > 1) {
                area!.scrollTop += drift;
            }

            capture();
        });
        observer.observe(content);

        const onScroll = () => capture();
        area.addEventListener("scroll", onScroll, { passive: true });

        active = capture;
        capture();

        return () => {
            observer.disconnect();
            area.removeEventListener("scroll", onScroll);
            if (active === capture) active = null;
        };
        // isJumping is a stable-by-construction accessor; re-arming the
        // observer per render would thrash it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref, renderer]);
}
