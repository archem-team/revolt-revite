import { passThroughComponents } from "./plugins/remarkRegexComponent";
import { timestampHandler } from "./plugins/timestamps";

export const handlers = {
    ...passThroughComponents("emoji", "uemoji", "spoiler", "mention", "channel", "everyone", "rolemention"),
    timestamp: timestampHandler,
};
