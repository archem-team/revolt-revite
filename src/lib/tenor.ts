/**
 * Tenor v2 client for the composer's GIF picker.
 *
 * The key is a public client key (VITE_TENOR_KEY) and ships in the
 * bundle, which is how Tenor's client keys are meant to be used; it is
 * rate limited per key. Without a key the picker hides itself rather
 * than erroring — see `tenorEnabled`.
 */

const BASE = "https://tenor.googleapis.com/v2";
const KEY = import.meta.env.VITE_TENOR_KEY;

/** Keep responses small: we only ever render the preview and send the full GIF. */
const MEDIA_FILTER = "gif,tinygif";

/** Tenor's own moderation tier; "medium" excludes adult and most risqué results. */
const CONTENT_FILTER = "medium";

export const tenorEnabled = Boolean(KEY);

export interface Gif {
    id: string;
    /** Full-size GIF — this is what gets sent, so it embeds as an image. */
    url: string;
    /** Small still-animating preview used in the picker grid. */
    preview: string;
    width: number;
    height: number;
    description: string;
}

export interface GifCategory {
    /** Query to run when the category is picked. */
    searchterm: string;
    name: string;
    image: string;
}

interface TenorFormat {
    url: string;
    dims: [number, number];
}

interface TenorResult {
    id: string;
    content_description?: string;
    media_formats: Record<string, TenorFormat | undefined>;
}

async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal) {
    const query = new URLSearchParams({
        key: KEY,
        contentfilter: CONTENT_FILTER,
        ...params,
    });

    const response = await fetch(`${BASE}/${path}?${query}`, { signal });
    if (!response.ok) throw new Error(`Tenor responded ${response.status}`);
    return (await response.json()) as T;
}

function normalise(results: TenorResult[]): Gif[] {
    return results
        .map((result) => {
            const full = result.media_formats.gif;
            const preview = result.media_formats.tinygif ?? full;
            if (!full || !preview) return undefined;

            return {
                id: result.id,
                url: full.url,
                preview: preview.url,
                width: preview.dims[0],
                height: preview.dims[1],
                description: result.content_description ?? "GIF",
            };
        })
        .filter((gif): gif is Gif => gif !== undefined);
}

/** GIFs trending on Tenor right now, shown before anything is typed. */
export async function tenorTrending(limit = 30, signal?: AbortSignal) {
    const data = await get<{ results: TenorResult[] }>(
        "featured",
        { limit: `${limit}`, media_filter: MEDIA_FILTER },
        signal,
    );

    return normalise(data.results);
}

export async function tenorSearch(query: string, limit = 30, signal?: AbortSignal) {
    const data = await get<{ results: TenorResult[] }>(
        "search",
        { q: query, limit: `${limit}`, media_filter: MEDIA_FILTER },
        signal,
    );

    return normalise(data.results);
}

export async function tenorCategories(signal?: AbortSignal) {
    const data = await get<{ tags: GifCategory[] }>(
        "categories",
        { type: "featured" },
        signal,
    );

    // Tenor prefixes category names with '#'.
    return data.tags.map((tag) => ({
        ...tag,
        name: tag.name.replace(/^#/, ""),
    }));
}
