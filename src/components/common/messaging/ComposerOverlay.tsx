import { observer } from "mobx-react-lite";
import { Channel, Client } from "revolt.js";
import styled from "styled-components/macro";

import { emojiDictionary } from "../../../assets/emojis";
import {
    composerPingableRoles,
    escapeRegex,
} from "../../../lib/convertMentions";
import { RE_UNICODE_EMOJI } from "../../../lib/unicodeEmoji";

import { parseEmoji } from "../Emoji";

const RE_ULID = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

type Segment =
    | { type: "text"; text: string }
    | { type: "pill"; text: string; colour?: string | null }
    | { type: "emoji"; text: string; url: string };

/**
 * Styled like the message mention pills (markdown/plugins/mentions.tsx)
 * but metric-neutral: no padding or font-weight, so the glyphs stay
 * exactly where the textarea underneath lays them out.
 */
const Pill = styled.span<{ colour?: string | null }>`
    background: #312d1d;
    border-radius: calc(var(--border-radius) * 2);
    box-decoration-break: clone;
    color: ${(props) =>
        props.colour && !props.colour.includes("gradient")
            ? props.colour
            : "#d6a939"};
`;

/**
 * The token text keeps its width (transparent) and the emoji picture is
 * painted over it, so the caret maths of the textarea are untouched.
 * Sized to the message renderer's --emoji-size (1.25em, RemarkRenderer)
 * so the preview and the sent message look identical; anchored left so
 * a :long_name: token reads as emoji-then-gap, not a floating image.
 * The size is capped at the span's own width: an emoji glyph's advance
 * can round to just under 1.25em on some display scales, and a
 * background is clipped to its box — uncapped, the image lost an edge.
 */
const EmojiToken = styled.span`
    color: transparent;
    background-position: left center;
    background-repeat: no-repeat;
    background-size: min(1.25em, 100%);
`;

/** Case-folded username set, rebuilt only when the user store grows. */
const usernameCache = new WeakMap<
    Client,
    { size: number; names: Set<string> }
>();

function hasUser(client: Client, lowered: string) {
    let entry = usernameCache.get(client);
    if (!entry || entry.size !== client.users.size) {
        const names = new Set<string>();
        for (const user of client.users.values())
            names.add(user.username.toLowerCase());
        entry = { size: client.users.size, names };
        usernameCache.set(client, entry);
    }
    return entry.names.has(lowered);
}

function emojiUrl(client: Client, name: string) {
    // Same resolution as RenderEmoji (markdown/plugins/emoji.tsx); a
    // deleted custom emoji renders blank here rather than falling back.
    return RE_ULID.test(name)
        ? `${client.configuration?.features.autumn.url}/emojis/${name}`
        : parseEmoji(
              name in emojiDictionary
                  ? emojiDictionary[name as keyof typeof emojiDictionary]
                  : name,
          );
}

/**
 * Split composer text into styled segments. Mention passes mirror
 * convertMentionsToWireFormat (roles first, longest name first, then
 * usernames) so the preview never disagrees with what converts at send.
 */
function tokenize(value: string, channel: Channel): Segment[] {
    const client = channel.client;
    const claims: { start: number; end: number; segment: Segment }[] = [];

    const claim = (start: number, end: number, segment: Segment) => {
        if (!claims.some((c) => start < c.end && end > c.start)) {
            claims.push({ start, end, segment });
        }
    };

    if (value.includes("@")) {
        for (const role of composerPingableRoles(channel)) {
            const regex = new RegExp(
                `@${escapeRegex(role.name!)}(?![\\w-])`,
                "gi",
            );
            let match;
            while ((match = regex.exec(value))) {
                claim(match.index, match.index + match[0].length, {
                    type: "pill",
                    text: match[0],
                    colour: (role as { colour?: string | null }).colour,
                });
            }
        }

        const mention = /@([\w-]+)/g;
        let match;
        while ((match = mention.exec(value))) {
            if (
                match[1] === "everyone" ||
                hasUser(client, match[1].toLowerCase())
            ) {
                claim(match.index, match.index + match[0].length, {
                    type: "pill",
                    text: match[0],
                });
            }
        }

        // Wire-format user mentions (typed or pasted directly).
        const wire = /<@([A-z0-9]{26})>/g;
        while ((match = wire.exec(value))) {
            if (client.users.get(match[1])) {
                claim(match.index, match.index + match[0].length, {
                    type: "pill",
                    text: match[0],
                });
            }
        }
    }

    if (value.includes("<%")) {
        const wire = /<%([A-z0-9]{26})>/g;
        let match;
        while ((match = wire.exec(value))) {
            const role = channel.server?.roles?.[match[1]];
            if (role) {
                claim(match.index, match.index + match[0].length, {
                    type: "pill",
                    text: match[0],
                    colour: role.colour,
                });
            }
        }
    }

    if (value.includes(":")) {
        const emoji = /:([a-zA-Z0-9\-_]+):/g;
        let match;
        while ((match = emoji.exec(value))) {
            if (match[1] in emojiDictionary || RE_ULID.test(match[1])) {
                claim(match.index, match.index + match[0].length, {
                    type: "emoji",
                    text: match[0],
                    url: emojiUrl(client, match[1]),
                });
            }
        }
    }

    // Raw unicode emoji (the picker and autocomplete insert these) get
    // the same Twemoji image messages render them with.
    {
        const unicode = new RegExp(RE_UNICODE_EMOJI.source, "gu");
        let match;
        while ((match = unicode.exec(value))) {
            claim(match.index, match.index + match[0].length, {
                type: "emoji",
                text: match[0],
                url: parseEmoji(match[0]),
            });
        }
    }

    claims.sort((a, b) => a.start - b.start);

    const segments: Segment[] = [];
    let cursor = 0;
    for (const c of claims) {
        if (c.start > cursor) {
            segments.push({
                type: "text",
                text: value.slice(cursor, c.start),
            });
        }
        segments.push(c.segment);
        cursor = c.end;
    }
    if (cursor < value.length) {
        segments.push({ type: "text", text: value.slice(cursor) });
    }

    return segments;
}

interface Props {
    value: string;
    channel: Channel;
}

/**
 * Rich preview layer for the message composer: renders the draft with
 * mention pills and emoji images behind the (transparent-text) textarea.
 */
export default observer(({ value, channel }: Props) => {
    if (!value) return null;

    // The overlay is a preview nicety: if tokenizing throws (transient
    // client state, mid-reload module graphs), show plain text rather
    // than crashing the composer.
    let segments: Segment[];
    try {
        segments = tokenize(value, channel);
    } catch (_) {
        segments = [{ type: "text", text: value }];
    }

    return (
        <>
            {segments.map((segment, i) =>
                segment.type === "text" ? (
                    segment.text
                ) : segment.type === "emoji" ? (
                    <EmojiToken
                        key={i}
                        style={{
                            backgroundImage: `url("${segment.url}")`,
                        }}>
                        {segment.text}
                    </EmojiToken>
                ) : (
                    <Pill key={i} colour={segment.colour}>
                        {segment.text}
                    </Pill>
                ),
            )}
        </>
    );
});
