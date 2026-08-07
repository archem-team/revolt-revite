import { ArrowBack, Search, X } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { useEffect, useRef, useState } from "preact/hooks";

import {
    Gif,
    GifCategory,
    gifCategories,
    gifSearch,
    gifTrending,
} from "../../../lib/klipy";

import GifCategories from "./GifCategories";
import GifSkeleton from "./GifSkeleton";

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
    onSelect: (url: string) => void;
    onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: Props) {
    const [query, setQuery] = useState("");
    const [trendingOpen, setTrendingOpen] = useState(false);
    const [categories, setCategories] = useState<GifCategory[]>([]);
    const [trending, setTrending] = useState<Gif[]>([]);
    const [results, setResults] = useState<Gif[]>([]);
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

    // Categories back the browse grid; the trending run doubles as the
    // tile's preview and means opening Trending needs no further request.
    useEffect(() => {
        const controller = new AbortController();

        Promise.all([
            gifCategories(controller.signal),
            gifTrending(30, controller.signal),
        ])
            .then(([fetchedCategories, fetchedTrending]) => {
                setCategories(fetchedCategories);
                setTrending(fetchedTrending);
                setBrowseState("ready");
            })
            .catch((err) => {
                if (err.name !== "AbortError") setBrowseState("failed");
            });

        return () => controller.abort();
    }, []);

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
            gifSearch(search, 30, controller.signal)
                .then((found) => {
                    setResults(found);
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
    }, [query]);

    const browsing = !query.trim() && !trendingOpen;
    const shown = trendingOpen ? trending : results;

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
                    placeholder="Search GIFs"
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
                <Notice>No GIFs found.</Notice>
            ) : (
                <Scroller>
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
                                onClick={() => onSelect(gif.url)}
                            />
                        ))}
                    </Masonry>
                </Scroller>
            )}
        </Base>
    );
}
