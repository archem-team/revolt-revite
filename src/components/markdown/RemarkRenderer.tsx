import "katex/dist/katex.min.css";
import rehypePrism from "rehype-prism";
import rehypeReact from "rehype-react";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import styled, { css } from "styled-components";
import { unified } from "unified";

import { createElement } from "preact";
import { memo } from "preact/compat";
import { useLayoutEffect, useMemo, useState } from "preact/hooks";

// @ts-expect-error no typings
import rehypeKatex from "@revoltchat/rehype-katex";

import { MarkdownProps } from "./Markdown";
import { handlers } from "./hast";
import { RenderCodeblock } from "./plugins/Codeblock";
import { RenderAnchor } from "./plugins/anchors";
import { remarkChannels, RenderChannel } from "./plugins/channels";
import {
    isOnlyEmoji,
    remarkEmoji,
    remarkUnicodeEmoji,
    RenderEmoji,
    RenderUnicodeEmoji,
} from "./plugins/emoji";
import { remarkHtmlToText } from "./plugins/htmlToText";
import {
    remarkMention,
    RenderMention,
    remarkEveryone,
    RenderEveryoneMention,
    remarkRoleMention,
    RenderRoleMention,
} from "./plugins/mentions";
import { remarkSpoiler, RenderSpoiler } from "./plugins/spoiler";
import { remarkTimestamps } from "./plugins/timestamps";
import "./prism";

/**
 * Null element
 */
const Null: React.FC = () => null;

/**
 * Custom Markdown components
 */
const components = {
    emoji: RenderEmoji,
    uemoji: RenderUnicodeEmoji,
    mention: RenderMention,
    everyone: RenderEveryoneMention,
    rolemention: RenderRoleMention,
    spoiler: RenderSpoiler,
    channel: RenderChannel,
    a: RenderAnchor,
    p: styled.p`
        margin: 0;

        > code {
            padding: 0.1em 0.35em;
        }
    `,
    h1: styled.h1`
        margin: 0;
        font-size: 1.4em;
        line-height: 1.25;
    `,
    h2: styled.h2`
        margin: 0;
        font-size: 1.3em;
        line-height: 1.3;
    `,
    h3: styled.h3`
        margin: 0;
        font-size: 1.2em;
        line-height: 1.35;
    `,
    h4: styled.h4`
        margin: 0;
        font-size: 1.1em;
        line-height: 1.4;
    `,
    h5: styled.h5`
        margin: 0;
        font-size: 1em;
        line-height: 1.4;
    `,
    h6: styled.h6`
        margin: 0;
        color: var(--tertiary-foreground);
        font-size: 1em;
        line-height: 1.4;
    `,
    pre: RenderCodeblock,
    code: styled.code`
        color: var(--foreground);
        background: var(--block);

        font-size: 90%;
        font-family: var(--monospace-font), monospace;

        border-radius: 3px;
        box-decoration-break: clone;
        overflow-wrap: anywhere;
    `,
    table: styled.table`
        display: block;
        max-width: 100%;
        overflow-x: auto;
        border-collapse: collapse;

        th,
        td {
            min-width: 7em;
            padding: 0.4em 0.6em;
            border: 1px solid var(--tertiary-background);
            text-align: start;
            vertical-align: top;
        }

        th {
            background: var(--hover);
        }
    `,
    ul: styled.ul`
        padding-inline-start: 1.5em;
        margin: 0;
    `,
    ol: styled.ol`
        padding-inline-start: 1.5em;
        margin: 0;
    `,
    li: styled.li<{ class?: string }>`
        padding-inline-start: 0.15em;

        & + & {
            margin-top: 0.15em;
        }

        > ul,
        > ol {
            margin-top: 0.15em;
        }

        ${(props) =>
            props.class === "task-list-item" &&
            css`
                list-style-type: none;

                > input[type="checkbox"] {
                    margin: 0 0.45em 0 -1.35em;
                    vertical-align: -0.05em;
                }
            `}
    `,
    blockquote: styled.blockquote`
        margin: 0;
        padding: 0.1em 0 0.1em 0.75em;
        color: var(--tertiary-foreground);
        border-inline-start: 3px solid var(--tertiary-background);

        > * {
            margin: 0;
        }
    `,
    // Block image elements
    img: Null,
    // Catch literally everything else just in case
    video: Null,
    figure: Null,
    picture: Null,
    source: Null,
    audio: Null,
    script: Null,
    style: Null,
};

