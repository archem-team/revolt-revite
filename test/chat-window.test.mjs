import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getRetryAfterMs, retrySeconds } from "../src/lib/chatSendFailure.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("chat media stays within a bounded viewport contract", async () => {
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
    assert.match(message, /const MAX_INLINE_EMBEDS = 1/);
    assert.match(message, /embeds\.slice\(0, MAX_INLINE_EMBEDS\)/);
    assert.match(message, /show_more_previews/);
    assert.match(gallery, /attachments\.length === 3/);
    assert.match(gallery, /attachments\.slice\(0, 4\)/);
    assert.match(gallery, /hiddenCount/);
    assert.match(galleryStyles, /grid-template-columns: repeat\(2/);
    assert.match(galleryStyles, /\.three \.tile:first-child/);
    assert.match(galleryStyles, /grid-row: span 2/);
    assert.match(galleryStyles, /\.more/);
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
    assert.match(image, /media\.image_unavailable/);
    assert.match(image, /media\.retry/);
    assert.match(image, /setAttempt\(\(value\) => value \+ 1\)/);
    assert.match(image, /<button[\s\S]*className=\{styles\.imageButton\}/);
    assert.match(image, /aria-label=/);
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
    assert.match(viewer, /role="dialog"/);
    assert.match(viewer, /aria-modal="true"/);
    assert.match(viewer, /FOCUSABLE/);
    assert.match(viewer, /setAttribute\("inert"/);
    assert.match(viewer, /closeRef\.current\?\.focus/);
    assert.match(viewer, /media\.previous_image/);
    assert.match(viewer, /media\.next_image/);
    assert.match(viewer, /media\.close_viewer/);
    assert.match(viewer, /disabled=\{!hasPrevious\}/);
    assert.match(viewer, /disabled=\{!hasNext\}/);
    assert.match(viewer, /\{currentIndex \+ 1\}[\s\S]*\{"\/"\}/);
    assert.match(viewer, /max_side: 1600/);
    assert.match(viewer, /original\.onload/);
    assert.match(viewer, /media\.failed_image/);
});

