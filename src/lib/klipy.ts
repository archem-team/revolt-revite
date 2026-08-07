/**
 * KLIPY client for the composer's GIF picker.
 *
 * Replaces Tenor, whose API was decommissioned on 2026-06-30. KLIPY puts
 * the key in the path rather than a query parameter. The key is a public
 * client key (VITE_KLIPY_KEY) and ships in the bundle; without one the
 * picker hides itself rather than erroring — see `klipyEnabled`.
 */

const KEY = import.meta.env.VITE_KLIPY_KEY;
const BASE = `https://api.klipy.com/api/v1/${KEY}/gifs`;

export const klipyEnabled = Boolean(KEY);

export interface Gif {
    id: string;
    /** Full-size GIF — sent as the message, so january embeds it as an image. */
    url: string;
    /** Grid preview. WebP: same animation at a fraction of the bytes. */
    preview: string;
    width: number;
    height: number;
    description: string;
}

interface KlipyFile {
    url: string;
    width: number;
    height: number;
}

/** Each item carries four size tiers, each in five formats. */
type KlipyTier = Partial<Record<"gif" | "webp", KlipyFile>>;

interface KlipyItem {
    id: number | string;
    title?: string;
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
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
) {
    const query = new URLSearchParams(params);
    const response = await fetch(`${BASE}/${path}?${query}`, { signal });
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

function normalise(items: KlipyItem[]): Gif[] {
    return items
        .map((item) => {
            const full = pick(item, "gif", ["hd", "md", "sm"]);
            const preview =
                pick(item, "webp", ["sm", "md", "xs"]) ??
                pick(item, "gif", ["sm", "md"]);
            if (!full || !preview) return undefined;

            return {
                id: `${item.id}`,
                url: full.url,
                preview: preview.url,
                width: preview.width,
                height: preview.height,
                description: item.title || "GIF",
            };
        })
        .filter((gif): gif is Gif => gif !== undefined);
}

/** GIFs trending right now, shown before anything is typed. */
export async function gifTrending(
    page = 1,
    limit = 30,
    signal?: AbortSignal,
): Promise<GifPage> {
    const data = await get<KlipyPage>(
        "trending",
        { page: `${page}`, per_page: `${limit}` },
        signal,
    );

    return { gifs: normalise(data.data.data), hasNext: data.data.has_next };
}

export async function gifSearch(
    query: string,
    page = 1,
    limit = 30,
    signal?: AbortSignal,
): Promise<GifPage> {
    const data = await get<KlipyPage>(
        "search",
        { q: query, page: `${page}`, per_page: `${limit}` },
        signal,
    );

    return { gifs: normalise(data.data.data), hasNext: data.data.has_next };
}

export interface GifCategory {
    /** Search run when the category is picked. */
    query: string;
    name: string;
    /** Animated still that backs the category tile. */
    preview: string;
}

/** Reaction categories ("lol", "thumbs up", …) for the browse grid. */
export async function gifCategories(signal?: AbortSignal) {
    const data = await get<{
        data: {
            categories: {
                category: string;
                query: string;
                preview_url: string;
            }[];
        };
    }>("categories", {}, signal);

    return data.data.categories.map((entry) => ({
        query: entry.query,
        name: entry.category,
        preview: entry.preview_url,
    }));
}
