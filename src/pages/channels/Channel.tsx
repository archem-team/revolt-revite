import { Ghost } from "@styled-icons/boxicons-solid";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { Redirect, useParams } from "react-router-dom";
import { Channel as ChannelI } from "revolt.js";
import styled, { css } from "styled-components/macro";

import { Text } from "preact-i18n";
import { useEffect, useState } from "preact/hooks";

import ErrorBoundary from "../../lib/ErrorBoundary";
import { internalSubscribe } from "../../lib/eventEmitter";
import { isTouchscreenDevice } from "../../lib/isTouchscreenDevice";

import { useApplicationState } from "../../mobx/State";
import { SIDEBAR_MEMBERS } from "../../mobx/stores/Layout";

import AgeGate from "../../components/common/AgeGate";
import { Grid3x3 } from "../../components/common/Grid3x3";
import MessageBox from "../../components/common/messaging/MessageBox";
import JumpToBottom from "../../components/common/messaging/bars/JumpToBottom";
import NewMessages from "../../components/common/messaging/bars/NewMessages";
import TypingIndicator from "../../components/common/messaging/bars/TypingIndicator";
import RightSidebar from "../../components/navigation/RightSidebar";
import { SearchBar } from "../../components/navigation/SearchBar";
import { PageHeader } from "../../components/ui/Header";
import { useClient } from "../../controllers/client/ClientController";
import ChannelHeader from "./ChannelHeader";
import { MessageArea } from "./messaging/MessageArea";
import PinnedMessage from "../../components/common/messaging/bars/PinnedMessage";

/**
 * Channel layout: a column on the canvas. The top row is plain text —
 * the channel name/topic and the search pill sit directly on the canvas (no
 * header bar). Below it, the chat area is a fully-rounded floating panel with
 * the member column beside it on the canvas.
 */
const ChannelPage = styled.div.attrs({ "data-component": "channel-page" })`
    flex-grow: 1;
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;

    ${() =>
        !isTouchscreenDevice &&
        css`
            gap: var(--space-2);
            padding: var(--space-2);
        `}
`;

const HeaderRow = styled.div.attrs({ "data-component": "channel-header-row" })`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-2);

    .headerArea {
        flex-grow: 1;
        min-width: 0;
        height: var(--header-height);

        /* The channel name is plain text on the canvas — strip the header
           bar chrome the shared Header component paints, and pull it back
           into normal flow (it is absolutely positioned by default so it can
           float over the message area). */
        > * {
            position: static !important;
            width: 100% !important;
            background: transparent !important;
            backdrop-filter: none !important;
            border: none !important;
            box-shadow: none !important;
        }
    }

    .searchArea {
        /* Matches the member column below it (248px side column). */
        width: 248px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
    }
`;

const Body = styled.div.attrs({ "data-component": "channel-body" })`
    flex-grow: 1;
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: row;

    ${() =>
        !isTouchscreenDevice &&
        css`
            gap: var(--space-2);
        `}
`;

const ChatPanel = styled.div.attrs({ "data-component": "chat-panel" })`
    flex-grow: 1;
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    background: var(--primary-background);

    ${() =>
        !isTouchscreenDevice &&
        css`
            /* The main content surface uses radius "xl" (28px) —
               see its layout/Main.tsx. */
            border-radius: 28px;
            overflow: hidden;
        `}
`;

const MemberColumn = styled.div.attrs({ "data-component": "member-column" })`
    display: flex;
    flex-shrink: 0;
    min-height: 0;
    flex-direction: column;

    /* The legacy floating header used to overlay this list, so it carries a
       48px scroll offset — in this layout the search row is a real sibling,
       so the offset is dead space (the list starts right below search). */
    [data-scroll-offset="with-padding"] {
        padding-top: 0;

        &::-webkit-scrollbar-thumb {
            border-top: 0 solid transparent;
        }
    }
`;

const ChannelMain = styled.div.attrs({ "data-component": "channel" })`
    flex-grow: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
    flex-direction: row;
`;

const ChannelContent = styled.div.attrs({
    "data-component": "content",
})`
    flex-grow: 1;
    display: flex;
    overflow: hidden;
    flex-direction: column;
`;

const PlaceholderBase = styled.div`
    @keyframes floating {
        0% {
            transform: translate(0, 0px);
        }
        50% {
            transform: translate(0, 15px);
        }
        100% {
            transform: translate(0, -0px);
        }
    }

    flex-grow: 1;
    display: flex;
    overflow: hidden;
    flex-direction: column;

    .floating {
        animation-name: floating;
        animation-duration: 3s;
        animation-iteration-count: infinite;
        animation-timing-function: ease-in-out;
    }

    .placeholder {
        justify-content: center;
        text-align: center;
        margin: auto;
        padding: 12px;

        .primary {
            color: var(--secondary-foreground);
            font-weight: 700;
            font-size: 22px;
            margin: 0 0 5px 0;
        }

        .secondary {
            color: var(--tertiary-foreground);
            font-weight: 400;
        }

        svg {
            margin: 2em auto;
            fill-opacity: 0.8;
        }
    }
`;