test("Telegram embeds stay compact and metadata-only cards are suppressed", async () => {
    const [embed, styles] = await Promise.all([
        read("src/components/common/messaging/embed/Embed.tsx"),
        read("src/components/common/messaging/embed/Embed.module.scss"),
    ]);

    assert.match(embed, /function telegramHandle/);
    assert.match(embed, /export function isRenderableEmbed/);
    assert.match(embed, /styles\.telegram/);
    assert.match(embed, /if \(!isRenderableEmbed\(embed\)\) return null/);
    assert.doesNotMatch(styles, /\.telegram[\s\S]*border-inline-start-width/);
    assert.match(styles, /\.telegramIcon[\s\S]*width: 48px/);
    assert.match(styles, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
});

test("chat interactions use semantic controls and accessible names", async () => {
    const [
        attachments,
        reactions,
        editor,
        code,
        composer,
        embed,
        embedActions,
    ] = await Promise.all([
        read(
            "src/components/common/messaging/attachments/AttachmentActions.tsx",
        ),
        read("src/components/common/messaging/attachments/Reactions.tsx"),
        read("src/pages/channels/messaging/MessageEditor.tsx"),
        read("src/components/markdown/plugins/Codeblock.tsx"),
        read("src/components/common/messaging/MessageBox.tsx"),
        read("src/components/common/messaging/embed/Embed.tsx"),
        read("src/components/common/messaging/embed/EmbedMediaActions.tsx"),
    ]);

    assert.match(attachments, /media\.open_attachment/);
    assert.match(attachments, /media\.download_attachment/);
    assert.doesNotMatch(attachments, /<a[\s\S]{0,300}<IconButton/);
    assert.match(reactions, /const Reaction = styled\.button/);
    assert.match(reactions, /const ReactionTrigger = styled\.button/);
    assert.match(reactions, /aria-pressed=\{active\}/);
    assert.match(editor, /<button[\s\S]*editor\.cancel/);
    assert.match(editor, /<button[\s\S]*editor\.save/);
    assert.match(code, /<button[\s\S]*accessibility\.copy_code/);
    assert.match(composer, /accessibility\.open_emoji_picker/);
    assert.match(composer, /accessibility\.send_message/);
    assert.match(embed, /href=\{embed\.url \?\? undefined\}/);
    assert.match(
        embed,
        /className=\{classNames\(styles\.embed, styles\.imageButton\)\}/,
    );
    assert.match(embedActions, /media\.open_attachment/);
});

test("compact channel routes are brought into view after responsive layout", async () => {
    const [app, channel, tokens, document, errorBoundary, home, compactPanels] =
        await Promise.all([
            read("src/pages/RevoltApp.tsx"),
            read("src/pages/channels/Channel.tsx"),
            read("src/styles/tokens.css"),
            read("index.html"),
            read("src/lib/ErrorBoundary.tsx"),
            read("src/pages/home/Home.tsx"),
            read("src/lib/compactPanels.ts"),
        ]);

    assert.match(app, /const COMPACT_LAYOUT_QUERY = "\(max-width: 960px\)"/);
    assert.match(app, /return keepRoutesPanelInView\(\)/);
    assert.match(app, /\[compactLayout, inChannel, inServer, path\]/);
    assert.match(channel, /@media \(max-width: 960px\)[\s\S]*\.searchArea/);
    assert.match(
        channel,
        /@media \(max-width: 960px\) \{[\s\S]*display: none;/,
    );
    assert.match(tokens, /html,[\s\S]*body \{[\s\S]*overflow-x: clip/);
    assert.match(document, /unhandledrejection/);
    assert.match(document, /dynamically imported module/);
    assert.match(document, /app && !app\.firstElementChild/);
    assert.match(document, /id="boot-recovery"/);
    assert.match(document, /Clear cache and refresh/);
    assert.match(document, /window\.__pepchatRecoverBoot/);
    assert.match(errorBoundary, /isDynamicImportFailure\(error\)/);
    assert.match(errorBoundary, /__pepchatRecoverBoot/);
    assert.match(home, /return keepRoutesPanelInView\(\)/);
    assert.match(home, /if \(!(?:compactLayout|isCompact)\) return;/);
    assert.doesNotMatch(home, /tab !== ["']promos["']/);
    assert.match(compactPanels, /POSITION_DELAYS_MS/);
    assert.match(compactPanels, /routes\.scrollIntoView/);
    assert.match(compactPanels, /panels\.scrollLeft = routes\.offsetLeft/);
    assert.match(compactPanels, /window\.addEventListener\("pageshow"/);
    assert.match(compactPanels, /document\.addEventListener\("touchstart"/);
});

test("root route preserves authenticated and signed-out entry flows", async () => {
    const app = await read("src/pages/app.tsx");

    assert.match(
        app,
        /<Route path="\/">[\s\S]*<CheckAuth auth blockRender>[\s\S]*<RevoltApp \/>/,
    );
    assert.match(
        app,
        /<Route path="\/">[\s\S]*<CheckAuth blockRender>[\s\S]*<Login \/>/,
    );
});

test("new chat-window copy is sourced from the locale dictionary", async () => {
    const dictionary = JSON.parse(await read("src/context/chatLocale.en.json"));
    const channel = dictionary.app.main.channel;

    assert.equal(channel.media.previous_image, "Previous image");
    assert.equal(channel.media.show_more_previews.includes("{{count}}"), true);
    assert.equal(channel.accessibility.open_emoji_picker, "Open emoji picker");
    assert.equal(channel.send_status.not_sent, "Message not sent");
    assert.equal(channel.editor.save, "Save edit");
});

test("message Markdown follows stable GFM layout and mobile overflow rules", async () => {
    const [renderer, codeblock] = await Promise.all([
        read("src/components/markdown/RemarkRenderer.tsx"),
        read("src/components/markdown/plugins/Codeblock.tsx"),
    ]);

    assert.match(renderer, /\.use\(remarkGfm\)/);
    assert.match(renderer, /overflow-wrap: anywhere/);
    assert.match(renderer, /display: block;[\s\S]*overflow-x: auto;/);
    assert.match(renderer, /padding-inline-start: 1\.5em/);
    assert.match(renderer, /> \* \+ \*/);
    assert.match(renderer, /focus-visible/);
    assert.doesNotMatch(renderer, /RE_EMPTY_LINE/);
    assert.doesNotMatch(renderer, /RE_BLOCKQUOTE/);
    assert.doesNotMatch(renderer, /RE_PLUS/);
    assert.match(codeblock, /max-width: 100%/);
    assert.match(codeblock, /overflow-x: auto/);
    assert.match(codeblock, /white-space: pre/);
});
