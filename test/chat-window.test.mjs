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

test("enlarged message images navigate within their attachment gallery", async () => {
    const [image, gallery, viewer, modalTypes] = await Promise.all([
        read("src/components/common/messaging/attachments/ImageFile.tsx"),
        read("src/components/common/messaging/attachments/ImageGallery.tsx"),
        read("src/controllers/modals/components/ImageViewer.tsx"),
        read("src/controllers/modals/types.ts"),
    ]);

    assert.match(image, /attachments: gallery/);
    assert.match(gallery, /gallery=\{attachments\}/);
    assert.match(modalTypes, /attachments\?: API\.File\[\]/);
    assert.match(viewer, /event\.key === "ArrowLeft"/);
    assert.match(viewer, /event\.key === "ArrowRight"/);
    assert.match(viewer, /onTouchStart=/);
    assert.match(viewer, /onTouchEnd=/);
    assert.match(viewer, /aria-label="Previous image"/);
    assert.match(viewer, /aria-label="Next image"/);
    assert.match(viewer, /disabled=\{!hasPrevious\}/);
    assert.match(viewer, /disabled=\{!hasNext\}/);
    assert.match(
        viewer,
        /\{currentIndex \+ 1\}[\s\S]*\{"of"\}[\s\S]*\{gallery\.length\}/,
    );
});

test("Telegram embeds stay compact and metadata-only cards are suppressed", async () => {
    const [embed, styles] = await Promise.all([
        read("src/components/common/messaging/embed/Embed.tsx"),
        read("src/components/common/messaging/embed/Embed.module.scss"),
    ]);

    assert.match(embed, /function telegramHandle/);
    assert.match(embed, /styles\.telegram/);
    assert.match(embed, /if \(!hasMeaningfulPreview\) return null/);
    assert.doesNotMatch(styles, /\.telegram[\s\S]*border-inline-start-width/);
    assert.match(styles, /\.telegramIcon[\s\S]*width: 48px/);
    assert.match(styles, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
});
