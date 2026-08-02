import { emojiDictionary } from "../../assets/emojis";

// Twemoji is the one emoji style — the pack selector has been removed.
// Served from jsDelivr out of the maintained fork (jdecked/twemoji, by
// Twemoji's former maintainers — Twitter's original is dead since 2022).
// The version is PINNED: jsDelivr serves pinned URLs with immutable
// caching, and a bump is a deliberate one-line change here. The
// codepoint-mapping logic below is Twemoji's own, so filenames match.
const TWEMOJI_VERSION = "17.0.3";
const EMOJI_BASE_URL = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg`;

// Originally taken from Twemoji source code,
// re-written by bree to be more readable.
function codePoints(rune: string) {
    const pairs = [];
    let low = 0;
    let i = 0;

    while (i < rune.length) {
        const charCode = rune.charCodeAt(i++);
        if (low) {
            pairs.push(0x10000 + ((low - 0xd800) << 10) + (charCode - 0xdc00));
            low = 0;
        } else if (0xd800 <= charCode && charCode <= 0xdbff) {
            low = charCode;
        } else {
            pairs.push(charCode);
        }
    }

    return pairs;
}

// Taken from Twemoji source code.
// scripts/build.js#344
// grabTheRightIcon(rawText);
const UFE0Fg = /\uFE0F/g;
const U200D = String.fromCharCode(0x200d);
function toCodePoint(rune: string) {
    return codePoints(rune.indexOf(U200D) < 0 ? rune.replace(UFE0Fg, "") : rune)
        .map((val) => val.toString(16))
        .join("-");
}

export function parseEmoji(emoji: string) {
    // if (emoji.startsWith("custom:")) {
    //     return `https://dl.insrt.uk/projects/revolt/emotes/${emoji.substring(
    //         7,
    //     )}`;
    // }

    const codepoint = toCodePoint(emoji);
    return `${EMOJI_BASE_URL}/${codepoint}.svg`;
}

export default function Emoji({
    emoji,
    size,
}: {
    emoji: string;
    size?: number;
}) {
    return (
        <img
            alt={emoji}
            loading="lazy"
            className="emoji"
            draggable={false}
            src={parseEmoji(emoji)}
            style={
                size ? { width: `${size}px`, height: `${size}px` } : undefined
            }
        />
    );
}

export function generateEmoji(emoji: string) {
    return `<img loading="lazy" class="emoji" draggable="false" alt="${emoji}" src="${parseEmoji(
        emoji,
    )}" />`;
}
