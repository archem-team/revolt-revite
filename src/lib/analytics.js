/**
 * Send a first-party analytics event to PepChat. Delivery failures are exposed
 * to the caller so UI code can deliberately treat analytics as best effort.
 *
 * @param {{ apiBase: string, token: string, event: string, properties: Record<string, unknown>, fetchImpl?: typeof fetch, signal?: AbortSignal }} options
 * @returns {Promise<boolean>}
 */
export async function sendAnalyticsEvent({
    apiBase,
    token,
    event,
    properties,
    fetchImpl = fetch,
    signal,
}) {
    if (!token) return false;

    const response = await fetchImpl(
        `${apiBase.replace(/\/$/, "")}/analytics/events`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-session-token": token,
            },
            body: JSON.stringify({ event, properties }),
            keepalive: true,
            signal,
        },
    );

    if (!response.ok) {
        throw new Error(`Analytics request failed with ${response.status}`);
    }
    return true;
}
