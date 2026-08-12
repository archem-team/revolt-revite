import { API } from "revolt.js";

import styles from "./ImageGallery.module.scss";
import classNames from "classnames";
import { useTriggerEvents } from "preact-context-menu";

import ImageFile from "./ImageFile";

interface Props {
    attachments: API.File[];
}

function GalleryTile({
    attachment,
    attachments,
}: {
    attachment: API.File;
    attachments: API.File[];
}) {
    const triggerEvents = useTriggerEvents("Menu", { attachment });
    if (attachment.metadata.type !== "Image") return null;

    return (
        <div className={styles.tile} {...triggerEvents}>
            <ImageFile
                attachment={attachment}
                gallery={attachments}
                width={attachment.metadata.width}
                height={attachment.metadata.height}
            />
        </div>
    );
}

/** Mirrors Zeko iOS: two square columns, with a tall leading tile for three. */
export default function ImageGallery({ attachments }: Props) {
    return (
        <div
            className={classNames(styles.gallery, {
                [styles.three]: attachments.length === 3,
            })}
            role="group"
            aria-label={`${attachments.length} image attachments`}>
            {attachments.map((attachment) => (
                <GalleryTile
                    key={attachment._id}
                    attachment={attachment}
                    attachments={attachments}
                />
            ))}
        </div>
    );
}
