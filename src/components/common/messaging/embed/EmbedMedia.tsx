/* eslint-disable react-hooks/rules-of-hooks */
import { API } from "revolt.js";

import styles from "./Embed.module.scss";
import { useState } from "preact/hooks";

import { useClient } from "../../../../controllers/client/ClientController";
import { modalController } from "../../../../controllers/modals/ModalController";

interface Props {
    embed: API.Embed;
    width?: number;
    height: number;
}

interface PlayerProps {
    embed: Extract<API.Embed, { type: "Website" }>;
    height: number;
    label: string;
    src: string;
}

function Player({ embed, height, label, src }: PlayerProps) {
    const client = useClient();
    const [active, setActive] = useState(false);
    const [failed, setFailed] = useState(false);
    const preview = embed.image?.url;

    if (!active || failed) {
        return (
            <div className={styles.playerGate} style={{ height }}>
                {preview && (
                    <img
                        src={client.proxyFile(preview)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                    />
                )}
                <div className={styles.playerGateActions}>
                    <button
                        type="button"
                        onClick={() => {
                            setFailed(false);
                            setActive(true);
                        }}>
                        <span className={styles.playIcon} aria-hidden="true" />
                        {failed ? `Retry ${label}` : `Load ${label}`}
                    </button>
                    {embed.url && (
                        <button
                            type="button"
                            className={styles.playerLink}
                            onClick={() =>
                                modalController.openLink(
                                    embed.url!,
                                    undefined,
                                    true,
                                )
                            }>
                            {"Open original"}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.playerFrame} style={{ height }}>
            <iframe
                src={src}
                title={label}
                allowFullScreen
                onError={() => setFailed(true)}
            />
            {embed.url && (
                <button
                    type="button"
                    className={styles.playerFallback}
                    onClick={() =>
                        modalController.openLink(embed.url!, undefined, true)
                    }>
                    {"Open original"}
                </button>
            )}
        </div>
    );
}

export default function EmbedMedia({ embed, width, height }: Props) {
    if (embed.type !== "Website") return null;
    const client = useClient();

    switch (embed.special?.type) {
        case "YouTube": {
            let timestamp = "";

            if (embed.special.timestamp) {
                timestamp = `&start=${embed.special.timestamp}`;
            }

            return (
                <Player
                    embed={embed}
                    height={height}
                    label="YouTube player"
                    src={`https://www.youtube-nocookie.com/embed/${embed.special.id}?modestbranding=1${timestamp}`}
                />
            );
        }
        case "Twitch":
            return (
                <Player
                    embed={embed}
                    height={height}
                    label="Twitch player"
                    src={`https://player.twitch.tv/?${embed.special.content_type.toLowerCase()}=${
                        embed.special.id
                    }&parent=${window.location.hostname}&autoplay=false`}
                />
            );
        case "Lightspeed":
            return (
                <Player
                    embed={embed}
                    height={height}
                    label="Lightspeed player"
                    src={`https://new.lightspeed.tv/embed/${embed.special.id}/stream`}
                />
            );
        case "Spotify":
            return (
                <Player
                    embed={embed}
                    height={height}
                    label="Spotify player"
                    src={`https://open.spotify.com/embed/${embed.special.content_type}/${embed.special.id}`}
                />
            );
        case "Soundcloud":
            return (
                <Player
                    embed={embed}
                    height={height}
                    label="SoundCloud player"
                    src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
                        embed.url!,
                    )}&color=%23FF7F50&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`}
                />
            );
        case "Bandcamp": {
            return (
                <Player
                    embed={embed}
                    height={height}
                    label="Bandcamp player"
                    src={`https://bandcamp.com/EmbeddedPlayer/${embed.special.content_type.toLowerCase()}=${
                        embed.special.id
                    }/size=large/bgcol=181a1b/linkcol=056cc4/tracklist=false/transparent=true/`}
                />
            );
        }
        case "Streamable": {
            return (
                <Player
                    embed={embed}
                    height={height}
                    label="Streamable player"
                    src={`https://streamable.com/e/${embed.special.id}?loop=0`}
                />
            );
        }
        default: {
            if (embed.video) {
                const url = embed.video.url;
                return (
                    <video
                        className={styles.image}
                        style={{ width, height }}
                        src={client.proxyFile(url)}
                        preload="metadata"
                        loop={embed.special?.type === "GIF"}
                        controls={embed.special?.type !== "GIF"}
                        autoPlay={embed.special?.type === "GIF"}
                        muted={embed.special?.type === "GIF" ? true : undefined}
                    />
                );
            } else if (embed.image) {
                const url = embed.image.url;
                // Explicit metadata-derived box: the image must occupy its
                // final size BEFORE it loads, or history paging shifts the
                // scroller on every image load.
                const sized =
                    Number.isFinite(height) &&
                    height > 0 &&
                    (width === undefined ||
                        (Number.isFinite(width) && width! > 0));
                return (
                    <img
                        className={styles.image}
                        src={client.proxyFile(url)}
                        loading="lazy"
                        decoding="async"
                        style={
                            sized
                                ? {
                                      width: width ?? "100%",
                                      height,
                                      objectFit: "contain",
                                  }
                                : { width: "100%", height: "100%" }
                        }
                        onClick={() =>
                            modalController.push({
                                type: "image_viewer",
                                embed: embed.image!,
                            })
                        }
                        onMouseDown={(ev) =>
                            ev.button === 1 && window.open(url, "_blank")
                        }
                    />
                );
            }
        }
    }

    return null;
}