export const Channel = observer(
    ({ id, server_id }: { id: string; server_id: string }) => {
        const client = useClient();
        const state = useApplicationState();

        if (!client.channels.get(id)) {
            if (server_id) {
                const server = client.servers.get(server_id);
                if (server && server.channel_ids.length > 0) {
                    let target_id = server.channel_ids[0];
                    const last_id = state.layout.getLastOpened(server_id);
                    if (last_id) {
                        if (client.channels.has(last_id)) {
                            target_id = last_id;
                        }
                    }

                    return (
                        <Redirect
                            to={`/server/${server_id}/channel/${target_id}`}
                        />
                    );
                }
            } else {
                return <Redirect to="/" />;
            }

            return <ChannelPlaceholder />;
        }

        const channel = client.channels.get(id)!;

        return <TextChannel channel={channel} />;
    },
);

const TextChannel = observer(({ channel }: { channel: ChannelI }) => {
    const layout = useApplicationState().layout;

    // Store unread location.
    const [lastId, setLastId] = useState<string | undefined>(undefined);

    useEffect(
        () =>
            internalSubscribe("NewMessages", "hide", () =>
                setLastId(undefined),
            ),
        [],
    );

    useEffect(
        () => internalSubscribe("NewMessages", "mark", setLastId as any),
        [],
    );

    // Mark channel as read.
    useEffect(() => {
        setLastId(
            (channel.unread
                ? channel.client.unreads?.getUnread(channel._id)?.last_id
                : undefined) ?? undefined,
        );

        const checkUnread = () =>
            channel.unread &&
            channel.client.unreads!.markRead(
                channel._id,
                channel.last_message_id!,
                true,
            );

        checkUnread();
        return reaction(
            () => channel.last_message_id,
            () => checkUnread(),
        );
    }, [channel]);

    return (
        <AgeGate
            type="channel"
            channel={channel}
            gated={
                !!(
                    (channel.channel_type === "TextChannel" ||
                        channel.channel_type === "Group") &&
                    channel.nsfw
                )
            }>
            <ChannelPage>
                {!isTouchscreenDevice && (
                    <HeaderRow>
                        <div className="headerArea">
                            <ChannelHeader channel={channel} />
                        </div>
                        {channel.channel_type !== "VoiceChannel" && (
                            <div className="searchArea">
                                <SearchBar />
                            </div>
                        )}
                    </HeaderRow>
                )}
                <Body>
                    <ChatPanel>
                        {isTouchscreenDevice && (
                            <ChannelHeader channel={channel} />
                        )}
                        <ChannelMain>
                            <ErrorBoundary section="renderer">
                                {/* Keyed: message internals (renderer,
                                    listeners, autofocus) rely on
                                    mount-per-channel; the shell above
                                    persists across switches. */}
                                <ChannelContent key={channel._id}>
                                    <NewMessages
                                        channel={channel}
                                        last_id={lastId}
                                    />
                                    <PinnedMessage channel={channel} />
                                    <MessageArea
                                        channel={channel}
                                        last_id={lastId}
                                    />
                                    <TypingIndicator channel={channel} />
                                    <JumpToBottom channel={channel} />
                                    <MessageBox channel={channel} />
                                </ChannelContent>
                            </ErrorBoundary>
                        </ChannelMain>
                    </ChatPanel>
                    {!isTouchscreenDevice &&
                        layout.getSectionState(SIDEBAR_MEMBERS, true) && (
                            <MemberColumn>
                                <RightSidebar />
                            </MemberColumn>
                        )}
                </Body>
            </ChannelPage>
        </AgeGate>
    );
});

function ChannelPlaceholder() {
    return (
        <PlaceholderBase>
            <PageHeader icon={<Grid3x3 size={24} />}>
                <span className="name">
                    <Text id="app.main.channel.errors.nochannel" />
                </span>
            </PageHeader>

            <div className="placeholder">
                <div className="floating">
                    <Ghost width={80} />
                </div>
                <div className="primary">
                    <Text id="app.main.channel.errors.title" />
                </div>
                <div className="secondary">
                    <Text id="app.main.channel.errors.nochannels" />
                </div>
            </div>
        </PlaceholderBase>
    );
}

export default function ChannelComponent() {
    const { channel, server } =
        useParams<{ channel: string; server: string }>();

    /* No key here: remounting the whole page per channel repaints the
       panel/header/member column from scratch, which flashes the canvas
       behind them. Only the message internals remount (ChannelContent is
       keyed below); the shell updates in place. */
    return <Channel id={channel} server_id={server} />;
}
