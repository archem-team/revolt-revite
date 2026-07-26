import { Pin, X } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { useHistory, useParams } from "react-router-dom";
import { Message as MessageI } from "revolt.js";
import styled from "styled-components/macro";

import { Text } from "preact-i18n";
import { useEffect } from "preact/hooks";

import { IconButton } from "@revoltchat/ui";

import { internalSubscribe } from "../../../lib/eventEmitter";
import { getRenderer } from "../../../lib/renderer/Singleton";

import { useClient } from "../../../controllers/client/ClientController";
import Message from "../../common/messaging/Message";
import { GenericSidebarBase } from "../SidebarBase";

// Same footprint as the search results panel.
const PinnedSidebarBase = styled(GenericSidebarBase)`
    width: 360px;

    @media (max-width: 1200px) {
        width: 320px;
    }

    @media (max-width: 900px) {
        width: 280px;
    }
`;

const Base = styled.div`
    padding: 6px;
    flex-grow: 1;
    overflow-y: auto;

    .header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 8px 6px;
        font-size: 15px;
        font-weight: 600;
        color: var(--foreground);

        > svg {
            color: var(--tertiary-foreground);
        }

        .spacer {
            flex-grow: 1;
        }
    }

    .empty {
        margin-top: 32px;
        text-align: center;
        font-size: 13px;
        color: var(--tertiary-foreground);
    }

    .message {
        margin: 4px 2px 8px 2px;
        padding: 8px;
        overflow: hidden;
        cursor: pointer;
        border-radius: var(--border-radius);
        background: var(--primary-background);

        &:hover {
            background: var(--hover);
        }

        > * {
            pointer-events: none;
        }
    }
`;

interface Props {
    close: () => void;
}

export const PinnedSidebar = observer(({ close }: Props) => {
    const { channel: channelId } = useParams<{ channel: string }>();
    const client = useClient();
    const history = useHistory();

    const channel = client.channels.get(channelId);
    const renderer = channel ? getRenderer(channel) : undefined;

    // Keep the list in sync with pin/unpin actions.
    useEffect(() => {
        if (!renderer) return;

        const subs = [
            internalSubscribe("PinnedMessage", "update", (raw: unknown) => {
                const message = raw as MessageI;
                if (
                    !renderer.pinned_messages.find(
                        (x) => x._id === message._id,
                    )
                ) {
                    renderer.pinned_messages.push(message);
                }
            }),
            internalSubscribe("PinnedMessage", "delete", (id: unknown) => {
                renderer.pinned_messages = renderer.pinned_messages.filter(
                    (x) => x._id !== id,
                );
            }),
        ];

        return () => subs.forEach((unsub) => unsub());
    }, [renderer]);

    if (!channel || !renderer) return null;

    // is_pinned is a PepChat extension not present on the upstream type.
    const pinned = (
        renderer.pinned_messages as (MessageI & { is_pinned?: boolean })[]
    )
        .filter((x) => x.is_pinned)
        .sort((a, b) => b._id.localeCompare(a._id));

    return (
        <PinnedSidebarBase>
            <Base>
                <>
                <div className="header">
                    <Pin size={18} />
                    <Text id="app.main.channel.misc.pinned_message_title" />
                    <div className="spacer" />
                    <IconButton onClick={close}>
                        <X size={20} />
                    </IconButton>
                </div>
                {pinned.length === 0 && (
                    <div className="empty">No pinned messages yet.</div>
                )}
                {pinned.map((message) => (
                    <div
                        key={message._id}
                        className="message"
                        onClick={() => {
                            if (channel.channel_type === "TextChannel") {
                                history.push(
                                    `/server/${channel.server_id}/channel/${channel._id}/${message._id}`,
                                );
                            } else {
                                history.push(
                                    `/channel/${channel._id}/${message._id}`,
                                );
                            }
                        }}>
                        <Message
                            message={
                                message as Parameters<
                                    typeof Message
                                >[0]["message"]
                            }
                            head
                            hideReply
                        />
                    </div>
                ))}
                </>
            </Base>
        </PinnedSidebarBase>
    );
});
