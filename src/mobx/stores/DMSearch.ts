import { action, computed, makeAutoObservable, observable } from "mobx";
import { Message as MessageI, Channel } from "revolt.js";

import Store from "../interfaces/Store";

interface DMSearchResult {
    channel: Channel;
    messages: MessageI[];
}

export type DMSearchState =
    | {
          type: "idle";
      }
    | {
          type: "searching";
          query: string;
      }
    | {
          type: "results";
          query: string;
          results: DMSearchResult[];
          totalMatches: number;
      }
    | {
          type: "error";
          query: string;
          error: string;
      };

/**
 * Handles searching messages across all DM conversations
 */
export default class DMSearch implements Store {
    private state: DMSearchState;

    constructor() {
        this.state = { type: "idle" };
        makeAutoObservable(this);
    }

    get id() {
        return "dm_search";
    }

    /**
     * Get current search state
     */
    @computed getState(): DMSearchState {
        return this.state;
    }

    /**
     * Search for messages across all DM channels
     * @param query Search query string
     * @param dmChannels Array of DM channels to search
     */
    @action async search(query: string, dmChannels: Channel[]): Promise<void> {
        if (!query.trim()) {
            this.state = { type: "idle" };
            return;
        }

        this.state = { type: "searching", query };

        try {
            const results: DMSearchResult[] = [];
            const lowerQuery = query.toLowerCase();
            let totalMatches = 0;

            // Search each DM channel
            for (const channel of dmChannels) {
                try {
                    // Fetch messages from the channel with search API
                    const searchOptions = {
                        query,
                        limit: 100, // Get up to 100 matches per channel
                    };

                    // Use the channel's search method if available
                    if (
                        channel.searchWithUsers &&
                        typeof channel.searchWithUsers === "function"
                    ) {
                        const data = await channel.searchWithUsers(
                            searchOptions,
                        );

                        if (data.messages && data.messages.length > 0) {
                            results.push({
                                channel,
                                messages: data.messages,
                            });
                            totalMatches += data.messages.length;
                        }
                    }
                } catch (err) {
                    // Continue searching other channels on error
                    console.warn(
                        `Failed to search channel ${channel._id}:`,
                        err,
                    );
                }
            }

            // Sort channels by most recent match
            results.sort((a, b) => {
                const aLatest = a.messages[0]?.createdAt?.getTime() || 0;
                const bLatest = b.messages[0]?.createdAt?.getTime() || 0;
                return bLatest - aLatest;
            });

            this.state = {
                type: "results",
                query,
                results,
                totalMatches,
            };
        } catch (err) {
            console.error("Global DM search failed:", err);
            this.state = {
                type: "error",
                query,
                error: err instanceof Error ? err.message : "Search failed",
            };
        }
    }

    /**
     * Clear search results
     */
    @action clear() {
        this.state = { type: "idle" };
    }
}
