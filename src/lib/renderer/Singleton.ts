/* eslint-disable react-hooks/rules-of-hooks */
import { action, makeAutoObservable } from "mobx";
import { Channel, Message, Nullable } from "revolt.js";

import { SimpleRenderer } from "./simple/SimpleRenderer";
import { DOMUpdate, RendererRoutines, ScrollState } from "./types";

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
                const message = this.messages.find(
                    (x) => x._id === message_id,
                );

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
     * Apply a DOMUpdate with element-based scroll anchoring.
     * Records anchor position before commit, corrects scroll
     * after DOM update using requestAnimationFrame to ensure
     * Preact has flushed the render.
     */
    applyDOMUpdate(update: DOMUpdate, scrollContainer: HTMLDivElement) {
        const anchorEl = update.scrollAnchorId
            ? document.getElementById(update.scrollAnchorId)
            : null;
        const rectBefore = anchorEl?.getBoundingClientRect() ?? null;

        // Commit state changes — triggers MobX reaction → Preact re-render
        update.commitToDOM();

        if (rectBefore && anchorEl) {
            // Use rAF to ensure Preact has flushed DOM changes
            requestAnimationFrame(() => {
                const rectAfter = anchorEl.getBoundingClientRect();
                const delta = rectAfter.top - rectBefore.top;
                if (Math.abs(delta) > 1) {
                    scrollContainer.scrollTop += delta;
                }
                this.fetching = false;
            });
        } else {
            this.fetching = false;
        }
    }

    async loadTop(ref?: HTMLDivElement) {
        if (this.fetching) return;
        this.fetching = true;

        try {
            const update = await this.currentRenderer.loadTop(this);

            if (update && ref) {
                this.applyDOMUpdate(update, ref);
            } else {
                this.fetching = false;
            }
        } catch {
            this.fetching = false;
        }
    }

    async loadBottom(ref?: HTMLDivElement) {
        if (this.fetching) return;
        this.fetching = true;

        try {
            const update = await this.currentRenderer.loadBottom(this);

            if (update && ref) {
                this.applyDOMUpdate(update, ref);
            } else {
                this.fetching = false;
            }
        } catch {
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
