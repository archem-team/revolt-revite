import { Channel, Client } from "revolt.js";

/** Escape a literal string for embedding into a RegExp. */
export function escapeRegex(literal: string) {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Roles the author may ping in this channel (mentionable ones, or all of
 * them when they hold MentionRoles), longest name first so overlapping
 * names resolve deterministically. Shared by the send-time conversion,
 * and the composer overlay so the preview never disagrees with what
 * actually converts at send.
 */
export function composerPingableRoles(channel: Channel) {
    if (channel.channel_type !== "TextChannel") return [];

    const server = channel.server;
    if (!server) return [];

    const canMentionAll = channel.havePermission("MentionRoles" as never);

    return server.orderedRoles
        .filter(
            (role) =>
                ((role as { mentionable?: boolean }).mentionable ||
                    canMentionAll) &&
                role.name &&
                role.name.toLowerCase() !== "everyone",
        )
        .sort((a, b) => b.name!.length - a.name!.length);
}

/**
 * Username mention pattern. Hyphens are part of a username: without them
 * "@john-doe" matched only "@john", the lookup for that name failed, and
 * the mention was sent as plain text. Same character class the search
 * autocomplete uses (lib/hooks/useSearchAutoComplete.ts).
 */
export const RE_USERNAME_MENTION = /@([\w-]+)/g;

/**
 * Convert friendly @RoleName / @username mentions typed into a composer
 * into the wire format (<%ROLE_ID> / <@USER_ID>). Used by both the
 * message box and the message editor so edits behave like sends.
 *
 * Roles run before usernames so an account named after a role cannot
 * capture its pings; role names are matched literally (they may contain
 * spaces).
 */
export function convertMentionsToWireFormat(
    content: string,
    channel: Channel,
    client: Client,
): string {
    if (content.includes("@")) {
        for (const role of composerPingableRoles(channel)) {
            content = content.replace(
                new RegExp(`@${escapeRegex(role.name!)}(?![\\w-])`, "gi"),
                `<%${role.id}>`,
            );
        }
    }

    const mentionMatches = content.match(RE_USERNAME_MENTION);

    if (mentionMatches) {
        for (const mention of mentionMatches) {
            const username = mention.substring(1);
            if (username.toLowerCase() !== "everyone") {
                const user = Array.from(client.users.values()).find(
                    (u) =>
                        u.username.toLowerCase() === username.toLowerCase(),
                );

                if (user) {
                    content = content.replace(mention, `<@${user._id}>`);
                }
            }
        }
    }

    return content;
}
