import { runInAction } from "mobx";

import { SMOOTH_SCROLL_ON_RECEIVE } from "../Singleton";
import { DOMUpdate, RendererRoutines } from "../types";

export const SimpleRenderer: RendererRoutines = {
    init: async (renderer, nearby, smooth) => {
        if (renderer.channel.client.websocket.connected) {
            if (nearby)
                renderer.channel
                    .fetchMessagesWithUsers({ nearby, limit: 100 })
                    .then(({ messages, pinned_messages }) => {
                        messages.sort((a, b) => a._id.localeCompare(b._id));

                        runInAction(() => {
                            renderer.state = "RENDER";
                            renderer.messages = messages;
                            renderer.pinned_messages = pinned_messages;

                            renderer.atTop = false;
                            renderer.atBottom = false;

                            renderer.emitScroll({
                                type: "ScrollToView",
                                id: nearby,
                            });
                        });
                    });
            else
                renderer.channel
                    .fetchMessagesWithUsers({})
                    .then(({ messages, pinned_messages }) => {
                        messages.reverse();
                        runInAction(() => {
                            renderer.state = "RENDER";
                            renderer.messages = messages;
                            renderer.pinned_messages = pinned_messages;
                            renderer.atTop = messages.length < 50;
                            renderer.atBottom = true;

                            renderer.emitScroll({
                                type: "ScrollToBottom",
                                smooth,
                            });
                        });
                    });
        } else {
            runInAction(() => {
                renderer.state = "WAITING_FOR_NETWORK";
            });
        }
    },
    receive: async (renderer, message) => {
        if (message.channel_id !== renderer.channel._id) return;
        if (renderer.state !== "RENDER") return;
        if (renderer.messages.find((x) => x._id === message._id)) return;
        if (!renderer.atBottom) return;

        let messages = [...renderer.messages, message];
        let atTop = renderer.atTop;
        if (messages.length > 150) {
            messages = messages.slice(messages.length - 150);
            atTop = false;
        }

        runInAction(() => {
            renderer.messages = messages;
            renderer.atTop = atTop;

            renderer.emitScroll({
                type: "StayAtBottom",
                smooth: SMOOTH_SCROLL_ON_RECEIVE,
            });
        });
    },
    updated: async (renderer) => {
        renderer.emitScroll({
            type: "StayAtBottom",
            smooth: false,
        });
    },
    delete: async (renderer, id) => {
        const channel = renderer.channel;
        if (!channel) return;
        if (renderer.state !== "RENDER") return;

        const index = renderer.messages.findIndex((x) => x._id === id);

        if (index > -1) {
            runInAction(() => {
                renderer.messages.splice(index, 1);
                renderer.emitScroll({ type: "StayAtBottom" });
            });
        }
    },
    loadTop: async (renderer): Promise<DOMUpdate | undefined> => {
        if (renderer.state !== "RENDER") return;
        if (renderer.atTop) return;

        const { messages: data } =
            await renderer.channel.fetchMessagesWithUsers({
                before: renderer.messages[0]._id,
            });

        if (data.length === 0) {
            runInAction(() => {
                renderer.atTop = true;
            });
            return;
        }

        data.reverse();

        // Anchor to the oldest currently-visible message
        const anchorId = renderer.messages[0]._id;

        return {
            scrollAnchorId: anchorId,
            commitToDOM() {
                runInAction(() => {
                    renderer.messages = [...data, ...renderer.messages];

                    if (data.length < 50) {
                        renderer.atTop = true;
                    }

                    if (renderer.messages.length > 150) {
                        renderer.messages = renderer.messages.slice(0, 150);
                        renderer.atBottom = false;
                    }
                });
            },
        };
    },
    loadBottom: async (renderer): Promise<DOMUpdate | undefined> => {
        if (renderer.state !== "RENDER") return;
        if (renderer.atBottom) return;

        const { messages: data } =
            await renderer.channel.fetchMessagesWithUsers({
                after: renderer.messages[renderer.messages.length - 1]._id,
                sort: "Oldest",
            });

        if (data.length === 0) {
            runInAction(() => {
                renderer.atBottom = true;
            });
            return;
        }

        // Anchor to the newest currently-visible message
        const anchorId =
            renderer.messages[renderer.messages.length - 1]._id;

        return {
            scrollAnchorId: anchorId,
            commitToDOM() {
                runInAction(() => {
                    let messages = [...renderer.messages, ...data];

                    if (data.length < 50) {
                        renderer.atBottom = true;
                    }

                    if (messages.length > 150) {
                        messages = messages.slice(messages.length - 150);
                        renderer.atTop = false;
                    }

                    renderer.messages = messages;
                });
            },
        };
    },
};
