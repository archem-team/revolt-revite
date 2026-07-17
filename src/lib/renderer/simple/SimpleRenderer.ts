import { runInAction } from "mobx";

import { SMOOTH_SCROLL_ON_RECEIVE } from "../Singleton";
import { RendererRoutines } from "../types";

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
        // Only relevant when pinned at the bottom; no scroll hints mid-history.
        if (!renderer.atBottom) return;

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

                // Same rule as edits: only hold the view when at the bottom.
                if (renderer.atBottom) {
                    renderer.emitScroll({ type: "StayAtBottom" });
                }
            });
        }
    },
    loadTop: async (renderer, generateScroll) => {
        const channel = renderer.channel;
        if (!channel) return true;

        if (renderer.state !== "RENDER") return true;
        if (renderer.atTop) return true;

        // If we get preempted while the request is in the air, drop the commit.
        const flight = renderer.flightId;

        const { messages: data } =
            await renderer.channel.fetchMessagesWithUsers({
                before: renderer.messages[0]._id,
            });

        runInAction(() => {
            if (renderer.flightId !== flight) return;

            // Re-arm the fetch gate here in the commit — every branch
            // must do this, or the walls stop fetching.
            renderer.fetching = false;

            if (data.length === 0) {
                renderer.atTop = true;
                return;
            }

            data.reverse();
            renderer.messages = [...data, ...renderer.messages];

            if (data.length < 50) {
                renderer.atTop = true;
            }

            if (renderer.messages.length > 150) {
                renderer.messages = renderer.messages.slice(0, 150);
                renderer.atBottom = false;
            }

            renderer.emitScroll(
                generateScroll(
                    renderer.messages[renderer.messages.length - 1]._id,
                ),
            );
        });
    },
    loadBottom: async (renderer, generateScroll) => {
        const channel = renderer.channel;
        if (!channel) return true;

        if (renderer.state !== "RENDER") return true;
        if (renderer.atBottom) return true;

        // If we get preempted while the request is in the air, drop the commit.
        const flight = renderer.flightId;

        const { messages: data } =
            await renderer.channel.fetchMessagesWithUsers({
                after: renderer.messages[renderer.messages.length - 1]._id,
                sort: "Oldest",
            });

        runInAction(() => {
            if (renderer.flightId !== flight) return;

            // Same contract as loadTop: the commit re-arms the fetch gate.
            renderer.fetching = false;

            if (data.length === 0) {
                renderer.atBottom = true;
                return;
            }

            renderer.messages.splice(renderer.messages.length, 0, ...data);

            if (data.length < 50) {
                renderer.atBottom = true;
            }

            if (renderer.messages.length > 150) {
                renderer.messages.splice(0, renderer.messages.length - 150);
                renderer.atTop = false;
            }

            renderer.emitScroll(generateScroll(renderer.messages[0]._id));
        });
    },
};
