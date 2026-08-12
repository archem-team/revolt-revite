import { ChevronRight } from "@styled-icons/boxicons-regular";
import { API } from "revolt.js";

import styles from "./Embed.module.scss";
import classNames from "classnames";
import { useContext } from "preact/hooks";

import { useClient } from "../../../../controllers/client/ClientController";
import { modalController } from "../../../../controllers/modals/ModalController";
import { MessageAreaWidthContext } from "../../../../pages/channels/messaging/MessageArea";
import Markdown from "../../../markdown/Markdown";
import Attachment from "../attachments/Attachment";
import EmbedMedia from "./EmbedMedia";

interface Props {
    embed: API.Embed;
}

const MAX_EMBED_WIDTH = 400;
// Match the iOS preview ceiling so one rich preview cannot become the chat.
const MAX_EMBED_HEIGHT = 300;
const CONTAINER_PADDING = 24;
const MAX_PREVIEW_SIZE = 150;

function telegramHandle(url?: string | null) {
    if (!url) return;

    try {
        const parsed = new URL(url);
        if (!["t.me", "telegram.me"].includes(parsed.hostname)) return;

        const handle = parsed.pathname.split("/").filter(Boolean)[0];
        return handle ? `@${handle}` : undefined;
    } catch {
        return;
    }
}

