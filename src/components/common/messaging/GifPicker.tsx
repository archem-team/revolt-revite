import { Search, X } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { useEffect, useRef, useState } from "preact/hooks";

import { Gif, gifSearch, gifTrending } from "../../../lib/klipy";

const Base = styled.div`
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
`;

const Header = styled.div`
    flex-shrink: 0;
    padding: 4px 10px 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;

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

    .clear {
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
   sideways scroller. Height stays auto here, so the columns grow
   downwards and this parent scrolls vertically. */
const Results = styled.div`
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 10px 10px;
`;

/* Masonry columns: GIF aspect ratios vary wildly, and a fixed grid
   either letterboxes them or crops the subject out. */
const Masonry = styled.div`
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
    padding: 2px 10px 6px;
    font-size: 10px;
    text-align: end;
    color: var(--tertiary-foreground);
`;

interface Props {
    onSelect: (url: string) => void;
    onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: Props) {
    const [query, setQuery] = useState("");
    const [gifs, setGifs] = useState<Gif[]>([]);
    const [state, setState] = useState<"loading" | "ready" | "failed">(
        "loading",
    );
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => input.current?.focus(), []);

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

            {state === "failed" ? (
                <Notice>Couldn't reach KLIPY. Check your connection.</Notice>
            ) : state === "loading" ? (
                <Notice>Loading…</Notice>
            ) : gifs.length === 0 ? (
                <Notice>No GIFs found.</Notice>
            ) : (
                <Results>
                    <Masonry>
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
                    </Masonry>
                </Results>
            )}

            <Attribution>Powered by KLIPY</Attribution>
        </Base>
    );
}
