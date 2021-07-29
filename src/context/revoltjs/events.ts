import { Client, Message } from "revolt.js/dist";
import { ClientboundNotification } from "revolt.js/dist/websocket/notifications";

import { StateUpdater } from "preact/hooks";

import { dispatch } from "../../redux";

import { DataStore } from "../../mobx";
import { useData } from "../../mobx/State";
import { ClientOperations, ClientStatus } from "./RevoltClient";

export var preventReconnect = false;
let preventUntil = 0;

export function setReconnectDisallowed(allowed: boolean) {
    preventReconnect = allowed;
}

export function registerEvents(
    { operations }: { operations: ClientOperations },
    setStatus: StateUpdater<ClientStatus>,
    client: Client,
    store: DataStore,
) {
    function attemptReconnect() {
        if (preventReconnect) return;
        function reconnect() {
            preventUntil = +new Date() + 2000;
            client.websocket.connect().catch((err) => console.error(err));
        }

        if (+new Date() > preventUntil) {
            setTimeout(reconnect, 2000);
        } else {
            reconnect();
        }
    }

    let listeners: Record<string, (...args: any[]) => void> = {
        connecting: () =>
            operations.ready() && setStatus(ClientStatus.CONNECTING),

        dropped: () => {
            if (operations.ready()) {
                setStatus(ClientStatus.DISCONNECTED);
                attemptReconnect();
            }
        },

        packet: (packet: ClientboundNotification) => {
            store.packet(packet);
            switch (packet.type) {
                case "ChannelStartTyping": {
                    if (packet.user === client.user?._id) return;
                    dispatch({
                        type: "TYPING_START",
                        channel: packet.id,
                        user: packet.user,
                    });
                    break;
                }
                case "ChannelStopTyping": {
                    if (packet.user === client.user?._id) return;
                    dispatch({
                        type: "TYPING_STOP",
                        channel: packet.id,
                        user: packet.user,
                    });
                    break;
                }
                case "ChannelAck": {
                    dispatch({
                        type: "UNREADS_MARK_READ",
                        channel: packet.id,
                        message: packet.message_id,
                    });
                    break;
                }
            }
        },

        message: (message: Message) => {
            if (message.mentions?.includes(client.user!._id)) {
                dispatch({
                    type: "UNREADS_MENTION",
                    channel: message.channel,
                    message: message._id,
                });
            }
        },

        ready: () => setStatus(ClientStatus.ONLINE),
    };

    if (import.meta.env.DEV) {
        listeners = new Proxy(listeners, {
            get:
                (target, listener, receiver) =>
                (...args: unknown[]) => {
                    console.debug(`Calling ${listener.toString()} with`, args);
                    Reflect.get(target, listener)(...args);
                },
        });
    }

    // TODO: clean this a bit and properly handle types
    for (const listener in listeners) {
        client.addListener(listener, listeners[listener]);
    }

    function logMutation(target: string, key: string) {
        console.log("(o) Object mutated", target, "\nChanged:", key);
    }

    if (import.meta.env.DEV) {
        client.users.addListener("mutation", logMutation);
        client.servers.addListener("mutation", logMutation);
        client.channels.addListener("mutation", logMutation);
        client.members.addListener("mutation", logMutation);
    }

    const online = () => {
        if (operations.ready()) {
            setStatus(ClientStatus.RECONNECTING);
            setReconnectDisallowed(false);
            attemptReconnect();
        }
    };

    const offline = () => {
        if (operations.ready()) {
            setReconnectDisallowed(true);
            client.websocket.disconnect();
            setStatus(ClientStatus.OFFLINE);
        }
    };

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    return () => {
        for (const listener in listeners) {
            client.removeListener(
                listener,
                listeners[listener as keyof typeof listeners],
            );
        }

        if (import.meta.env.DEV) {
            client.users.removeListener("mutation", logMutation);
            client.servers.removeListener("mutation", logMutation);
            client.channels.removeListener("mutation", logMutation);
            client.members.removeListener("mutation", logMutation);
        }

        window.removeEventListener("online", online);
        window.removeEventListener("offline", offline);
    };
}
