import { ArrowBack, Search, X } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { useEffect, useRef, useState } from "preact/hooks";

import {
    Gif,
    GifCategory,
    MediaKind,
    gifCategories,
    gifSearch,
    gifTrending,
} from "../../../lib/klipy";

import GifCategories from "./GifCategories";
import GifSkeleton from "./GifSkeleton";

/** How far below the viewport the sentinel triggers the next page. */
const PREFETCH_MARGIN = "320px";

const Base = styled.div`
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
`;

const Header = styled.div`
    flex-shrink: 0;
    padding: 6px 14px 10px;
    display: flex;
    align-items: center;
    gap: 10px;

    svg {
        flex-shrink: 0;
        color: var(--tertiary-foreground);
    }

    input {
        flex-grow: 1;
        min-width: 0;
        border: none;
        outline: none;
        font-size: 0.9em;
        font-family: inherit;
        padding: 9px 14px;
        color: var(--foreground);
        border-radius: var(--radius-xl, 20px);
        background: var(--primary-header);

        &::placeholder {
            color: var(--tertiary-foreground);
        }
    }

    .action {
        cursor: pointer;
        display: flex;

        &:hover svg {
            color: var(--foreground);
        }
    }
`;

/* The scroller and the columns have to be separate elements: a
   multi-column box with a constrained height lays its overflow out as
   further columns to the RIGHT, which is what turned this into a
   sideways scroller. Height stays auto below, so the columns grow
   downwards and this parent scrolls vertically. */
const Scroller = styled.div`
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 14px 14px;
`;

/* Masonry columns: GIF aspect ratios vary wildly, and a fixed grid
   either letterboxes them or crops the subject out. */
const Masonry = styled.div`
    column-count: 2;
    column-gap: 10px;

    img {
        width: 100%;
        display: block;
        cursor: pointer;
        margin-bottom: 10px;
        border-radius: var(--radius-md, 8px);
        background: var(--primary-background);

        &:hover {
            outline: 2px solid var(--accent);
        }
    }
`;

/* Kept small: the prefetch margin means it usually loads before it
   scrolls into view, so the label is a fallback, not a state. */
const Sentinel = styled.div`
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--tertiary-foreground);
`;

/* KLIPY require their branding in the interface — it gates production
   access — so this stays put. */
const Attribution = styled.div`
    flex-shrink: 0;
    padding: 2px 14px 8px;
    font-size: 10px;
    letter-spacing: 0.3px;
    text-align: end;
    color: var(--tertiary-foreground);
`;

const Notice = styled.div`
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    text-align: center;
    font-size: 13px;
    color: var(--tertiary-foreground);
`;

interface Props {
    /** Which KLIPY library to browse. */
    kind: MediaKind;
    /** Second argument is the search that led here, if any. */
    onSelect: (gif: Gif, query?: string) => void;
    onClose: () => void;
}

