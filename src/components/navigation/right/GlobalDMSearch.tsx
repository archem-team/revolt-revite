import { Search as SearchIcon } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { useHistory } from "react-router-dom";
import styled from "styled-components/macro";

import { useEffect, useState } from "preact/hooks";

import { Preloader } from "@revoltchat/ui";

import { useClient } from "../../../controllers/client/ClientController";
import Message from "../../common/messaging/Message";
import { GenericSidebarBase, GenericSidebarList } from "../SidebarBase";
import { useApplicationState } from "../../../mobx/State";

// Custom wider sidebar for search results
const SearchSidebarBase = styled(GenericSidebarBase)`
    width: 100%;
    max-width: none;
    
    @media (max-width: 1200px) {
        width: 100%;
    }
    
    @media (max-width: 900px) {
        width: 100%;
    }
`;

const SearchBase = styled.div`
    padding: 6px;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    height: 100%;

    .results-container {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .list {
        gap: 4px;
        margin: 8px 0;
        display: flex;
        flex-direction: column;
    }

    .channel-group {
        margin-bottom: 12px;

        .channel-name {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--tertiary-foreground);
            margin: 8px 4px 4px 4px;
            padding: 4px 0;
        }
    }

    .message {
        margin: 4px 2px 8px 2px;
        padding: 8px;
        overflow: hidden;
        border-radius: var(--border-radius);
        background: var(--primary-background);
        cursor: pointer;

        &:hover {
            background: var(--hover);
        }

        > * {
            pointer-events: none;
        }
        
        p {
            color: var(--foreground) !important;
        }
        
        color: var(--foreground);
    }

    .status {
        text-align: center;
        padding: 16px;
        color: var(--secondary-foreground);
        font-size: 14px;
        line-height: 1.4;
        word-break: normal;
    }

    .error {
        color: var(--error);
    }

    .empty {
        color: var(--tertiary-foreground);
        padding: 24px 16px;
        text-align: center;
        line-height: 1.45;

        div {
            max-width: 220px;
            margin: 0 auto;
        }
    }
`;

interface Props {
    close: () => void;
    initialQuery?: string;
}

export const GlobalDMSearch = observer(({ close, initialQuery = "" }: Props) => {
    const client = useClient();
    const appState = useApplicationState();
    const dmSearch = appState.dmSearch;
    const history = useHistory();
    const searchState = dmSearch.getState();

    // Get all DM channels
    const dmChannels = [...client.channels.values()].filter(
        (x) =>
            (x.channel_type === "DirectMessage" && x.active) ||
            x.channel_type === "Group",
    );

    useEffect(() => {
        if (initialQuery.trim()) {
            void dmSearch.search(initialQuery, dmChannels);
        } else {
            dmSearch.clear();
        }
    }, [dmChannels, dmSearch, initialQuery]);

    const handleMessageClick = (
        e: MouseEvent,
        channelId: string,
        messageId: string
    ) => {
        e.preventDefault();
        // Navigate to the channel and message
        const channel = client.channels.get(channelId);
        if (channel) {
            history.push(`/channel/${channelId}/${messageId}`);
            close();
        }
    };

    return (
        <SearchSidebarBase>
            <SearchBase className="global-dm-search">
                <div className="results-container">
                    {searchState.type === "idle" && initialQuery === "" && (
                        <div className="empty">
                            <SearchIcon
                                size={32}
                                style={{
                                    marginBottom: "12px",
                                    opacity: 0.5,
                                }}
                            />
                            <div>
                                Start typing in the header to search across all
                                your DM conversations
                            </div>
                        </div>
                    )}

                    {searchState.type === "searching" && (
                        <div className="status">
                            <Preloader />
                            <div style={{ marginTop: "8px" }}>
                                Searching...
                            </div>
                        </div>
                    )}

                    {searchState.type === "error" && (
                        <div className="status error">
                            <div>Error: {searchState.error}</div>
                        </div>
                    )}

                    {searchState.type === "results" && (
                        <>
                            {searchState.totalMatches === 0 ? (
                                <div className="status">
                                    No results found for "{searchState.query}"
                                </div>
                            ) : (
                                <>
                                    <div className="status">
                                        Found {searchState.totalMatches} match
                                        {searchState.totalMatches !== 1
                                            ? "es"
                                            : ""}{" "}
                                        in {searchState.results.length}{" "}
                                        conversation
                                        {searchState.results.length !== 1
                                            ? "s"
                                            : ""}
                                    </div>
                                    <div className="list">
                                        {searchState.results.map(
                                            (result, idx) => (
                                                <div
                                                    key={idx}
                                                    className="channel-group"
                                                >
                                                    <div className="channel-name">
                                                        {result.channel
                                                            .channel_type ===
                                                            "DirectMessage"
                                                            ? result.channel
                                                                .recipient
                                                                ?.username ||
                                                            "Unknown"
                                                            : result.channel
                                                                .name ||
                                                            "Group Chat"}
                                                    </div>
                                                    {result.messages.map(
                                                        (msg) => (
                                                            <div
                                                                key={msg._id}
                                                                className="message"
                                                                onClick={(
                                                                    e
                                                                ) =>
                                                                    handleMessageClick(
                                                                        e,
                                                                        result
                                                                            .channel
                                                                            ._id,
                                                                        msg._id
                                                                    )
                                                                }
                                                            >
                                                                <Message
                                                                    message={msg}
                                                                    contrast
                                                                />
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </SearchBase>
        </SearchSidebarBase>
    );
});
