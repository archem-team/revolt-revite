import { Channel, Client } from "revolt.js";

/**
 * Convert friendly @RoleName / @username mentions typed into a composer
 * into the wire format (<%ROLE_ID> / <@USER_ID>). Used by both the
 * message box and the message editor so edits behave like sends.
 *
 * Roles run before usernames so an account named after a role cannot
 * capture its pings; role names are matched literally (they may contain
 * spaces), longest name first so overlapping names resolve
 * deterministically. Only roles the author may ping are converted
 * (mentionable ones, or all of them when they hold MentionRoles in this
 * channel) — mirrors the autocomplete suggestions.
 */
export function convertMentionsToWireFormat(
    content: string,
    channel: Channel,
    client: Client,
): string {
    if (channel.channel_type === "TextChannel" && content.includes("@")) {
        const server = channel.server;
        if (server) {
            const canMentionAll = channel.havePermission(
                "MentionRoles" as never,
            );

            const roles = server.orderedRoles
                .filter(
                    (role) =>
                        ((role as { mentionable?: boolean }).mentionable ||
                            canMentionAll) &&
                        role.name &&
                        role.name.toLowerCase() !== "everyone",
                )
                .sort((a, b) => b.name!.length - a.name!.length);

            for (const role of roles) {
                const escaped = role.name!.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&",
                );
                content = content.replace(
                    new RegExp(`@${escaped}(?![\\w-])`, "gi"),
                    `<%${role.id}>`,
                );
            }
        }
    }

    // Convert @username mentions to <@USER_ID> format.
    // Hyphens are part of a username: without them "@john-doe" matched
    // only "@john", the lookup for that name failed, and the mention was
    // sent as plain text. Same character class the search autocomplete
    // uses (lib/hooks/useSearchAutoComplete.ts).
    const mentionRegex = /@([\w-]+)/g;
    const mentionMatches = content.match(mentionRegex);

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
