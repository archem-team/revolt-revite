import styles from "./Morph.module.scss";
import { createContext } from "preact";
import { useContext, useEffect, useLayoutEffect, useRef } from "preact/hooks";

// Keep in sync with Morph.module.scss.
const RESIZE_MS = 280;
const FADE_MS = 150;
const SHAKE_MS = 360;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export interface Controls {
    /**
     * Freeze the current contents so they fade out instead of vanishing. Call
     * it immediately before the state change that swaps them; route changes
     * are picked up on their own.
     */
    swap(): void;
    /** Nudge the card sideways: what was submitted came back rejected. */
    reject(): void;
}

const MorphContext = createContext<Controls>({
    swap: () => undefined,
    reject: () => undefined,
});

/** Motion the card can be asked for from anywhere inside it. */
export const useMorph = () => useContext(MorphContext);

interface Props {
    /** Changing this fades the current contents out. */
    morphKey: string;
    children: preact.ComponentChildren;
}

/**
 * Gives its children a continuous box: the height animates between content
 * changes and the outgoing markup fades out over the incoming markup, so
 * nothing pops in or out mid-air. Incoming markup fades itself in by wearing
 * `Morph.module.scss`'s `enter` class.
 */
export default function Morph({ morphKey, children }: Props) {
    const box = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);

    const mounted = useRef(false);
    const previousKey = useRef(morphKey);
    const pending = useRef<HTMLElement | undefined>(undefined);
    const leaving = useRef<HTMLElement | undefined>(undefined);
    const settle = useRef<number | undefined>(undefined);

    // Snapshot during render: Preact diffs the children *after* this function
    // returns, so this is the last moment the outgoing DOM still exists.
    if (morphKey !== previousKey.current) {
        previousKey.current = morphKey;
        if (content.current) pending.current = freeze(content.current);
    }

    // Only ever touches refs, so it is safe to call from a stale closure.
    /* eslint-disable react-hooks/exhaustive-deps */
    function resize(instant: boolean) {
        const inner = content.current;
        const outer = box.current;
        if (!inner || !outer) return;

        const height = `${inner.offsetHeight}px`;
        if (outer.style.height === height) return;

        if (instant) {
            outer.style.transition = "none";
            outer.style.height = height;
            void outer.offsetHeight; // flush, so the next change animates
            outer.style.transition = "";
            return;
        }

        outer.style.height = height;
        outer.dataset.animating = "true";
        window.clearTimeout(settle.current);
        settle.current = window.setTimeout(
            () => delete outer.dataset.animating,
            RESIZE_MS,
        );
    }

    function attach(ghost: HTMLElement) {
        const outer = box.current;
        if (!outer) return;

        // A second swap mid-fade replaces the first; stacking them would only
        // muddy what is underneath.
        leaving.current?.remove();
        leaving.current = ghost;
        outer.appendChild(ghost);

        // Under reduced motion the explanatory fade stays, without the blur.
        ghost.animate(
            reduceMotion()
                ? [{ opacity: 1 }, { opacity: 0 }]
                : [
                      { opacity: 1, filter: "blur(0px)" },
                      { opacity: 0, filter: "blur(3px)" },
                  ],
            { duration: FADE_MS, easing: EASE_OUT, fill: "forwards" },
        );

        // On a timer rather than on the animation finishing: a backgrounded
        // tab freezes that, and a copy of the form must never outlive the fade.
        window.setTimeout(() => {
            ghost.remove();
            if (leaving.current === ghost) leaving.current = undefined;
        }, FADE_MS + 40);
    }

    function reject() {
        // The whole card moves as one piece - shaking only the form would
        // leave the rest of the surface behind.
        const surface = box.current?.parentElement ?? box.current;
        if (!surface || reduceMotion()) return;

        surface.animate(
            [
                { transform: "translateX(0)" },
                { transform: "translateX(-7px)" },
                { transform: "translateX(6px)" },
                { transform: "translateX(-4px)" },
                { transform: "translateX(2px)" },
                { transform: "translateX(0)" },
            ],
            { duration: SHAKE_MS, easing: "ease-out" },
        );
    }

    /** Escape hatch for swaps a child triggers from its own state. */
    function begin() {
        const inner = content.current;
        if (!inner) return;

        const ghost = freeze(inner);
        const at = performance.now();
        // The child's state lands in a microtask, so by the next frame the new
        // markup is in place but has not painted yet.
        requestAnimationFrame(() => {
            // Frames stop in a background tab. Whatever we froze back then is
            // no longer what the returning user is looking at.
            if (performance.now() - at > 500) return;

            attach(ghost);
            resize(false);
        });
    }

    useLayoutEffect(() => {
        resize(!mounted.current);
        mounted.current = true;

        const ghost = pending.current;
        if (ghost) {
            pending.current = undefined;
            attach(ghost);
        }
    });

    useEffect(() => {
        const inner = content.current;
        if (!inner) return;

        // Contents also grow and shrink on their own: a validation error
        // appearing, a font landing, the window narrowing.
        let width = inner.offsetWidth;
        const observer = new ResizeObserver(() => {
            const reflowed = inner.offsetWidth !== width;
            width = inner.offsetWidth;
            // Reflowing text should land at its new height, not crawl to it.
            resize(reflowed);
        });

        observer.observe(inner);
        return () => {
            observer.disconnect();
            window.clearTimeout(settle.current);
            leaving.current?.remove();
        };
    }, []);
    /* eslint-enable react-hooks/exhaustive-deps */

    return (
        <div ref={box} className={styles.box}>
            <div ref={content}>
                <MorphContext.Provider value={{ swap: begin, reject }}>
                    {children}
                </MorphContext.Provider>
            </div>
        </div>
    );
}

const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A detached copy of the live markup, safe to animate out on its own. */
function freeze(source: HTMLElement) {
    const clone = source.cloneNode(true) as HTMLElement;
    clone.classList.add(styles.ghost);
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("inert", "");

    // A copy is leaving, not arriving: it must not replay the entrance the
    // original already finished.
    clone.querySelectorAll(`.${styles.enter}`).forEach((el) => {
        el.classList.remove(styles.enter);
    });

    // cloneNode copies the value *attribute*, not what the user typed.
    const live = source.querySelectorAll("input, textarea");
    clone.querySelectorAll("input, textarea").forEach((field, index) => {
        (field as HTMLInputElement).value =
            (live[index] as HTMLInputElement)?.value ?? "";
    });

    return clone;
}
