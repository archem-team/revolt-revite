import styled from "styled-components/macro";

import { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { TextArea } from "@revoltchat/ui";
import type { TextAreaProps } from "@revoltchat/ui/esm/components/design/atoms/inputs/TextArea";

import { internalSubscribe } from "./eventEmitter";
import { isTouchscreenDevice } from "./isTouchscreenDevice";

type TextAreaAutoSizeProps = Omit<
    JSX.HTMLAttributes<HTMLTextAreaElement>,
    "style" | "value" | "onChange" | "children" | "as"
> &
    TextAreaProps & {
        forceFocus?: boolean;
        autoFocus?: boolean;
        minHeight?: number;
        maxRows?: number;
        value: string;

        id?: string;

        onChange?: (ev: JSX.TargetedEvent<HTMLTextAreaElement, Event>) => void;

        /**
         * Render a rich mirror of the value (mention pills, emoji) behind
         * the textarea; the textarea's own text turns transparent. The
         * rendered output must keep identical text metrics.
         */
        overlay?: (value: string) => JSX.Element;
    };

const Container = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
`;

const OverlayHost = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;

    textarea {
        background: transparent;
        color: transparent;
        caret-color: var(--foreground);

        /* Firefox derives placeholder colour from the (now transparent)
           text colour; restate it. */
        &::placeholder {
            color: var(--tertiary-foreground);
            opacity: 1;
        }

        /* The app-wide ::selection paints an opaque inverted block, but
           Chrome forces author selection backgrounds toward ~50% alpha
           and the glyphs here are transparent — selecting showed a hazy
           grey slab. Keep selected glyphs transparent (the overlay text
           beneath stays visible, pills and emoji included) and paint a
           deliberate translucent wash instead. */
        &::selection {
            color: transparent;
            background: rgba(140, 138, 142, 0.35);
        }
    }

    /* During IME composition show the raw textarea text (with its
       underline decorations) and hide the mirror. */
    &[data-composing="true"] {
        textarea {
            color: var(--foreground);
        }

        .composer-overlay {
            visibility: hidden;
        }
    }
`;

/* Must lay text out exactly like the textarea: same font, line height,
   padding (inline) and the UA textarea wrapping rules. */
const OverlayLayer = styled.div<{ lineHeight: string }>`
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;

    > div {
        color: var(--foreground);
        font-size: var(--text-size);
        line-height: ${(props) => props.lineHeight};
        white-space: pre-wrap;
        overflow-wrap: break-word;
        font-variant-ligatures: var(--ligatures);
        will-change: transform;
    }
`;

const Ghost = styled.div<{ lineHeight: string; maxRows: number }>`
    flex: 0;
    width: 100%;
    overflow: hidden;
    visibility: hidden;
    position: relative;

    > div {
        width: 100%;
        white-space: pre-wrap;
        word-break: break-all;

        top: 0;
        position: absolute;
        font-size: var(--text-size);
        line-height: ${(props) => props.lineHeight};

        max-height: calc(
            calc(${(props) => props.lineHeight} * ${(props) => props.maxRows})
        );
    }
`;

export default function TextAreaAutoSize(props: TextAreaAutoSizeProps) {
    const {
        autoFocus,
        minHeight,
        maxRows,
        value,
        padding,
        lineHeight,
        hideBorder,
        forceFocus,
        onChange,
        overlay,
        ...textAreaProps
    } = props;

    const ref = useRef<HTMLTextAreaElement>() as RefObject<HTMLTextAreaElement>;
    const ghost = useRef<HTMLDivElement>() as RefObject<HTMLDivElement>;
    const overlayInner = useRef<HTMLDivElement>(null);
    const [composing, setComposing] = useState(false);

    const syncOverlayScroll = () => {
        if (overlayInner.current && ref.current) {
            overlayInner.current.style.transform = `translateY(-${ref.current.scrollTop}px)`;
        }
    };

    useLayoutEffect(() => {
        if (ref.current && ghost.current) {
            ref.current.style.height = `${ghost.current.clientHeight}px`;
        }
        syncOverlayScroll();
    }, [ghost, props.value]);

    useEffect(() => {
        if (isTouchscreenDevice) return;
        autoFocus && ref.current && ref.current.focus();
    }, [value, autoFocus]);

    const inputSelected = () =>
        ["TEXTAREA", "INPUT"].includes(document.activeElement?.nodeName ?? "");

    useEffect(() => {
        if (!ref.current) return;
        if (forceFocus) {
            ref.current.focus();
        }

        if (isTouchscreenDevice) return;
        if (autoFocus && !inputSelected()) {
            ref.current.focus();
        }

        // ? if you are wondering what this is
        // ? it is a quick and dirty hack to fix
        // ? value not setting correctly
        // ? I have no clue what's going on
        // ref.current.value = value;
        // * commented out of 30-08-21
        // * hopefully nothing breaks :v

        if (!autoFocus) return;
        function keyDown(e: KeyboardEvent) {
            if ((e.ctrlKey && e.key !== "v") || e.altKey || e.metaKey) return;
            if (e.key.length !== 1) return;
            if (ref && !inputSelected()) {
                ref.current!.focus();
            }
        }

        document.body.addEventListener("keydown", keyDown);
        return () => document.body.removeEventListener("keydown", keyDown);
    }, [ref, autoFocus, forceFocus, value]);

    useEffect(() => {
        if (!ref.current) return;
        function focus(id: string) {
            if (id === props.id) {
                ref.current!.focus();
            }
        }

        return internalSubscribe(
            "TextArea",
            "focus",
            focus as (...args: unknown[]) => void,
        );
    }, [props.id, ref]);

    const textArea = (
        <TextArea
            ref={ref}
            value={value}
            padding={padding}
            style={{ minHeight }}
            hideBorder={hideBorder}
            lineHeight={lineHeight}
            onChange={(ev) => {
                onChange && onChange(ev);
            }}
            onScroll={overlay ? syncOverlayScroll : undefined}
            onCompositionStart={overlay ? () => setComposing(true) : undefined}
            onCompositionEnd={overlay ? () => setComposing(false) : undefined}
            {...textAreaProps}
        />
    );

    return (
        <Container>
            {overlay ? (
                <OverlayHost data-composing={composing}>
                    <OverlayLayer
                        aria-hidden
                        lineHeight={
                            lineHeight ?? "var(--textarea-line-height)"
                        }>
                        <div
                            ref={overlayInner}
                            className="composer-overlay"
                            style={{ padding }}>
                            {overlay(value)}
                        </div>
                    </OverlayLayer>
                    {textArea}
                </OverlayHost>
            ) : (
                textArea
            )}
            <Ghost
                lineHeight={lineHeight ?? "var(--textarea-line-height)"}
                maxRows={maxRows ?? 5}>
                <div ref={ghost} style={{ padding }}>
                    {props.value
                        ? props.value
                              .split("\n")
                              .map((x) => `\u200e${x}`)
                              .join("\n")
                        : undefined ?? "‎\n"}
                </div>
            </Ghost>
        </Container>
    );
}
