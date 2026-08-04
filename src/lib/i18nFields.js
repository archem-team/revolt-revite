/**
 * Resolve a dotted translation key without allowing incomplete dictionaries
 * to propagate undefined into render helpers.
 */
export function resolveDictionaryEntry(dictionary, id, fallback = id) {
    let entry = dictionary;

    for (const key of id.split(".")) {
        if (!entry || typeof entry !== "object") return fallback;
        entry = entry[key];
    }

    return typeof entry === "string" ? entry : fallback;
}
