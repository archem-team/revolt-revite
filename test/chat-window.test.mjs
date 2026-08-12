import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getRetryAfterMs, retrySeconds } from "../src/lib/chatSendFailure.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("chat media follows the iOS gallery and viewport contract", async () => {
    const [message, gallery, galleryStyles, embed, embedMedia] =
        await Promise.all([
            read("src/components/common/messaging/Message.tsx"),
            read(
                "src/components/common/messaging/attachments/ImageGallery.tsx",
            ),
            read(
                "src/components/common/messaging/attachments/ImageGallery.module.scss",
            ),
            read("src/components/common/messaging/embed/Embed.tsx"),
            read("src/components/common/messaging/embed/EmbedMedia.tsx"),
        ]);

    assert.match(message, /<ImageGallery attachments=\{imageAttachments\}/);
    assert.match(gallery, /attachments\.length === 3/);
    assert.match(galleryStyles, /grid-template-columns: repeat\(2/);
    assert.match(galleryStyles, /\.three \.tile:first-child/);
    assert.match(galleryStyles, /grid-row: span 2/);
    assert.match(embed, /const MAX_EMBED_HEIGHT = 300/);
    assert.match(embedMedia, /if \(!active \|\| failed\)/);
    assert.match(embedMedia, /<Player[\s\S]*label="YouTube player"/);
    assert.doesNotMatch(embedMedia, /case "YouTube"[\s\S]{0,400}<iframe/);
});

test("rate limits expose accurate retry countdowns", () => {
    const now = Date.parse("2026-08-12T12:00:00Z");

    assert.equal(
        getRetryAfterMs({ response: { headers: { "retry-after": "7" } } }, now),
        7000,
    );
    assert.equal(
        getRetryAfterMs(
            {
                response: {
                    headers: {
                        "retry-after": "Wed, 12 Aug 2026 12:00:09 GMT",
                    },
                },
            },
            now,
        ),
        9000,
    );
    assert.equal(
        getRetryAfterMs({ response: { data: { retry_after: 2.5 } } }, now),
        2500,
    );
    assert.equal(retrySeconds(now + 2100, now), 3);
    assert.equal(retrySeconds(now - 1, now), 0);
});

test("failed images provide an explicit retry state", async () => {
    const image = await read(
        "src/components/common/messaging/attachments/ImageFile.tsx",
    );

    assert.match(image, /ImageLoadingState\.Error/);
    assert.match(image, /Image unavailable · Retry/);
    assert.match(image, /setAttempt\(\(value\) => value \+ 1\)/);
});