/**
 * Unified Markdown renderer
 */
const render = unified()
    .use(remarkParse)
    .use(remarkBreaks)
    .use(remarkGfm)
    .use(remarkMath, {
        singleDollarTextMath: false,
    })
    .use(remarkSpoiler)
    .use(remarkChannels)
    .use(remarkTimestamps)
    .use(remarkEmoji)
    .use(remarkUnicodeEmoji)
    .use(remarkMention)
    .use(remarkRoleMention)
    .use(remarkEveryone)
    .use(remarkHtmlToText)
    .use(remarkRehype, {
        handlers,
    })
    .use(rehypeKatex, {
        maxSize: 10,
        maxExpand: 0,
        maxLength: 512,
        trust: false,
        strict: false,
        output: "html",
        throwOnError: false,
        errorColor: "var(--error)",
    })
    .use(rehypePrism)
    // @ts-expect-error typings do not
    // match between Preact and React
    .use(rehypeReact, {
        createElement,
        Fragment,
        components,
    });

/**
 * Markdown parent container
 */
const Container = styled.div<{ largeEmoji: boolean }>`
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;

    > * + * {
        margin-top: 0.65em;
    }

    > :is(h1, h2, h3, h4, h5, h6) + * {
        margin-top: 0.3em;
    }

    > * + :is(h1, h2, h3, h4, h5, h6) {
        margin-top: 0.85em;
    }

    hr {
        height: 1px;
        margin-inline: 0;
        border: 0;
        background: var(--tertiary-background);
    }

    // Allow scrolling block math
    .math-display {
        max-width: 100%;
        overflow-x: auto;
    }

    // Set emoji size
    --emoji-size: ${(props) => (props.largeEmoji ? "3em" : "1.25em")};

    a {
        overflow-wrap: anywhere;

        &:hover {
            text-decoration: underline;
        }

        &:focus-visible {
            border-radius: 2px;
            outline: 2px solid var(--focus-ring);
            outline-offset: 2px;
        }
    }
`;

/**
 * Regex for matching execessive recursion of blockquotes and lists
 */
const RE_RECURSIVE = /(^(?:[>*+-][^\S\r\n]*){5})(?:[>*+-][^\S\r\n]*)+(.*$)/gm;

/**
 * Regex for matching HTML tags
 */
const RE_HTML_TAGS = /^(<\/?[a-zA-Z0-9]+>)(.*$)/gm;

/**
 * Sanitise Markdown input before rendering
 * @param content Input string
 * @returns Sanitised string
 */
function sanitise(content: string) {
    return content
        .replace(RE_RECURSIVE, (_, m0, m1) => m0 + m1)
        .replace(RE_HTML_TAGS, (match) => `\u200E${match}`);
}

/**
 * Remark renderer component
 */
/** The pipeline has no async plugin, so it can run synchronously — a
 *  message then paints WITH its text on the first commit, instead of
 *  mounting empty and re-committing a microtask later (which cascaded
 *  into dozens of commits per history fetch). If a plugin ever turns
 *  async, processSync throws once and we fall back to the deferred
 *  path for the rest of the session. */
let pipelineIsSync = true;

export default memo(({ content, disallowBigEmoji }: MarkdownProps) => {
    const sanitisedContent = useMemo(() => sanitise(content), [content]);

    const syncContent = useMemo(() => {
        if (!pipelineIsSync) return null;
        try {
            return render.processSync(sanitisedContent)
                .result as React.ReactElement;
        } catch (err) {
            pipelineIsSync = false;
            return null;
        }
    }, [sanitisedContent]);

    const [asyncContent, setAsyncContent] = useState<React.ReactElement>(null!);

    useLayoutEffect(() => {
        if (syncContent) return;
        render
            .process(sanitisedContent)
            .then((file) => setAsyncContent(file.result));
    }, [sanitisedContent, syncContent]);

    const largeEmoji = useMemo(
        () => !disallowBigEmoji && isOnlyEmoji(content!),
        [content, disallowBigEmoji],
    );

    return (
        <Container largeEmoji={largeEmoji}>
            {syncContent ?? asyncContent}
        </Container>
    );
});
