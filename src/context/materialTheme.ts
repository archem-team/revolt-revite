import {
    Scheme,
    TonalPalette,
    argbFromHex,
    hexFromArgb,
    themeFromSourceColor,
} from "@material/material-color-utilities";

import type { Theme } from "./Theme";

/**
 * Theme bases that are generated dynamically (Material You) rather than read
 * from the static PRESETS table.
 */
export const MATERIAL_YOU_BASES = ["materialYouLight", "materialYouDark"] as const;

export type MaterialYouBase = (typeof MATERIAL_YOU_BASES)[number];

/**
 * Check whether a theme base is one of the dynamic Material You bases.
 */
export function isMaterialYouBase(base: string): base is MaterialYouBase {
    return (MATERIAL_YOU_BASES as readonly string[]).includes(base);
}

/**
 * Seed used when the user hasn't picked an accent colour yet.
 * (PepChat brand accent — same default as the classic presets.)
 */
export const DEFAULT_MATERIAL_YOU_SEED = "#FD6671";

/**
 * Fixed presence colours — deliberately not derived from the scheme;
 * presence colours stay constant across themes.
 */
const STATUS_COLOURS = {
    "status-online": "#3ABF7E",
    "status-idle": "#F39F00",
    "status-focus": "#4799F0",
    "status-busy": "#F84848",
    "status-streaming": "#977EFF",
    "status-invisible": "#A5A5A5",
};

/**
 * Generate a complete revite theme from a single accent seed colour using
 * Material 3 dynamic colour.
 *
 * The seed is run through Google's material-color-utilities to produce an
 * M3 colour scheme plus tonal palettes; the recipes below (which surface maps
 * to which role at which tone) follow the M3 container-role model so
 * the ladder stays consistent across the variable set.
 *
 * @param seed Accent seed colour (hex)
 * @param darkMode Whether to generate the dark variant
 * @returns A full revite Theme object
 */
/**
 * A generated Material You theme: the standard revite variables plus a few
 * extra CSS variables (shape scale) that GlobalTheme will emit alongside them.
 */
export type MaterialYouTheme = Theme & {
    "border-radius": string;
    "border-radius-server-icon": string;
    "channel-active": string;
    "channel-active-foreground": string;
    "sidebar-active": string;
};

export function createMaterialYouTheme(
    seed: string,
    darkMode: boolean,
): MaterialYouTheme {
    let sourceArgb: number;
    try {
        sourceArgb = argbFromHex(seed);
    } catch (err) {
        sourceArgb = argbFromHex(DEFAULT_MATERIAL_YOU_SEED);
    }

    const theme = themeFromSourceColor(sourceArgb, [
        {
            name: "success",
            value: argbFromHex("#65E572"),
            blend: true,
        },
        {
            name: "warning",
            value: argbFromHex("#FAA352"),
            blend: true,
        },
        {
            name: "error",
            value: argbFromHex("#FF3322"),
            blend: true,
        },
    ]);

    const scheme = theme.schemes[darkMode ? "dark" : "light"];

    // Hex values + tonal palettes for every colour role in the scheme.
    const hexScheme = {} as Record<keyof Scheme, string>;
    const toneScheme = {} as Record<keyof Scheme, TonalPalette>;
    (
        Object.keys(
            Object.getOwnPropertyDescriptors(Object.getPrototypeOf(scheme)),
        ) as (keyof Scheme)[]
    )
        .filter((key) => typeof scheme[key] === "number")
        .forEach((key) => {
            const argb = scheme[key] as number;
            hexScheme[key] = hexFromArgb(argb);
            toneScheme[key] = TonalPalette.fromInt(argb);
        });

    /**
     * Resolve a scheme colour, optionally at a specific tone.
     * Tones flip in dark mode (tone 94 light ≡ tone 6 dark) — same rule
     * as the M3 reference implementation.
     */
    function mc(base: keyof Scheme, tone?: number): string {
        return tone
            ? hexFromArgb(toneScheme[base].tone(darkMode ? 100 - tone : tone))
            : hexScheme[base];
    }

    /**
     * Resolve a scheme colour with explicit per-mode tones.
     *
     * Used for the surface ladder: elevation direction does not flip with the
     * mode (the chat panel must sit above the canvas in both), so these tones
     * are chosen per mode instead of mirrored.
     */
    function tone(base: keyof Scheme, lightTone: number, darkTone: number): string {
        return hexFromArgb(
            toneScheme[base].tone(darkMode ? darkTone : lightTone),
        );
    }

    /** Resolve a blended custom colour (success/warning/error). */
    function custom(name: string): string {
        const group = theme.customColors.find((c) => c.color.name === name);
        return group
            ? hexFromArgb(group[darkMode ? "dark" : "light"].color)
            : "#FF3322";
    }

    const onBackground = mc("onBackground");
    /** Hover recipe: solid surface-container (not a translucent layer). */
    const hoverLayer = tone("background", 94, 12);

    return {
        light: !darkMode,

        // Default typography (users can still override in appearance settings).
        font: "Inter",
        monospaceFont: "JetBrains Mono",

        // Material 3 shape scale nudges, emitted as extra CSS variables.
        "border-radius": "12px",
        "border-radius-server-icon": "16px",

        accent: mc("primary"),

        // Surface ladder (M3 container roles):
        // canvas/sheet = container-low, chat column = container-LOWEST
        // (recessed, darkest in dark mode), message box/header pills =
        // container-high.
        background: tone("background", 96, 10),
        "primary-background": tone("background", 100, 4),
        "primary-header": tone("background", 92, 17),
        "message-box": tone("background", 92, 17),
        "secondary-background": tone("background", 96, 10),
        "secondary-header": tone("background", 94, 12),

        foreground: onBackground,
        block: mc("surfaceVariant"),
        mention: mc("surfaceVariant", 97),
        success: custom("success"),
        warning: custom("warning"),
        error: custom("error"),
        hover: hoverLayer,
        tooltip: mc("inverseSurface"),
        "scrollbar-thumb": mc("primary", 85),
        "scrollbar-track": "transparent",
        "secondary-foreground": mc("onSurfaceVariant", 30),
        "tertiary-background": mc("surfaceVariant"),
        "tertiary-foreground": mc("onSurfaceVariant", 60),

        // Selected channel/row pill (primary container); the server
        // rail swoosh follows the same container colour.
        "channel-active": mc("primaryContainer"),
        "channel-active-foreground": mc("onPrimaryContainer"),
        "sidebar-active": mc("primaryContainer"),
        // Brand constant: unread signals stay brand yellow in every theme.
        unreads: "#FFDE18",
        ...STATUS_COLOURS,
    };
}
