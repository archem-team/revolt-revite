import { Message } from "revolt.js";

import { ChannelRenderer } from "./Singleton";

export interface DOMUpdate {
    /** Element ID to anchor scroll position to */
    scrollAnchorId: string | null;
    /** Apply the state changes to trigger a DOM update */
    commitToDOM(): void;
}

export type ScrollState =
    | { type: "Free" }
    | { type: "Bottom"; scrollingUntil?: number }
    | { type: "ScrollToBottom" | "StayAtBottom"; smooth?: boolean }
    | { type: "ScrollToView"; id: string }
    | { type: "ScrollTop"; y: number };

export type RenderState =
    | {
          type: "LOADING" | "WAITING_FOR_NETWORK" | "EMPTY";
      }
    | {
          type: "RENDER";
          atTop: boolean;
          atBottom: boolean;
          messages: Message[];
      };

export interface RendererRoutines {
    init: (
        renderer: ChannelRenderer,
        message?: string,
        smooth?: boolean,
    ) => Promise<void>;

    receive: (renderer: ChannelRenderer, message: Message) => Promise<void>;
    updated: (
        renderer: ChannelRenderer,
        id: string,
        message: Message,
    ) => Promise<void>;
    delete: (renderer: ChannelRenderer, id: string) => Promise<void>;

    loadTop: (
        renderer: ChannelRenderer,
    ) => Promise<DOMUpdate | undefined>;
    loadBottom: (
        renderer: ChannelRenderer,
    ) => Promise<DOMUpdate | undefined>;
}
