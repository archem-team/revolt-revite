import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY;

// Only initialise when a project key is configured (e.g. omitted in local dev).
if (key) {
    posthog.init(key as string, {
        api_host:
            (import.meta.env.VITE_POSTHOG_HOST as string) ||
            "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: true,
    });
}

export default posthog;
