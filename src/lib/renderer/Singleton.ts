/* eslint-disable react-hooks/rules-of-hooks */
import { action, makeAutoObservable } from "mobx";
import { Channel, Message, Nullable } from "revolt.js";

import { SimpleRenderer } from "./simple/SimpleRenderer";
import { RendererRoutines, ScrollState } from "./types";

export const SMOOTH_SCROLL_ON_RECEIVE = false;

export class ChannelRenderer {
    channel: Channel;

    state: "LOADING" | "WAITING_FOR_NETWORK" | "EMPTY" | "RENDER" = "LOADING";
    scrollState: ScrollState = { type: "ScrollToBottom" };
    atTop: Nullable<boolean> = null;
    atBottom: Nullable<boolean> = null;
    messages: Message[] = [];
    pinned_messages: Message[] = [];

    currentRenderer: RendererRoutines = SimpleRenderer;

    stale = false;
    fetching = false;
    scrollPosition = 0;
    scrollAnchored = false;

    /** Bumped per fetch and per preempt; commits from an older flight are dropped. */
    flightId = 0;

    constructor(channel: Channel) {
        this.channel = channel;

        makeAutoObservable(this, {
            channel: false,
            currentRenderer: false,
            scrollPosition: false,
            scrollAnchored: false,
            flightId: false,
        });

        this.receive = this.receive.bind(this);
        this.updated = this.updated.bind(this);
        this.delete = this.delete.bind(this);

        const client = this.channel.client;
        client.addListener("message", this.receive);
        client.addListener("message/updated", this.updated);
        client.addListener("message/delete", this.delete);
    }

    destroy() {
        const client = this.channel.client;
        client.removeListener("message", this.receive);
        client.removeListener("message/updated", this.updated);
        client.removeListener("message/delete", this.delete);
    }

    private receive(message: Message) {
        this.currentRenderer.receive(this, message);
    }

    private updated(id: string, message: Message) {
        this.currentRenderer.updated(this, id, message);
    }

    private delete(id: string) {
        this.currentRenderer.delete(this, id);
    }

    @action async init(message_id?: string) {
        if (message_id) {
            if (this.state === "RENDER") {
                const message = this.messages.find((x) => x._id === message_id);

                if (message) {
                    this.emitScroll({
                        type: "ScrollToView",
                        id: message_id,
                    });

                    return;
                }
            }
        }

        this.preempt();
        this.stale = false;
        this.state = "LOADING";
        this.currentRenderer.init(this, message_id);
    }

    /** Drop any in-flight fetch and reset scroll state (remount / re-init). */
    @action preempt() {
        this.flightId++;
        this.fetching = false;
        this.scrollState = { type: "Free" };
    }

    @action emitScroll(state: ScrollState) {
        // Passive bottom-keeping hints must not overwrite a pending fetch
        // correction — losing it strands the view on the skeleton wall.
        if (
            this.scrollState.type === "Anchor" &&
            state.type === "StayAtBottom"
        ) {
            return;
        }

        this.scrollState = state;
    }

    @action markStale() {
        this.stale = true;
    }

    /** Clear a pending Anchor once applied so StayAtBottom flows again. */
    @action consumeAnchor() {
        if (this.scrollState.type === "Anchor") {
            this.scrollState = { type: "Free" };
        }
    }

    async reloadStale() {
        if (this.stale) {
            this.stale = false;
            await this.init();
        }
    }

    /**
     * First message (searching in the given direction) that actually has a
     * DOM element to anchor to — system messages render without ids, so the
     * boundary message alone is not a reliable anchor.
     */
    private findAnchor(fromEnd: boolean): string | undefined {
        const list = this.messages;
        for (let i = 0; i < list.length; i++) {
            const message = list[fromEnd ? list.length - 1 - i : i];
            if (document.getElementById(message._id)) return message._id;
        }
        return undefined;
    }

    async loadTop(ref?: HTMLDivElement) {
        if (this.fetching) return;
        this.fetching = true;
        this.flightId++;

        // Keep the previously-oldest visible message stationary across
        // the prepend: measured just before the commit, corrected after.
        const anchorId = this.findAnchor(false);

        function generateScroll(_end: string): ScrollState {
            const el = anchorId && document.getElementById(anchorId);
            if (el) {
                return {
                    type: "Anchor",
                    id: anchorId!,
                    previousTop: el.getBoundingClientRect().top,
                };
            }
            return { type: "Free" };
        }

        try {
            if (await this.currentRenderer.loadTop(this, generateScroll)) {
                this.fetching = false;
            }
        } catch (err) {
            // A failed fetch must never wedge the loader shut.
            this.fetching = false;
        }
    }

    async loadBottom(ref?: HTMLDivElement) {
        if (this.fetching) return;
        this.fetching = true;
        this.flightId++;

        // Same as loadTop, anchored on the newest message instead.
        const anchorId = this.findAnchor(true);

        function generateScroll(_start: string): ScrollState {
            const el = anchorId && document.getElementById(anchorId);
            if (el) {
                return {
                    type: "Anchor",
                    id: anchorId!,
                    previousTop: el.getBoundingClientRect().top,
                };
            }
            // Never teleport mid-history — worst case, stay put.
            return { type: "Free" };
        }

        try {
            if (await this.currentRenderer.loadBottom(this, generateScroll)) {
                this.fetching = false;
            }
        } catch (err) {
            this.fetching = false;
        }
    }

    async jumpToBottom(smooth: boolean) {
        if (this.state === "RENDER" && this.atBottom) {
            this.emitScroll({ type: "ScrollToBottom", smooth });
        } else {
            await this.currentRenderer.init(this, undefined, true);
        }
    }
}

const renderers: Record<string, ChannelRenderer> = {};

export function getRenderer(channel: Channel) {
    let renderer = renderers[channel._id];
    if (!renderer) {
        renderer = new ChannelRenderer(channel);
        renderers[channel._id] = renderer;
    }

    return renderer;
}

export function deleteRenderer(channel_id: string) {
    delete renderers[channel_id];
}
