import { API } from "revolt.js";

import styles from "./Attachment.module.scss";
import classNames from "classnames";
import { useState } from "preact/hooks";

import { useTranslation } from "../../../../lib/i18n";

import { useClient } from "../../../../controllers/client/ClientController";
import { modalController } from "../../../../controllers/modals/ModalController";

enum ImageLoadingState {
    Loading,
    Loaded,
    Error,
}

type Props = JSX.HTMLAttributes<HTMLImageElement> & {
    attachment: API.File;
    gallery?: API.File[];
    position?: number;
};

export default function ImageFile({
    attachment,
    gallery,
    position,
    ...props
}: Props) {
    const [loading, setLoading] = useState(ImageLoadingState.Loading);
    const [attempt, setAttempt] = useState(0);
    const client = useClient();
    const translate = useTranslation();

    // Sized for the chat box (2x the 400px display cap, for retina) —
    // the original upload can be many megabytes, so it arrives slowly,
    // paints progressively and its decode stalls the scroller. GIFs pass
    // through unresized so they keep animating; the image viewer and
    // middle-click still get the original.
    const url = client.generateFileURL(attachment, { max_side: 800 }, true)!;
    const original = client.generateFileURL(attachment)!;
    const total = gallery?.length ?? 1;
    const index = position ?? 0;
    const openLabel = translate("app.main.channel.media.open_image", {
        filename: attachment.filename,
        index: String(index + 1),
        total: String(total),
    });
    const retryLabel = `${translate(
        "app.main.channel.media.image_unavailable",
    )}. ${translate("app.main.channel.media.retry")}`;

    const activate = () => {
        if (loading === ImageLoadingState.Error) {
            setLoading(ImageLoadingState.Loading);
            setAttempt((value) => value + 1);
            return;
        }

        modalController.push({
            type: "image_viewer",
            attachment,
            attachments: gallery,
        });
    };

    return (
        <button
            type="button"
            className={styles.imageButton}
            aria-label={
                loading === ImageLoadingState.Error ? retryLabel : openLabel
            }
            onClick={activate}
            onMouseDown={(event) => {
                if (event.button === 1) {
                    event.preventDefault();
                    window.open(original, "_blank", "noopener,noreferrer");
                }
            }}>
            {loading !== ImageLoadingState.Loaded && (
                <div className={styles.imagePlaceholder} />
            )}
            {loading === ImageLoadingState.Error && (
                <span className={styles.imageError} role="status">
                    <span aria-hidden="true">{"!"}</span>
                    {translate("app.main.channel.media.image_unavailable")}{" "}
                    {"·"} {translate("app.main.channel.media.retry")}
                </span>
            )}
            <img
                key={attempt}
                {...props}
                src={url}
                alt={attachment.filename}
                loading="lazy"
                decoding="async"
                className={classNames(styles.image, {
                    [styles.loading]: loading !== ImageLoadingState.Loaded,
                })}
                onLoad={() => setLoading(ImageLoadingState.Loaded)}
                onError={() => setLoading(ImageLoadingState.Error)}
            />
        </button>
    );
}
