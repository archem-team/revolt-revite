/**
 * Keep the processor's exact decimal value while removing presentation-only
 * trailing zeroes. Avoid Number so large or highly precise amounts stay exact.
 *
 * @param {string} value
 */
export function formatExactAmount(value) {
    const parts = value.split(".");
    if (parts.length !== 2) return value;
    const fraction = parts[1].replace(/0+$/, "");
    return fraction ? `${parts[0]}.${fraction}` : parts[0];
}
