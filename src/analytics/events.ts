import analytics from "./posthog";

// ─── Event Name Constants ────────────────────────────────────────────────────

export const EVENTS = {
    // User Growth
    SIGN_UP_STARTED: "Sign Up Started",
    SIGN_UP_COMPLETED: "Sign Up Completed",
    LOGIN: "Login",

    // Community Activity
    COMMUNITY_VIEWED: "Community Viewed",
    COMMUNITY_JOINED: "Community Joined",
    COMMUNITY_LEFT: "Community Left",
    COMMUNITY_CREATED: "Community Created",

    // Messaging
    DM_STARTED: "DM Started",
    MESSAGE_SENT: "Message Sent",
    MESSAGE_RECEIVED: "Message Received",

    // User Engagement
    SESSION_STARTED: "Session Started",
    SESSION_ENDED: "Session Ended",
    FRIENDS_ADDED: "Friend Added",
    PROFILE_VIEWED: "Profile Viewed",
    SEARCH_USED: "Search Used",

    // Platform Health
    API_ERROR: "API Error",
    MESSAGE_DELIVERY_FAILURE: "Message Delivery Failure",
    SOCKET_DISCONNECT: "Socket Disconnect",
    PAGE_LOAD_TIME: "Page Load Time",
} as const;

// ─── User Growth ─────────────────────────────────────────────────────────────

export function trackSignUpStarted() {
    analytics.capture(EVENTS.SIGN_UP_STARTED);
}

export function trackSignUpCompleted(email?: string) {
    analytics.capture(EVENTS.SIGN_UP_COMPLETED, {
        // Never pass the actual email – just record whether it was provided
        has_email: !!email,
    });
}

/**
 * @param isReturning true = existing account, false = brand new session
 */
export function trackLogin(isReturning: boolean) {
    analytics.capture(EVENTS.LOGIN, {
        user_type: isReturning ? "returning" : "new",
    });
}

// ─── Community Activity ───────────────────────────────────────────────────────

export function trackCommunityViewed(serverId: string) {
    analytics.capture(EVENTS.COMMUNITY_VIEWED, { server_id: serverId });
}

export function trackCommunityJoined(serverId: string, via?: "invite" | "discover") {
    analytics.capture(EVENTS.COMMUNITY_JOINED, { server_id: serverId, via });
}

export function trackCommunityLeft(serverId: string) {
    analytics.capture(EVENTS.COMMUNITY_LEFT, { server_id: serverId });
}

export function trackCommunityCreated(serverId: string) {
    analytics.capture(EVENTS.COMMUNITY_CREATED, { server_id: serverId });
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export function trackDMStarted(targetUserId: string) {
    analytics.capture(EVENTS.DM_STARTED, { target_user_id: targetUserId });
}

export function trackMessageSent(channelType: string, hasAttachments: boolean) {
    analytics.capture(EVENTS.MESSAGE_SENT, {
        channel_type: channelType,
        has_attachments: hasAttachments,
    });
}

export function trackMessageReceived(channelType: string) {
    analytics.capture(EVENTS.MESSAGE_RECEIVED, { channel_type: channelType });
}

// ─── Session / Retention ─────────────────────────────────────────────────────

/**
 * Track session start. Returns the start timestamp for later use.
 */
export function trackSessionStarted(): number {
    const startedAt = Date.now();
    analytics.capture(EVENTS.SESSION_STARTED, { started_at: startedAt });
    return startedAt;
}

/**
 * Track session end and compute duration.
 * @param startedAt Timestamp from trackSessionStarted()
 */
export function trackSessionEnded(startedAt: number) {
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    analytics.capture(EVENTS.SESSION_ENDED, {
        duration_seconds: durationSeconds,
        duration_minutes: Math.round(durationSeconds / 60),
    });
}

// ─── User Engagement ─────────────────────────────────────────────────────────

export function trackFriendAdded() {
    analytics.capture(EVENTS.FRIENDS_ADDED);
}

export function trackProfileViewed(viewedUserId: string) {
    analytics.capture(EVENTS.PROFILE_VIEWED, {
        viewed_user_id: viewedUserId,
    });
}

export function trackSearchUsed(query?: string) {
    analytics.capture(EVENTS.SEARCH_USED, {
        // Never log actual query text – only its length for engagement metrics
        query_length: query?.length ?? 0,
    });
}

// ─── Platform Health ─────────────────────────────────────────────────────────

export function trackSocketDisconnect(reason?: string) {
    analytics.capture(EVENTS.SOCKET_DISCONNECT, { reason });
}

export function trackPageLoadTime(durationMs: number) {
    analytics.capture(EVENTS.PAGE_LOAD_TIME, {
        duration_ms: durationMs,
        duration_s: parseFloat((durationMs / 1000).toFixed(3)),
    });
}

export function trackAPIError(endpoint: string, statusCode?: number, message?: string) {
    analytics.capture(EVENTS.API_ERROR, {
        endpoint,
        status_code: statusCode,
        // Truncate message to avoid leaking sensitive info
        message: message?.slice(0, 200),
    });
}

export function trackMessageDeliveryFailure(channelId: string, reason?: string) {
    analytics.capture(EVENTS.MESSAGE_DELIVERY_FAILURE, {
        channel_id: channelId,
        reason,
    });
}
