import { LinkExternal } from "@styled-icons/boxicons-regular";
import { API } from "revolt.js";

import styles from "./Embed.module.scss";

import { useTranslation } from "../../../../lib/i18n";

interface Props {
    embed: API.Image;
}

export default function EmbedMediaActions({ embed }: Props) {
    const translate = useTranslation();
    const filename = embed.url.split("/").pop() ?? embed.url;

    return (
        <div className={styles.actions}>
            <span className={styles.filename}>{filename}</span>
            <span className={styles.filesize}>
                {`${embed.width}x${embed.height}`}
            </span>
            <a
                href={embed.url}
                className={styles.openIcon}
                aria-label={translate(
                    "app.main.channel.media.open_attachment",
                    { filename },
                )}
                target="_blank"
                rel="noreferrer">
                <LinkExternal size={24} aria-hidden="true" />
            </a>
        </div>
    );
}
