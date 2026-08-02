import styled from "styled-components";

import { useState } from "preact/hooks";

import { emojiDictionary } from "../../../assets/emojis";
import { RE_UNICODE_EMOJI } from "../../../lib/unicodeEmoji";
import { clientController } from "../../../controllers/client/ClientController";
import { parseEmoji } from "../../common/Emoji";
import { createComponent, CustomComponentProps } from "./remarkRegexComponent";

const Emoji = styled.img`
    object-fit: contain;

    height: var(--emoji-size);
    width: var(--emoji-size);
    margin: 0 0.05em 0 0.1em;
    vertical-align: -0.2em;

    img:before {
        content: " ";
        display: block;
        position: absolute;
        height: 50px;
        width: 50px;
        background-image: url(ishere.jpg);
    }
`;

const RE_EMOJI = /:([a-zA-Z0-9\-_]+):/g;
const RE_ULID = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

export function RenderEmoji({ match }: CustomComponentProps) {
    const [fail, setFail] = useState(false);
    const url = RE_ULID.test(match)
        ? `${
              clientController.getAvailableClient().configuration?.features
                  .autumn.url
          }/emojis/${match}`
        : parseEmoji(
              match in emojiDictionary
                  ? emojiDictionary[match as keyof typeof emojiDictionary]
                  : match,
          );

    if (fail) return <span>{`:${match}:`}</span>;

    return (
        <Emoji
            alt={`:${match}:`}
            loading="lazy"
            className="emoji"
            draggable={false}
            src={url}
            onError={() => setFail(true)}
        />
    );
}

export const remarkEmoji = createComponent(
    "emoji",
    RE_EMOJI,
    (match) => match in emojiDictionary || RE_ULID.test(match),
);

/**
 * Render raw unicode emoji with the same Twemoji assets as :name:
 * tokens, so an emoji looks identical however it was typed.
 */
export function RenderUnicodeEmoji({ match }: CustomComponentProps) {
    const [fail, setFail] = useState(false);

    if (fail) return <span>{match}</span>;

    return (
        <Emoji
            alt={match}
            loading="lazy"
            className="emoji"
            draggable={false}
            src={parseEmoji(match)}
            onError={() => setFail(true)}
        />
    );
}

export const remarkUnicodeEmoji = createComponent("uemoji", RE_UNICODE_EMOJI);

export function isOnlyEmoji(text: string) {
    return (
        text.replaceAll(RE_EMOJI, "").replaceAll(RE_UNICODE_EMOJI, "").trim()
            .length === 0
    );
}
