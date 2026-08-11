import assert from "node:assert/strict";
import test from "node:test";

import { sendAnalyticsEvent } from "../src/lib/analytics.js";

test("analytics events use the common authenticated endpoint", async () => {
    let request;
    const sent = await sendAnalyticsEvent({
        apiBase: "https://peptide.chat/api/",
        token: "test-session",
        event: "ranking.page_viewed",
        properties: {
            serverId: "01J8W7NPV2DM3XR48JAYB1RDFK",
            managedServerCount: 1,
            language: "en",
        },
        fetchImpl: async (url, options) => {
            request = { url, options };
            return { ok: true, status: 202 };
        },
    });

    assert.equal(sent, true);
    assert.equal(request.url, "https://peptide.chat/api/analytics/events");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers["x-session-token"], "test-session");
    assert.deepEqual(JSON.parse(request.options.body), {
        event: "ranking.page_viewed",
        properties: {
            serverId: "01J8W7NPV2DM3XR48JAYB1RDFK",
            managedServerCount: 1,
            language: "en",
        },
    });
});

test("analytics events are skipped without a session", async () => {
    let called = false;
    const sent = await sendAnalyticsEvent({
        apiBase: "https://peptide.chat/api",
        token: "",
        event: "ranking.page_viewed",
        properties: {},
        fetchImpl: async () => {
            called = true;
            return { ok: true };
        },
    });

    assert.equal(sent, false);
    assert.equal(called, false);
});
