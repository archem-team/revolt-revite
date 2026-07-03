import { observer } from "mobx-react-lite";
import { Redirect, useParams } from "react-router";
import styled, { css } from "styled-components/macro";

import { useTriggerEvents } from "preact-context-menu";
import { useEffect } from "preact/hooks";

import { Category } from "@revoltchat/ui";

import ConditionalLink from "../../../lib/ConditionalLink";
import PaintCounter from "../../../lib/PaintCounter";
import { internalEmit } from "../../../lib/eventEmitter";
import { isTouchscreenDevice } from "../../../lib/isTouchscreenDevice";

import { useApplicationState } from "../../../mobx/State";

import { useClient } from "../../../controllers/client/ClientController";
import CollapsibleSection from "../../common/CollapsibleSection";
import ServerHeader from "../../common/ServerHeader";
import { ChannelButton } from "../items/ButtonItem";
import ConnectionStatus from "../items/ConnectionStatus";

const ServerBase = styled.div`
    height: 100%;
    /* 248px channel sidebar (--layout-width-channel-sidebar). */
    width: 248px;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    overflow: hidden;

    /* The channel list is a full-height "sheet" one
       surface step above the canvas, rounded only on the side that meets the
       server rail (surface-container-low, left radii only). */
    background: var(--secondary-background);

    ${!isTouchscreenDevice &&
    css`
        /* Sidebar sheet: rounded only on the rail-facing side
           (borderStartRadius, 16px) — right corners stay square. */
        border-radius: 16px 0 0 16px;
    `}

    ${isTouchscreenDevice &&
    css`
        padding-bottom: 50px;
    `}
`;

const ServerList = styled.div`
    padding: 6px 8px;
    flex-grow: 1;
    overflow-y: scroll;
    overflow-x: hidden;

    > svg {
        width: 100%;
    }

    /* Category groups sit flat on the sidebar surface (no boxes), with
       plain whitespace separating the groups; the header is a 13px label at
       full foreground with a small trailing caret that rotates on collapse. */
    details {
        /* Group rhythm: ~18px between groups (8px here + the next
           header's 10px top padding). */
        margin-bottom: var(--space-2);
    }

    summary {
        .padding {
            display: flex;
            align-items: center;
            gap: var(--space-1);
            /* Two indent axes: the category label sits on the
               same left axis as the channel-row icons (list padding 8px +
               row padding 8px). Vertical: 10px above, 8px to the first row. */
            padding: 10px 4px 8px 8px;
            color: var(--foreground);

            &:hover {
                color: var(--secondary-foreground);
            }

            > svg {
                order: 2;
                width: 12px;
                height: 12px;
                flex-shrink: 0;
            }

            > div {
                order: 1;
                margin: 0;
                padding: 0;
                text-transform: none;
                font-size: 13px;
                font-weight: 500;
                letter-spacing: 0.5px;
                line-height: 16px;
                color: inherit;
            }
        }
    }
`;

export default observer(() => {
    const client = useClient();
    const state = useApplicationState();
    const { server: server_id, channel: channel_id } =
        useParams<{ server: string; channel?: string }>();

    const server = client.servers.get(server_id);
    if (!server) return <Redirect to="/" />;

    const channel = channel_id ? client.channels.get(channel_id) : undefined;

    // ! FIXME: move this globally
    // Track which channel the user was last on.
    useEffect(() => {
        if (!channel_id) return;
        if (!server_id) return;

        state.layout.setLastOpened(server_id, channel_id);
    }, [channel_id, server_id]);

    const uncategorised = new Set(server.channel_ids);
    const elements = [];

    function addChannel(id: string) {
        const entry = client.channels.get(id);
        if (!entry) return;

        const active = channel?._id === entry._id;
        const isUnread = entry.isUnread(state.notifications);
        const mentionCount = entry.getMentions(state.notifications);

        return (
            <ConditionalLink
                onClick={(e) => {
                    if (e.shiftKey) {
                        internalEmit(
                            "MessageBox",
                            "append",
                            `<#${entry._id}>`,
                            "channel_mention",
                        );
                        e.preventDefault();
                    }
                }}
                key={entry._id}
                active={active}
                to={`/server/${server!._id}/channel/${entry._id}`}>
                <ChannelButton
                    channel={entry}
                    active={active}
                    alert={
                        mentionCount.length > 0
                            ? "mention"
                            : isUnread
                            ? "unread"
                            : undefined
                    }
                    muted={state.notifications.isMuted(entry)}
                />
            </ConditionalLink>
        );
    }

    if (server.categories) {
        for (const category of server.categories) {
            const channels = [];
            for (const id of category.channels) {
                uncategorised.delete(id);
                channels.push(addChannel(id));
            }

            elements.push(
                <CollapsibleSection
                    id={`category_${category.id}`}
                    defaultValue
                    summary={<Category>{category.title}</Category>}>
                    {channels}
                </CollapsibleSection>,
            );
        }
    }

    for (const id of Array.from(uncategorised).reverse()) {
        elements.unshift(addChannel(id));
    }

    return (
        <ServerBase>
            <ServerHeader server={server} />
            <ConnectionStatus />
            <ServerList
                {...useTriggerEvents("Menu", {
                    server_list: server._id,
                })}>
                {elements}
            </ServerList>
            <PaintCounter small />
        </ServerBase>
    );
});
