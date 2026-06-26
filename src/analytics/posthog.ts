import posthog, { Properties } from "posthog-js";

/**
 * Initialize PostHog analytics.
 * Called once at app startup before rendering.
 */
export function initPostHog() {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

    if (!key) {
        console.warn("[Analytics] VITE_POSTHOG_KEY is not set. Analytics are disabled.");
        return;
    }

    posthog.init(key, {
        api_host: host,
        // Defaults snapshot date — keeps flag evaluations consistent with this project's launch
        defaults: "2026-05-30",
        // Only create person profiles for identified users (privacy)
        person_profiles: "identified_only",
        // Disable autocapture to keep events intentional
        autocapture: false,
        // Capture pageviews manually via useRouteAnalytics
        capture_pageview: false,
        // Capture pageleave for session duration calculation
        capture_pageleave: true,
        // Persist across sessions
        persistence: "localStorage",
        // Mask sensitive input fields
        mask_all_element_attributes: true,
        loaded: (ph) => {
            if (import.meta.env.DEV) {
                // Log events in development console for easy debugging
                ph.debug();
            }
        },
    });
}


/**
 * Typed analytics facade — wraps PostHog with safe no-ops when disabled.
 */
export const analytics = {
    /**
     * Identify the authenticated user.
     * @param userId Revolt user ID
     * @param traits Optional properties to set on the person profile
     */
    identify(userId: string, traits?: Properties) {
        posthog.identify(userId, traits);
    },

    /**
     * Capture a named event with optional properties.
     * @param event Event name
     * @param properties Additional event properties
     */
    capture(event: string, properties?: Properties) {
        posthog.capture(event, properties);
    },

    /**
     * Track a page view with the current URL.
     * @param url Optional path override
     */
    pageview(url?: string) {
        posthog.capture("$pageview", {
            $current_url: url ?? window.location.href,
        });
    },

    /**
     * Reset user identity (on logout).
     */
    reset() {
        posthog.reset();
    },

    /**
     * Set super properties that will be sent with every event.
     * @param properties Key-value pairs to register
     */
    register(properties: Properties) {
        posthog.register(properties);
    },

    /**
     * Unregister a super property.
     * @param key Property key to remove
     */
    unregister(key: string) {
        posthog.unregister(key);
    },
};

export default analytics;
