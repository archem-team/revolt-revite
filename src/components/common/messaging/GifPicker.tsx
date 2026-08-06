import { Search, X } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { useEffect, useRef, useState } from "preact/hooks";

import {
    Gif,
    GifCategory,
    gifCategories,
    gifSearch,
    gifTrending,
} from "../../../lib/klipy";

const Base = styled.div`
    position: absolute;
    bottom: 8px;
    right: 0;
    z-index: 20;

    width: 340px;
    height: 400px;
    display: flex;
    flex-direction: column;

    background: var(--secondary-background);
    border-radius: var(--border-radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    overflow: hidden;
`;

const Header = styled.div`
    flex-shrink: 0;
    padding: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--secondary-header);

    svg {
        flex-shrink: 0;
        color: var(--tertiary-foreground);
    }

    input {
        flex-grow: 1;
        min-width: 0;
        border: none;
        outline: none;
        font-size: 14px;
        font-family: inherit;
        color: var(--foreground);
        background: transparent;

        &::placeholder {
            color: var(--tertiary-foreground);
        }
    }

    .clear {
        cursor: pointer;
        display: flex;
        &:hover svg {
            color: var(--foreground);
        }
    }
`;

const Categories = styled.div`
    flex-shrink: 0;
    display: flex;
    gap: 6px;
    padding: 8px 8px 0;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }

    button {
        flex-shrink: 0;
        cursor: pointer;
        border: none;
        padding: 4px 10px;
        font-size: 12px;
        font-family: inherit;
        color: var(--foreground);
        background: var(--primary-background);
        border-radius: calc(var(--border-radius) * 2);

        &:hover {
            background: var(--tertiary-background);
        }
    }
`;

/* Masonry columns: GIF aspect ratios vary wildly, and a fixed grid
   either letterboxes them or crops the subject out. */
const Results = styled.div`
    flex-grow: 1;
    overflow-y: auto;
    padding: 8px;
    column-count: 2;
    column-gap: 6px;

    img {
        width: 100%;
        display: block;
        cursor: pointer;
        margin-bottom: 6px;
        border-radius: calc(var(--border-radius) / 2);
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

const Attribution = styled.div`
    flex-shrink: 0;
    padding: 4px 8px;
    font-size: 10px;
    text-align: end;
    color: var(--tertiary-foreground);
    background: var(--secondary-header);
`;

interface Props {
    onSelect: (url: string) => void;
    onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: Props) {
    const [query, setQuery] = useState("");
    const [gifs, setGifs] = useState<Gif[]>([]);
    const [categories, setCategories] = useState<GifCategory[]>([]);
    const [state, setState] = useState<"loading" | "ready" | "failed">(
        "loading",
    );
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => input.current?.focus(), []);

    useEffect(() => {
        const controller = new AbortController();
        gifCategories(controller.signal)
            .then(setCategories)
            .catch(() => undefined);

        return () => controller.abort();
    }, []);

    // Debounced so typing doesn't fire a request per keystroke; the
    // controller cancels whatever is in flight when the query moves on,
    // so results can never arrive out of order.
    useEffect(() => {
        const controller = new AbortController();
        const search = query.trim();

        setState("loading");
        const timeout = setTimeout(
            () => {
                (search
                    ? gifSearch(search, 30, controller.signal)
                    : gifTrending(30, controller.signal)
                )
                    .then((results) => {
                        setGifs(results);
                        setState("ready");
                    })
                    .catch((err) => {
                        if (err.name !== "AbortError") setState("failed");
                    });
            },
            search ? 300 : 0,
        );

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [query]);

    return (
        <Base>
            <Header>
                <Search size={18} />
                <input
                    ref={input}
                    value={query}
                    placeholder="Search GIFs"
                    onInput={(e) => setQuery(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.stopPropagation();
                            onClose();
                        }
                    }}
                />
                {query && (
                    <div className="clear" onClick={() => setQuery("")}>
                        <X size={18} />
                    </div>
                )}
            </Header>

            {!query && categories.length > 0 && (
                <Categories>
                    {categories.slice(0, 12).map((category) => (
                        <button
                            key={category.query}
                            onClick={() => setQuery(category.query)}>
                            {category.name}
                        </button>
                    ))}
                </Categories>
            )}

            {state === "failed" ? (
                <Notice>Couldn't reach KLIPY. Check your connection.</Notice>
            ) : state === "loading" ? (
                <Notice>Loading…</Notice>
            ) : gifs.length === 0 ? (
                <Notice>No GIFs found.</Notice>
            ) : (
                <Results>
                    {gifs.map((gif) => (
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
                </Results>
            )}

            <Attribution>Powered by KLIPY</Attribution>
        </Base>
    );
}
