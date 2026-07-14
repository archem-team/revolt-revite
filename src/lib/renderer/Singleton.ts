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

    constructor(channel: Channel) {
        this.channel = channel;

        makeAutoObservable(this, {
            channel: false,
            currentRenderer: false,
            scrollPosition: false,
            scrollAnchored: false,
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

        this.stale = false;
        this.state = "LOADING";
        this.currentRenderer.init(this, message_id);
    }

    @action emitScroll(state: ScrollState) {
        this.scrollState = state;
    }

    @action markStale() {
        this.stale = true;
    }

    @action complete() {
        this.fetching = false;
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

        // Anchor the boundary: keep the previously-oldest anchorable
        // message at the same viewport position across the update. Unlike
        // preserving the scroll offset, this also behaves at the scroller's
        // hard edges — pinned at the top of the skeleton wall, fetched
        // messages slide INTO the viewport instead of landing below it.
        const anchorId = this.findAnchor(false);

        // The rect is read inside generateScroll (post-fetch, pre-render),
        // so it reflects the latest layout before the list updates.
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

        // Anchor the boundary: keep the previously-newest anchorable
        // message at the same viewport position across the append + trim.
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