export default function Embed({ embed }: Props) {
    const client = useClient();

    const maxWidth = Math.min(
        useContext(MessageAreaWidthContext) - CONTAINER_PADDING,
        MAX_EMBED_WIDTH,
    );

    function calculateSize(
        w: number,
        h: number,
    ): { width: number; height: number } {
        const safeWidth = Number.isFinite(w) && w > 0 ? w : 16;
        const safeHeight = Number.isFinite(h) && h > 0 ? h : 9;
        const limitingWidth = Math.min(maxWidth, safeWidth);

        const limitingHeight = Math.min(MAX_EMBED_HEIGHT, safeHeight);

        // Calculate smallest possible WxH.
        const width = Math.min(
            limitingWidth,
            limitingHeight * (safeWidth / safeHeight),
        );

        const height = Math.min(
            limitingHeight,
            limitingWidth * (safeHeight / safeWidth),
        );

        return { width, height };
    }

    switch (embed.type) {
        case "Text":
        case "Website": {
            // Determine special embed size.
            let mw, mh;
            const largeMedia =
                embed.type === "Text"
                    ? typeof embed.media !== "undefined"
                    : (embed.special && embed.special.type !== "None") ||
                      embed.image?.size === "Large";

            if (embed.type === "Text") {
                mw = MAX_EMBED_WIDTH;
                mh = 1;
            } else {
                switch (embed.special?.type) {
                    case "YouTube":
                    case "Bandcamp": {
                        mw = embed.video?.width ?? 1280;
                        mh = embed.video?.height ?? 720;
                        break;
                    }
                    case "Twitch":
                    case "Lightspeed":
                    case "Streamable": {
                        mw = 1280;
                        mh = 720;
                        break;
                    }
                    default: {
                        if (embed.image?.size === "Preview") {
                            mw = MAX_EMBED_WIDTH;
                            mh = Math.min(
                                embed.image.height ?? 0,
                                MAX_PREVIEW_SIZE,
                            );
                        } else {
                            mw = embed.image?.width ?? MAX_EMBED_WIDTH;
                            mh = embed.image?.height ?? 0;
                        }
                    }
                }
            }

            const { width, height } = calculateSize(mw, mh);
            if (embed.type === "Website" && embed.special?.type === "GIF") {
                return (
                    <EmbedMedia
                        embed={embed}
                        width={
                            height *
                            ((embed.image?.width ?? 0) /
                                (embed.image?.height ?? 0))
                        }
                        height={height}
                    />
                );
            }

            if (embed.type === "Website") {
                const handle = telegramHandle(embed.url);
                if (handle) {
                    const imageUrl = embed.image?.url ?? embed.icon_url;
                    return (
                        <button
                            type="button"
                            className={classNames(
                                styles.embed,
                                styles.telegram,
                            )}
                            onClick={() =>
                                modalController.openLink(
                                    embed.url!,
                                    undefined,
                                    true,
                                )
                            }>
                            <span
                                className={styles.telegramIcon}
                                aria-hidden="true">
                                {imageUrl && (
                                    <img
                                        src={client.proxyFile(imageUrl)}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        onError={(event) =>
                                            (event.currentTarget.style.display =
                                                "none")
                                        }
                                    />
                                )}
                            </span>
                            <span className={styles.telegramContent}>
                                <span className={styles.telegramSite}>
                                    {"Telegram"}
                                </span>
                                <strong className={styles.telegramTitle}>
                                    {embed.title ?? handle}
                                </strong>
                                <span className={styles.telegramHandle}>
                                    {handle}
                                </span>
                            </span>
                            <ChevronRight
                                className={styles.telegramArrow}
                                size={22}
                                aria-hidden="true"
                            />
                        </button>
                    );
                }

                const hasMeaningfulPreview = Boolean(
                    embed.site_name ||
                        embed.title ||
                        embed.image ||
                        embed.video ||
                        (embed.special && embed.special.type !== "None"),
                );
                if (!hasMeaningfulPreview) return null;
            }

            return (
                <div
                    className={classNames(styles.embed, styles.website)}
                    style={{
                        borderInlineStartColor:
                            embed.colour ?? "var(--scrollbar-thumb)",
                        width:
                            Number.isFinite(width) && width > 0
                                ? width + CONTAINER_PADDING
                                : undefined,
                    }}>
                    <div>
                        {(embed.type === "Text"
                            ? embed.title
                            : embed.site_name) && (
                            <div className={styles.siteinfo}>
                                {embed.icon_url && (
                                    <img
                                        loading="lazy"
                                        className={styles.favicon}
                                        src={client.proxyFile(embed.icon_url)}
                                        draggable={false}
                                        onError={(e) =>
                                            (e.currentTarget.style.display =
                                                "none")
                                        }
                                    />
                                )}
                                <div className={styles.site}>
                                    {embed.type === "Text"
                                        ? embed.title
                                        : embed.site_name}{" "}
                                </div>
                            </div>
                        )}

                        {/*<span><a href={embed.url} target={"_blank"} className={styles.author}>Author</a></span>*/}
                        {embed.type === "Website" && embed.title && (
                            <span>
                                <a
                                    onMouseDown={(ev) =>
                                        (ev.button === 0 || ev.button === 1) &&
                                        modalController.openLink(
                                            embed.url!,
                                            undefined,
                                            true,
                                        )
                                    }
                                    className={styles.title}>
                                    {embed.title}
                                </a>
                            </span>
                        )}
                        {embed.description &&
                            (embed.type === "Text" ? (
                                <Markdown content={embed.description} />
                            ) : (
                                <div className={styles.description}>
                                    {embed.description}
                                </div>
                            ))}

                        {largeMedia &&
                            (embed.type === "Text" ? (
                                <Attachment attachment={embed.media!} />
                            ) : (
                                <EmbedMedia
                                    embed={embed}
                                    width={width}
                                    height={height}
                                />
                            ))}
                    </div>
                    {!largeMedia && embed.type === "Website" && embed.image && (
                        <div>
                            <EmbedMedia
                                embed={embed}
                                width={
                                    height *
                                    ((embed.image?.width ?? 0) /
                                        (embed.image?.height ?? 0))
                                }
                                height={height}
                            />
                        </div>
                    )}
                </div>
            );
        }
        case "Image": {
            return (
                <img
                    className={classNames(styles.embed, styles.image)}
                    style={calculateSize(embed.width, embed.height)}
                    src={client.proxyFile(embed.url)}
                    type="text/html"
                    frameBorder="0"
                    loading="lazy"
                    onClick={() =>
                        modalController.push({ type: "image_viewer", embed })
                    }
                    onMouseDown={(ev) =>
                        ev.button === 1 &&
                        modalController.openLink(embed.url, undefined, true)
                    }
                />
            );
        }
        case "Video": {
            return (
                <video
                    className={classNames(styles.embed, styles.image)}
                    style={calculateSize(embed.width, embed.height)}
                    src={client.proxyFile(embed.url)}
                    frameBorder="0"
                    loading="lazy"
                    controls
                />
            );
        }
        default:
            return null;
    }
}