export default function GifPicker({ kind, onSelect, onClose }: Props) {
    const [query, setQuery] = useState("");
    const [trendingOpen, setTrendingOpen] = useState(false);
    const [categories, setCategories] = useState<GifCategory[]>([]);
    const [trending, setTrending] = useState<Gif[]>([]);
    const [results, setResults] = useState<Gif[]>([]);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [trendingPage, setTrendingPage] = useState(1);
    const [trendingHasNext, setTrendingHasNext] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    // Tracked apart from the search: they load once and outlive any
    // number of searches, and conflating the two left the panel stuck
    // on a skeleton when a search was cleared mid-flight.
    const [browseState, setBrowseState] = useState<
        "loading" | "ready" | "failed"
    >("loading");
    const [searchState, setSearchState] = useState<
        "idle" | "loading" | "ready" | "failed"
    >("idle");
    const input = useRef<HTMLInputElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);

    // Categories back the browse grid; the trending run doubles as the
    // tile's preview and means opening Trending needs no further request.
    useEffect(() => {
        const controller = new AbortController();

        Promise.all([
            gifCategories(kind, controller.signal),
            gifTrending(kind, 1, 30, controller.signal),
        ])
            .then(([fetchedCategories, fetchedTrending]) => {
                setCategories(fetchedCategories);
                setTrending(fetchedTrending.gifs);
                setTrendingHasNext(fetchedTrending.hasNext);
                setBrowseState("ready");
            })
            .catch((err) => {
                if (err.name !== "AbortError") setBrowseState("failed");
            });

        return () => controller.abort();
    }, [kind]);

    // Debounced so typing doesn't fire a request per keystroke; the
    // controller cancels whatever is in flight when the query moves on,
    // so results can never arrive out of order.
    useEffect(() => {
        const search = query.trim();

        // Emptying the field returns to the browse grid, including when
        // it happens while a search is still in flight.
        if (!search) {
            setSearchState("idle");
            return;
        }

        const controller = new AbortController();
        setSearchState("loading");

        const timeout = setTimeout(() => {
            gifSearch(kind, search, 1, 30, controller.signal)
                .then((found) => {
                    setResults(found.gifs);
                    setPage(1);
                    setHasNext(found.hasNext);
                    setSearchState("ready");
                })
                .catch((err) => {
                    if (err.name !== "AbortError") setSearchState("failed");
                });
        }, 300);

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [kind, query]);

    const browsing = !query.trim() && !trendingOpen;
    const shown = trendingOpen ? trending : results;
    const moreAvailable = trendingOpen ? trendingHasNext : hasNext;

    /** Fetch the next page of whatever is showing and append it. */
    async function loadMore() {
        if (loadingMore) return;
        setLoadingMore(true);

        try {
            if (trendingOpen) {
                const next = await gifTrending(kind, trendingPage + 1, 30);
                const seen = new Set(trending.map((gif) => gif.id));
                setTrending([
                    ...trending,
                    ...next.gifs.filter((gif) => !seen.has(gif.id)),
                ]);
                setTrendingPage(trendingPage + 1);
                setTrendingHasNext(next.hasNext);
            } else {
                const next = await gifSearch(kind, query.trim(), page + 1, 30);
                const seen = new Set(results.map((gif) => gif.id));
                setResults([
                    ...results,
                    ...next.gifs.filter((gif) => !seen.has(gif.id)),
                ]);
                setPage(page + 1);
                setHasNext(next.hasNext);
            }
        } catch (_) {
            // Stop asking; a fresh search re-arms pagination.
            if (trendingOpen) setTrendingHasNext(false);
            else setHasNext(false);
        } finally {
            setLoadingMore(false);
        }
    }

    // The observer only ever calls the latest loadMore — the callback
    // closes over live state, the observer itself does not.
    const loadMoreRef = useRef(loadMore);
    loadMoreRef.current = loadMore;

    useEffect(() => {
        const target = sentinel.current;
        if (!target || !moreAvailable) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) loadMoreRef.current();
                }
            },
            { root: scroller.current, rootMargin: PREFETCH_MARGIN },
        );

        observer.observe(target);
        return () => observer.disconnect();
        // Re-arm whenever the result view or its supply changes.
    }, [moreAvailable, trendingOpen, searchState, shown.length]);

    /** Back out of a category, search or trending, to the browse grid. */
    function back() {
        setQuery("");
        setTrendingOpen(false);
        input.current?.focus();
    }

    return (
        <Base>
            <Header>
                {browsing ? (
                    <Search size={18} />
                ) : (
                    <div className="action" onClick={back}>
                        <ArrowBack size={18} />
                    </div>
                )}
                <input
                    ref={input}
                    value={query}
                    placeholder={
                        kind === "stickers" ? "Search stickers" : "Search GIFs"
                    }
                    onInput={(e) => {
                        setTrendingOpen(false);
                        setQuery(e.currentTarget.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.stopPropagation();
                            if (browsing) onClose();
                            else back();
                        }
                    }}
                />
                {query && (
                    <div className="action" onClick={back}>
                        <X size={18} />
                    </div>
                )}
            </Header>

            {browseState === "failed" || searchState === "failed" ? (
                <Notice>
                    Couldn&apos;t reach KLIPY. Check your connection.
                </Notice>
            ) : browseState === "loading" ? (
                <GifSkeleton variant="tiles" />
            ) : browsing ? (
                <Scroller>
                    <GifCategories
                        categories={categories}
                        trendingPreview={trending[0]?.preview}
                        onPick={setQuery}
                        onTrending={() => setTrendingOpen(true)}
                    />
                </Scroller>
            ) : searchState === "loading" ? (
                <GifSkeleton variant="results" />
            ) : shown.length === 0 ? (
                <Notice>Nothing found.</Notice>
            ) : (
                <Scroller ref={scroller}>
                    <Masonry>
                        {shown.map((gif) => (
                            <img
                                key={gif.id}
                                src={gif.preview}
                                alt={gif.description}
                                width={gif.width}
                                height={gif.height}
                                loading="lazy"
                                draggable={false}
                                onClick={() =>
                                    onSelect(gif, query.trim() || undefined)
                                }
                            />
                        ))}
                    </Masonry>
                    {moreAvailable && (
                        <Sentinel ref={sentinel}>
                            {loadingMore ? "Loading more…" : ""}
                        </Sentinel>
                    )}
                </Scroller>
            )}

            <Attribution>Powered by KLIPY</Attribution>
        </Base>
    );
}
