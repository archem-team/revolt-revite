import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("notification center excludes direct-message targets at every ingestion path", async () => {
    const [types, store, page] = await Promise.all([
        read("src/types/notifications.ts"),
        read("src/mobx/stores/NotificationCenter.ts"),
        read("src/pages/notifications/NotificationCenter.tsx"),
    ]);

    assert.match(types, /target\.type === "channel" \|\| target\.type === "channel_message"/);
    assert.match(types, /return Boolean\(target\.server_id\)/);
    assert.match(store, /page\.items\.filter\(isNotificationItemSupported\)/);
    assert.match(store, /if \(!isNotificationItemSupported\(packet\.item\)\) break/);
    assert.match(page, /if \(!isNotificationTargetSupported\(target\)\) return undefined/);
    assert.doesNotMatch(page, /`\/channel\/\$\{target\.channel_id\}/);
});
