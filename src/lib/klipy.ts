/**
 * KLIPY client for the composer's GIF and sticker pickers.
 *
 * Replaces Tenor, whose API was decommissioned on 2026-06-30. KLIPY puts
 * the key in the path rather than a query parameter. Their integration
 * rules require calls to come from the end user's browser, so the key is
 * a public client key (VITE_KLIPY_KEY) and ships in the bundle; without
 * one the pickers hide themselves rather than erroring.
 */

const KEY = import.meta.env.VITE_KLIPY_KEY;
const BASE = `https://api.klipy.com/api/v1/${KEY}`;

/** Their moderation tier — applied server-side, as their rules require. */
const CONTENT_FILTER = "medium";

export const klipyEnabled = Boolean(KEY);

/** The two libraries we surface; the endpoints are otherwise identical. */
export type MediaKind = "gifs" | "stickers";

export interface Gif {
    id: string;
    /** Identifies the item to the share and report endpoints. */
    slug: string;
    /** Sent as the message, so january embeds it as an image. */
    url: string;
    /** Grid preview. WebP: same animation at a fraction of the bytes. */
    preview: string;
    width: number;
    height: number;
    description: string;
    /** Inline base64 placeholder shown until the preview paints. */
    blur?: string;
}

interface KlipyFile {
    url: string;
    width: number;
    height: number;
}

/** Each item carries four size tiers, each in five formats. */
type KlipyTier = Partial<Record<"gif" | "webp" | "png", KlipyFile>>;

interface KlipyItem {
    id: number | string;
    slug: string;
    title?: string;
    blur_preview?: string;
    file: Partial<Record<"hd" | "md" | "sm" | "xs", KlipyTier>>;
}

interface KlipyPage {
    result: boolean;
    data: { data: KlipyItem[]; has_next: boolean };
}

/** One page of GIFs plus whether another can be fetched. */
export interface GifPage {
    gifs: Gif[];
    hasNext: boolean;
}

async function get<T>(
    kind: MediaKind,
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
) {
    const query = new URLSearchParams({
        content_filter: CONTENT_FILTER,
        ...params,
    });
    const response = await fetch(`${BASE}/${kind}/${path}?${query}`, {
        signal,
    });
    if (!response.ok) throw new Error(`KLIPY responded ${response.status}`);
    return (await response.json()) as T;
}

/** First tier that actually carries the requested format. */
function pick(
    item: KlipyItem,
    format: "gif" | "webp",
    tiers: ("hd" | "md" | "sm" | "xs")[],
) {
    for (const tier of tiers) {
        const file = item.file[tier]?.[format];
        if (file?.url) return file;
    }
}

function normalise(kind: MediaKind, items: KlipyItem[]): Gif[] {
    return items.map((item) => {
        // Stickers are transparent and animated: WebP keeps both, where
        // GIF would flatten the alpha to a 1-bit matte. january embeds
        // either as an image, so the nicer format wins.
        const full =
            kind === "stickers"
                ? pick(item, "webp", ["hd", "md", "sm"]) ??
                  pick(item, "png", ["hd", "md"]) ??
                  pick(item, "gif", ["hd", "md"])
                : pick(item, "gif", ["hd", "md", "sm"]);

        const preview =
            pick(item, "webp", ["sm", "md", "xs"]) ??
            pick(item, "gif", ["sm", "md"]) ??
            full;

        return {
            id: `${item.id}`,
            slug: item.slug,
            url: full?.url ?? preview?.url ?? "",
            preview: preview?.url ?? "",
            width: preview?.width ?? 0,
            height: preview?.height ?? 0,
            description:
                item.title || (kind === "stickers" ? "Sticker" : "GIF"),
            blur: item.blur_preview,
        };
    });
}

/** Trending right now, shown before anything is typed. */
export async function gifTrending(
    kind: MediaKind,
    page = 1,
    limit = 30,
    signal?: AbortSignal,
): Promise<GifPage> {
    const data = await get<KlipyPage>(
        kind,
        "trending",
        { page: `${page}`, per_page: `${limit}` },
        signal,
    );

    return {
        gifs: normalise(kind, data.data.data),
        hasNext: data.data.has_next,
    };
}

export async function gifSearch(
    kind: MediaKind,
    query: string,
    page = 1,
    limit = 30,
    signal?: AbortSignal,
): Promise<GifPage> {
    const data = await get<KlipyPage>(
        kind,
        "search",
        { q: query, page: `${page}`, per_page: `${limit}` },
        signal,
    );

    return {
        gifs: normalise(kind, data.data.data),
        hasNext: data.data.has_next,
    };
}

export interface GifCategory {
    /** Search run when the category is picked. */
    query: string;
    name: string;
    /** Animated still that backs the category tile. */
    preview: string;
}

/** Reaction categories ("lol", "thumbs up", …) for the browse grid. */
export async function gifCategories(kind: MediaKind, signal?: AbortSignal) {
    const data = await get<{
        data: {
            categories: {
                category: string;
                query: string;
                preview_url: string;
            }[];
        };
    }>(kind, "categories", {}, signal);

    return data.data.categories.map((entry) => ({
        query: entry.query,
        name: entry.category,
        preview: entry.preview_url,
    }));
}

/**
 * Tell KLIPY an item was sent. Their analytics use it to personalise
 * what we get back; it is fire-and-forget, so a failure must never
 * surface to the person who just sent a GIF.
 */
export function gifShare(kind: MediaKind, slug: string, query?: string) {
    if (!klipyEnabled || !slug) return;

    fetch(`${BASE}/${kind}/share/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query ? { q: query } : {}),
    }).catch(() => undefined);
}

/**
 * KLIPY's integration rules require media to load directly from their
 * CDN — routing it through our own proxy (or caching it) is not allowed.
 * Everything else keeps going through january for privacy.
 */
export function proxyUnlessKlipy(
    url: string | undefined,
    proxy: (url: string) => string | undefined,
): string | undefined {
    if (!url) return undefined;
    try {
        const host = new URL(url).hostname;
        if (host === "klipy.com" || host.endsWith(".klipy.com")) return url;
    } catch {
        // Not a URL january would have embedded anyway.
    }
    return proxy(url);
}
