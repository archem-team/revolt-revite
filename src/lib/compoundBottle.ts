const MASS_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mcg|µg|ug|mg|g|ml|iu)\b/gi;

function cleanLabel(
    value: string | null | undefined,
    fallback: string,
    maxLength: number,
) {
    const normalized = String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    return (normalized || fallback).slice(0, maxLength);
}

function escapeXml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export function compoundMassLabel(...values: Array<string | null | undefined>) {
    for (const value of values) {
        if (!value) continue;
        const matches = Array.from(String(value).matchAll(MASS_PATTERN)).map(
            (match) => match[0].replace(/\s+/g, "").toUpperCase(),
        );
        const unique = Array.from(new Set(matches));
        if (unique.length) return unique.slice(0, 2).join(" / ");
    }
    return "";
}

function labelLines(name: string) {
    const cleaned = cleanLabel(name, "COMPOUND", 42).toUpperCase();
    if (cleaned.length <= 12) return [cleaned];

    const words = cleaned.split(" ").reduce<string[]>((parts, word) => {
        if (word.length <= 12) return [...parts, word];
        return [...parts, ...(word.match(/.{1,12}/g) ?? [])];
    }, []);
    const lines: string[] = [];
    for (const word of words) {
        const current = lines[lines.length - 1];
        if (!current || `${current} ${word}`.length > 12) {
            lines.push(word);
        } else {
            lines[lines.length - 1] = `${current} ${word}`;
        }
    }
    if (lines.length <= 3) return lines;
    return [lines[0], lines[1], `${lines.slice(2).join("").slice(0, 10)}…`];
}

function paletteFor(name: string) {
    const palettes = [
        { background: "#bdf3ee", accent: "#ff715b", deep: "#153a46" },
        { background: "#ffe3a5", accent: "#7157ff", deep: "#25204a" },
        { background: "#d9e8ff", accent: "#ec5f91", deep: "#18344f" },
        { background: "#e9dcff", accent: "#1d9d8f", deep: "#29304f" },
    ];
    const hash = Array.from(name).reduce(
        (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
        0,
    );
    return palettes[hash % palettes.length];
}

export function compoundBottleLabel(name: string, mass?: string | null) {
    const productName = cleanLabel(name, "Compound", 42);
    const massLabel = compoundMassLabel(mass);
    return massLabel
        ? `${productName} bottle, ${massLabel}`
        : `${productName} bottle`;
}

export function compoundBottleSvg({
    name,
    mass,
    vendorName,
}: {
    name: string;
    mass?: string | null;
    vendorName: string;
}) {
    const productName = cleanLabel(name, "Compound", 42);
    const vendorLabel = cleanLabel(
        vendorName,
        "Independent vendor",
        24,
    ).toUpperCase();
    const massLabel = compoundMassLabel(mass);
    const lines = labelLines(productName);
    const palette = paletteFor(productName);
    const textLines = lines
        .map((line, index) => {
            const y =
                (lines.length === 1 ? 235 : lines.length === 2 ? 221 : 212) +
                index * (lines.length === 3 ? 20 : 24);
            const sizing =
                line.length > 11
                    ? ' textLength="112" lengthAdjust="spacingAndGlyphs"'
                    : "";
            return `<text x="260" y="${y}" fill="${
                palette.deep
            }" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${
                line.length > 10 ? 15 : 18
            }" font-weight="800"${sizing}>${escapeXml(line)}</text>`;
        })
        .join("");
    const vendorSizing =
        vendorLabel.length > 16
            ? ' letter-spacing=".4" textLength="112" lengthAdjust="spacingAndGlyphs"'
            : ' letter-spacing="1.2"';
    const massText = massLabel
        ? `<text x="260" y="294" fill="${
              palette.accent
          }" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${
              massLabel.length > 12 ? 13 : 17
          }" font-weight="900" letter-spacing=".5">${escapeXml(
              massLabel,
          )}</text>`
        : "";

    return `<svg viewBox="0 0 520 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="420" fill="${
        palette.background
    }"/><circle cx="74" cy="76" r="35" fill="${
        palette.accent
    }" opacity=".18"/><circle cx="454" cy="332" r="58" fill="${
        palette.accent
    }" opacity=".14"/><path d="M20 354C136 314 184 390 302 347s157-20 198 5v68H20z" fill="${
        palette.deep
    }" opacity=".08"/><ellipse cx="260" cy="370" rx="112" ry="20" fill="${
        palette.deep
    }" opacity=".18"/><rect x="200" y="48" width="120" height="47" rx="9" fill="${
        palette.deep
    }"/><path d="M211 48v47M231 48v47M251 48v47M271 48v47M291 48v47M311 48v47" stroke="#fff" opacity=".2"/><rect x="216" y="91" width="88" height="28" rx="7" fill="#ecf6f4" stroke="${
        palette.deep
    }" stroke-width="4"/><path d="M191 116c0-13 10-23 23-23h92c13 0 23 10 23 23l16 219c1 20-14 37-34 37H209c-20 0-35-17-34-37z" fill="#f9fcfb" stroke="${
        palette.deep
    }" stroke-width="6"/><path d="M202 126h26l-9 225h-20c-8 0-14-7-13-15z" fill="#fff" opacity=".8"/><path d="M301 126h17l15 211c1 12-8 22-20 22h-8z" fill="${
        palette.background
    }" opacity=".45"/><rect x="188" y="164" width="144" height="153" rx="8" fill="#fffdf6" stroke="${
        palette.deep
    }" stroke-width="3"/><rect x="188" y="164" width="144" height="17" rx="6" fill="${
        palette.accent
    }"/><text x="260" y="195" fill="${
        palette.deep
    }" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="700"${vendorSizing}>${escapeXml(
        vendorLabel,
    )}</text>${textLines}<line x1="208" x2="312" y1="269" y2="269" stroke="${
        palette.deep
    }" opacity=".25"/>${massText}<text x="260" y="310" fill="${
        palette.deep
    }" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="7" letter-spacing="1.2" opacity=".72">RESEARCH USE ONLY</text></svg>`;
}

export function compoundBottleDataUrl(input: {
    name: string;
    mass?: string | null;
    vendorName: string;
}) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        compoundBottleSvg(input),
    )}`;
}
