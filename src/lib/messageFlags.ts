/**
 * Message flag bitfield constants
 * These values must match the backend MessageFlags enum
 */
export const MessageFlags = {
    /** Message will not send push / desktop notifications */
    SuppressNotifications: 1,
    /** Message mentions @everyone */
    MentionsEveryone: 2,
    /** Message mentions roles */
    MentionsRole: 4,
    /** Message mentions @online (online users only) */
    MentionsOnline: 8,
} as const;

export type MessageFlagsType = typeof MessageFlags[keyof typeof MessageFlags];

/**
 * Note: Role mention detection is now handled inline in MessageBox.tsx
 * The regex /@([a-zA-Z0-9_\s-]+)/g is used directly to find all @mention patterns,
 * then we try roles first, then usernames for each match.
 */