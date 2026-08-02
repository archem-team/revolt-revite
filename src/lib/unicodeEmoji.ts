/**
 * Unicode emoji sequences: emoji-presentation characters (or text-default
 * pictographs forced by a VS16), with optional skin-tone modifiers and
 * ZWJ joins, plus keycap sequences and regional-indicator flag pairs.
 *
 * Deliberately conservative: bare digits and text-default symbols
 * (© ™ ▶ …) only match when a VS16 (️) requests emoji
 * presentation, so ordinary prose is never turned into images.
 */
export const RE_UNICODE_EMOJI = new RegExp(
    // Flag pairs must come first: a lone regional indicator is itself
    // Emoji_Presentation, so the general alternative would split a flag
    // into two half-tokens (ordered alternation).
    "(\\p{Regional_Indicator}{2}" +
        "|[#*0-9]\\uFE0F\\u20E3" +
        "|(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)" +
        "\\p{Emoji_Modifier}?" +
        "(?:\\u200D(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})" +
        "\\uFE0F?\\p{Emoji_Modifier}?)*)",
    "gu",
);
