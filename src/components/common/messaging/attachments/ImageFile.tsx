import { API } from "revolt.js";

import styles from "./Attachment.module.scss";
import classNames from "classnames";
import { useState } from "preact/hooks";

import { useClient } from "../../../../controllers/client/ClientController";
import { modalController } from "../../../../controllers/modals/ModalController";

enum ImageLoadingState {
    Loading,
    Loaded,
    Error,
}

type Props = JSX.HTMLAttributes<HTMLImageElement> & {
    attachment: API.File;
};

export default function ImageFile({ attachment, ...props }: Props) {
    const [loading, setLoading] = useState(ImageLoadingState.Loading);
    const [attempt, setAttempt] = useState(0);
    const client = useClient();

    // Sized for the chat box (2x the 400px display cap, for retina) —
    // the original upload can be many megabytes, so it arrives slowly,
    // paints progressively and its decode stalls the scroller. GIFs pass
    // through unresized so they keep animating; the image viewer and
    // middle-click still get the original.
    const url = client.generateFileURL(attachment, { max_side: 800 }, true)!;
    const original = client.generateFileURL(attachment)!;

    return (
        <>
            {loading !== ImageLoadingState.Loaded && (
                <div className={styles.imagePlaceholder} />
            )}
            {loading === ImageLoadingState.Error && (
                <button
                    type="button"
                    className={styles.imageError}
                    onClick={() => {
                        setLoading(ImageLoadingState.Loading);
                        setAttempt((value) => value + 1);
                    }}>
                    <span aria-hidden="true">{"!"}</span>
                    {"Image unavailable · Retry"}
                </button>
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
                onClick={() =>
                    modalController.push({ type: "image_viewer", attachment })
                }
                onMouseDown={(ev) =>
                    ev.button === 1 && window.open(original, "_blank")
                }
                onLoad={() => setLoading(ImageLoadingState.Loaded)}
                onError={() => setLoading(ImageLoadingState.Error)}
            />
        </>
    );
}
