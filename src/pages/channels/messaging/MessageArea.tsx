import { observer } from "mobx-react-lite";
import { useHistory, useParams } from "react-router-dom";
import { Channel } from "revolt.js";
import { Message } from "revolt.js/esm";
import styled from "styled-components/macro";
import useResizeObserver from "use-resize-observer";

import { createContext } from "preact";
import {
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "preact/hooks";

import { Preloader } from "@revoltchat/ui";

import MessageSkeleton from "../../../components/common/messaging/MessageSkeleton";
import { internalEmit, internalSubscribe } from "../../../lib/eventEmitter";
import { getRenderer } from "../../../lib/renderer/Singleton";
import { ScrollState } from "../../../lib/renderer/types";

import {
    useClient,
    useSession,
} from "../../../controllers/client/ClientController";
import RequiresOnline from "../../../controllers/client/jsx/RequiresOnline";
import { modalController } from "../../../controllers/modals/ModalController";
import ConversationStart from "./ConversationStart";
import MessageRenderer from "./MessageRenderer";

const Area = styled.div.attrs({ "data-scroll-offset": "with-padding" })`
    height: 100%;
    flex-grow: 1;
    min-height: 0;
    word-break: break-word;

    overflow-x: hidden;
    overflow-y: scroll;
    /* Reverse-scroller architecture: in a
       column-reverse scroll container scrollTop 0 IS the bottom, so the
       list paints already at the newest messages (no restore pass), stays
       pinned to the bottom natively, and loading older history grows
       upward without moving the viewport. scrollTop runs [-max, 0]. */
    display: flex;
    flex-direction: column-reverse;
    /* Native scroll anchoring stays on (matches upstream); it absorbs
       late layout shifts between fetches and the fetch-time correction
       composes with it. */

    &::-webkit-scrollbar-thumb {
        min-height: 150px;
    }

    > div {
        display: flex;
        min-height: 100%;
        padding-bottom: 26px;
        flex-direction: column;
        justify-content: flex-end;
        /* The reverse scroller's single child must not shrink, or long
           histories collapse to the container height. */
        flex-shrink: 0;
    }
`;

interface Props {
    last_id?: string;
    channel: Channel;
}

export const MessageAreaWidthContext = createContext(0);
export const MESSAGE_AREA_PADDING = 82;

export const MessageArea = observer(({ last_id, channel }: Props) => {
    const history = useHistory();
    const session = useSession()!;

    // ? Required data for message links.
    const { message } = useParams<{ message: string }>();
    const [highlight, setHighlight] = useState<string | undefined>(undefined);

    // ? This is the scroll container.
    const ref = useRef<HTMLDivElement>(null);
    const { width, height } = useResizeObserver<HTMLDivElement>({ ref });

    // ? Current channel state.
    const renderer = getRenderer(channel);

    // ? useRef to avoid re-renders
    const scrollState = useRef<ScrollState>({ type: "Free" });

    const setScrollState = useCallback(
        (v: ScrollState) => {
            if (v.type === "StayAtBottom") {
                if (scrollState.current.type === "Bottom" || atBottom()) {
                    scrollState.current = {
                        type: "ScrollToBottom",
                        smooth: v.smooth,
                    };
                } else {
                    scrollState.current = { type: "Free" };
                }
            } else {
                scrollState.current = v;
            }

            // Applied synchronously: every position-type state arrives via
            // the renderer.scrollState layout effect (DOM committed, not
            // yet painted), so correcting scrollTop here means no frame is
            // ever painted at the wrong position. The old setTimeout-based
            // defer showed one mispositioned frame per history fetch.
            //
            // Column-reverse scroller: the bottom is scrollTop 0 and
            // positions are negative offsets from it.
            if (scrollState.current.type === "ScrollToBottom") {
                setScrollState({
                    type: "Bottom",
                    scrollingUntil: +new Date() + 150,
                });

                ref.current?.scrollTo({
                    top: 0,
                    behavior: scrollState.current.smooth ? "smooth" : "auto",
                });
            } else if (scrollState.current.type === "ScrollToView") {
                document
                    .getElementById(scrollState.current.id)
                    ?.scrollIntoView({ block: "center" });

                setScrollState({ type: "Free" });
            } else if (scrollState.current.type === "OffsetTop") {
                // Content was appended at the bottom (scroll origin) side:
                // keep the viewport on the same messages by backing off by
                // the added height.
                if (ref.current) {
                    ref.current.scrollTop =
                        ref.current.scrollTop -
                        (ref.current.scrollHeight -
                            scrollState.current.previousHeight);
                }

                setScrollState({ type: "Free" });
            } else if (scrollState.current.type === "ScrollTop") {
                if (ref.current) {
                    ref.current.scrollTop = scrollState.current.y;
                }

                setScrollState({ type: "Free" });
            } else if (scrollState.current.type === "Anchor") {
                // Applied by MessageRenderer, whose commit carries the
                // message DOM — here we just reset the local state.
                setScrollState({ type: "Free" });
            }
        },
        // eslint-disable-next-line
        [scrollState],
    );

    // ? Determine if we are at the bottom of the scroll container.
    // Column-reverse scroller: scrollTop is 0 at the bottom and negative
    // when scrolled up into history.
    // By default, we assume we are at the bottom, i.e. when we first load.
    const atBottom = (offset = 0) =>
        ref.current ? ref.current.scrollTop >= -(offset + 1) : true;

    const atTop = (offset = 0) =>
        ref.current
            ? ref.current.scrollTop <=
              ref.current.clientHeight - ref.current.scrollHeight + offset
            : false;
    const client = useClient();
    function pin(message: Message) {
        client.api.post(
            `/channels/${message.channel_id}/messages/${message._id}/pin` as any,
        );
        message.is_pinned = true;
    }

    function unpin(message: Message) {
        client.api.delete(
            `/channels/${message.channel_id}/messages/${message._id}/pin` as any,
        );
        message.is_pinned = false;
    }
    // ? Handle global jump to bottom, e.g. when editing last message in chat.
    useEffect(() => {
        return internalSubscribe("MessageArea", "jump_to_bottom", () =>
            setScrollState({ type: "ScrollToBottom" }),
        );
    }, [setScrollState]);

    useEffect(() => {
        return internalSubscribe(
            "MessageBox",
            "pin",
            pin as (...args: unknown[]) => void,
        );
    }, []);
    useEffect(() => {
        return internalSubscribe(
            "MessageBox",
            "unpin",
            unpin as (...args: unknown[]) => void,
        );
    }, []);
    // ? Load channel initially.
    // Layout effect + direct scrollTop: cached channels must be positioned
    // BEFORE first paint — the deferred scroll (setTimeout) lands a frame
    // late and shows the list at the top before snapping to the bottom.
    // Runs before the renderer-events effect below so preempt() clears
    // stale fetch/scroll state from a previous visit first.
    useLayoutEffect(() => {
        renderer.preempt();

        if (message) return;
        if (renderer.state === "RENDER") {
            if (renderer.scrollAnchored) {
                // Reverse scroller paints at the bottom (0) natively.
                if (ref.current) ref.current.scrollTop = 0;
                setScrollState({ type: "ScrollToBottom" });
            } else {
                // Saved positions are raw (negative) reverse offsets.
                if (ref.current)
                    ref.current.scrollTop = renderer.scrollPosition;
                setScrollState({
                    type: "ScrollTop",
                    y: renderer.scrollPosition,
                });
            }
        } else {
            renderer.init();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ? Handle events from renderer.
    useLayoutEffect(
        () => setScrollState(renderer.scrollState),
        // eslint-disable-next-line
        [renderer.scrollState],
    );

    // ? If message present or changes, load it as well.
    useEffect(() => {
        if (message) {
            setHighlight(message);
            renderer.init(message);

            if (channel.channel_type === "TextChannel") {
                history.push(
                    `/server/${channel.server_id}/channel/${channel._id}`,
                );
            } else {
                history.push(`/channel/${channel._id}`);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message]);

    // ? If we are waiting for network, try again.
    useEffect(() => {
        switch (session.state) {
            case "Online":
                if (renderer.state === "WAITING_FOR_NETWORK") {
                    renderer.init();
                } else {
                    renderer.reloadStale();
                }

                break;
            case "Offline":
            case "Disconnected":
            case "Connecting":
                renderer.markStale();
                break;
        }
    }, [renderer, session.state]);

    // ? When the container is scrolled.
    // ? Also handle StayAtBottom
    useEffect(() => {
        const current = ref.current;
        if (!current) return;

        async function onScroll() {
            // Chromium overscrolls reverse-column flexboxes past the origin
            // when content is added, breaking bottom-stick — clamp to 0.
            // (See issues.chromium.org/40829494.)
            if (current && current.scrollTop > 0) {
                current.scrollTop = 0;
            }

            if (scrollState.current.type === "Free" && atBottom()) {
                setScrollState({ type: "Bottom" });
            } else if (scrollState.current.type === "Bottom" && !atBottom()) {
                if (
                    scrollState.current.scrollingUntil &&
                    scrollState.current.scrollingUntil > +new Date()
                )
                    return;
                setScrollState({ type: "Free" });
            }
        }

        current.addEventListener("scroll", onScroll);
        return () => current.removeEventListener("scroll", onScroll);
    }, [ref, scrollState, setScrollState]);

    // ? Top and bottom loaders.
    useEffect(() => {
        const current = ref.current;
        if (!current) return;

        async function onScroll() {
            renderer.scrollPosition = current!.scrollTop;

            if (atBottom()) {
                renderer.scrollAnchored = true;
            } else {
                renderer.scrollAnchored = false;
            }
        }

        current.addEventListener("scroll", onScroll);
        return () => current.removeEventListener("scroll", onScroll);
    }, [ref, renderer]);

    // ? Scroll down whenever the message area resizes.
    // (Reverse scroller keeps the bottom natively; this is a safety net.)
    const stbOnResize = useCallback(() => {
        if (!atBottom() && scrollState.current.type === "Bottom") {
            if (ref.current) ref.current.scrollTop = 0;

            setScrollState({ type: "Bottom" });
        }
    }, [setScrollState]);

    // ? Scroll down when container resized.
    useLayoutEffect(() => {
        stbOnResize();
    }, [stbOnResize, height]);

    // ? Scroll down whenever the window resizes.
    useLayoutEffect(() => {
        document.addEventListener("resize", stbOnResize);
        return () => document.removeEventListener("resize", stbOnResize);
    }, [ref, scrollState, stbOnResize]);

    // ? Scroll to bottom when pressing 'Escape'.
    useEffect(() => {
        function keyUp(e: KeyboardEvent) {
            if (e.key === "Escape" && !modalController.isVisible) {
                renderer.jumpToBottom(true);
                internalEmit("TextArea", "focus", "message");
            }
        }

        document.body.addEventListener("keyup", keyUp);
        return () => document.body.removeEventListener("keyup", keyUp);
    }, [renderer, ref]);

    return (
        <MessageAreaWidthContext.Provider
            // Before the resize observer reports (first paint after mount)
            // fall back to a width that sizes embeds/attachments at their
            // usual maximum — never 0/negative, which let media render
            // unconstrained for a frame and flash across the panel.
            value={width ? width - MESSAGE_AREA_PADDING : 504}>
            <Area ref={ref}>
                <div>
                    {renderer.state === "LOADING" && <MessageSkeleton />}
                    {renderer.state === "WAITING_FOR_NETWORK" && (
                        <RequiresOnline>
                            <Preloader type="ring" />
                        </RequiresOnline>
                    )}
                    {renderer.state === "RENDER" && (
                        <MessageRenderer
                            last_id={last_id}
                            renderer={renderer}
                            highlight={highlight}
                        />
                    )}
                    {renderer.state === "EMPTY" && (
                        <ConversationStart channel={channel} />
                    )}
                </div>
            </Area>
        </MessageAreaWidthContext.Provider>
    );
});
