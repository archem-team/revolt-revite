import styled from "styled-components";

import { useCallback, useRef } from "preact/hooks";

import { Tooltip } from "@revoltchat/ui";

import { useTranslation } from "../../../lib/i18n";

import { modalController } from "../../../controllers/modals/ModalController";

/**
 * Base codeblock styles
 */
const Base = styled.pre`
    position: relative;
    max-width: 100%;
    margin: 0;
    padding: 0.8em 1em 1em;
    overflow-x: auto;
    background: var(--block);
    border-radius: var(--border-radius);

    code {
        display: block;
        width: max-content;
        min-width: 100%;
        color: var(--foreground);
        background: transparent;
        overflow-wrap: normal;
        white-space: pre;
    }
`;

/**
 * Copy codeblock contents button styles
 */
const Lang = styled.div`
    font-family: var(--monospace-font);
    width: fit-content;
    padding-bottom: 0.65em;

    button {
        color: var(--color-text-inverse);
        cursor: pointer;
        min-height: 28px;
        padding: 3px 8px;
        font-weight: 600;
        user-select: none;
        display: inline-block;
        background: var(--accent);
        border: 0;

        font-size: 10px;
        text-transform: uppercase;
        border-radius: calc(var(--border-radius) / 3);
        transition: background-color 120ms var(--ease-out),
            transform 120ms var(--ease-out);

        &:hover {
            background: color-mix(in srgb, var(--accent) 86%, white);
        }

        &:active {
            transform: translateY(1px);
        }

        &:focus-visible {
            outline: 2px solid var(--focus-ring);
            outline-offset: 2px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        button {
            transition: none;
        }
    }
`;

/**
 * Render a codeblock with copy text button
 */
export const RenderCodeblock: React.FC<{ class: string }> = ({
    children,
    ...props
}) => {
    const ref = useRef<HTMLPreElement>(null);
    const translate = useTranslation();

    let text = "text";
    if (props.class) {
        text = props.class.split("-")[1];
    }

    const onCopy = useCallback(() => {
        const text = ref.current?.querySelector("code")?.innerText;
        text && modalController.writeText(text);
    }, [ref]);

    return (
        <Base ref={ref}>
            <Lang>
                <Tooltip
                    content={translate(
                        "app.main.channel.accessibility.copy_code",
                    )}
                    placement="top">
                    {/**
                         // @ts-expect-error Preact-React */}
                    <button
                        type="button"
                        aria-label={translate(
                            "app.main.channel.accessibility.copy_code",
                        )}
                        onClick={onCopy}>
                        {text}
                    </button>
                </Tooltip>
            </Lang>
            {children}
        </Base>
    );
};
