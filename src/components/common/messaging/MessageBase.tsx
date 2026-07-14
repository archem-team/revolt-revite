import { observer } from "mobx-react-lite";
import { Message } from "revolt.js";
import styled, { css, keyframes } from "styled-components/macro";
import { decodeTime } from "ulid";

import { Text } from "preact-i18n";

import { useDictionary } from "../../../lib/i18n";
import { isTouchscreenDevice } from "../../../lib/isTouchscreenDevice";

import { dayjs } from "../../../context/Locale";

import Tooltip from "../Tooltip";

export interface BaseMessageProps {
    head?: boolean;
    failed?: boolean;
    mention?: boolean;
    blocked?: boolean;
    sending?: boolean;
    contrast?: boolean;
    highlight?: boolean;
}

const highlight = keyframes`
    0% { background: var(--mention); }
    66% { background: var(--mention); }
    100% { background: transparent; }
`;

export default styled.div<BaseMessageProps>`
    display: flex;
    overflow: none;
    padding: 0.125rem;
    flex-direction: row;
    padding-inline-end: 16px;
    /* The row wrapping the avatar column and the body carries an
       default 8px gap (gap-md) — with the column's 4px inner padding the
       avatar sits 12px from the username/messages. */
    gap: 8px;

    /* Message rows are rounded (radius "md") and inset from the
       panel edges so the hover highlight reads as a rounded container. */
    ${() =>
        !isTouchscreenDevice &&
        css`
            margin-inline: 8px;
            border-radius: 12px;
        `}

    ${() =>
        isTouchscreenDevice &&
        css`
            user-select: none;
        `}

    ${(props) =>
        props.contrast &&
        css`
            padding: 0.3rem;
            background: var(--hover);
            border-radius: var(--border-radius);
        `}

    ${(props) =>
        props.head &&
        css`
            /* Only new author groups get the group-spacing margin;
               grouped (tail) messages stack with just the 2px row padding
               (measured 25px line pitch in their UI). */
            margin-top: var(--message-group-spacing, 12px);
        `}

    ${(props) =>
        props.mention &&
        css`
            background: var(--mention);
        `}

    ${(props) =>
        props.blocked &&
        css`
            filter: blur(4px);
            transition: 0.2s ease filter;

            &:hover {
                filter: none;
            }
        `}

    ${(props) =>
        props.sending &&
        css`
            opacity: 0.8;
            color: var(--tertiary-foreground);
        `}

    ${(props) =>
        props.failed &&
        css`
            color: var(--error);
        `}

    ${(props) =>
        props.highlight &&
        css`
            animation-name: ${highlight};
            animation-timing-function: ease;
            animation-duration: 3s;
        `}

    .detail {
        /* Username · info sit close together (4px);
           the header row is a 20px line box (their label-large). */
        gap: 4px;
        display: flex;
        align-items: center;
        flex-shrink: 0;
        line-height: 20px;
        /* Sender name brighter than body text — inherited colour, so
           role colours still override it. */
        color: #f8f8f8;
    }

    .author {
        overflow: hidden;
        cursor: pointer;
        /* Usernames are label-large: 14px at weight 500. */
        font-weight: 500 !important;

        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        text-overflow: ellipsis;
        white-space: normal;

        &:hover {
            text-decoration: underline;
        }
    }

    .copy {
        display: block;
        overflow: hidden;
    }

    &:hover {
        background: var(--hover);

        time {
            opacity: 1;
        }

        .system-message-icon {
            display: none;
        }
    }
`;

export const MessageInfo = styled.div<{ click: boolean }>`
    /* Info column: 54px wide, content pushed to the end so the
       avatar (and the hover timestamp on tails) hugs the text edge. */
    width: 54px;
    display: flex;
    flex-shrink: 0;
    padding: 2px 4px;
    flex-direction: row;
    justify-content: flex-end;

    .avatar {
        user-select: none;
        cursor: pointer;
        &:active {
            transform: translateY(1px);
        }
    }

    .copyBracket {
        opacity: 0;
        position: absolute;
    }

    .copyTime {
        opacity: 0;
        position: absolute;
    }

    time {
        opacity: 0;
    }

    time,
    .edited {
        margin-top: 1px;
        cursor: default;
        display: inline;
        /* The tail hover-timestamp renders at ~0.7em and must
           never wrap: even at opacity 0 a wrapped timestamp occupies layout
           and silently inflates every grouped row (54px gutter). */
        font-size: 10px;
        white-space: nowrap;
        color: var(--tertiary-foreground);
    }

    time,
    .edited > div {
        &::selection {
            background-color: transparent;
            color: var(--tertiary-foreground);
        }
    }

    .header {
        cursor: pointer;
    }

    .systemIcon {
        height: 1.33em;
        width: 1.33em;
        margin-right: 0.5em;
        color: var(--tertiary-foreground);
    }

    /*${(props) =>
        props.click &&
        css`
            cursor: pointer;
        `}*/
`;

export const MessageContent = styled.div`
    // Position relatively so we can put
    // the overlay in the right place.
    position: relative;

    min-width: 0;
    flex-grow: 1;
    display: flex;
    // overflow: hidden;
    flex-direction: column;
    justify-content: center;
    /* Message text follows the user-adjustable message size,
       at their inherited 1.5 line-height (measured 25px line pitch). */
    font-size: var(--message-size, var(--text-size));
    line-height: 1.5;
`;

export const DetailBase = styled.div`
    flex-shrink: 0;
    gap: 4px;
    /* Timestamps are body-small: 12px. */
    font-size: 12px;
    display: inline-flex;
    color: var(--tertiary-foreground);

    .edited {
        cursor: default;
        &::selection {
            background-color: transparent;
            color: var(--tertiary-foreground);
        }
    }
`;

export const MessageDetail = observer(
    ({ message, position }: { message: Message; position: "left" | "top" }) => {
        const dict = useDictionary();

        if (position === "left") {
            if (message.edited) {
                return (
                    <>
                        <time className="copyTime">
                            <i className="copyBracket">[</i>
                            {dayjs(decodeTime(message._id)).format(
                                dict.dayjs?.timeFormat,
                            )}
                            <i className="copyBracket">]</i>
                        </time>
                        <span className="edited">
                            <Tooltip
                                content={dayjs(message.edited).format("LLLL")}>
                                <Text id="app.main.channel.edited" />
                            </Tooltip>
                        </span>
                    </>
                );
            }
            return (
                <>
                    <time>
                        <i className="copyBracket">[</i>
                        {dayjs(decodeTime(message._id)).format(
                            dict.dayjs?.timeFormat,
                        )}
                        <i className="copyBracket">]</i>
                    </time>
                </>
            );
        }

        return (
            <DetailBase>
                <time>{dayjs(decodeTime(message._id)).calendar()}</time>
                {message.edited && (
                    <Tooltip content={dayjs(message.edited).format("LLLL")}>
                        <span className="edited">
                            <Text id="app.main.channel.edited" />
                        </span>
                    </Tooltip>
                )}
            </DetailBase>
        );
    },
);
