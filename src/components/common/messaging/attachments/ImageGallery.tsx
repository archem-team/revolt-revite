import { API } from "revolt.js";

import styles from "./ImageGallery.module.scss";
import classNames from "classnames";
import { useTriggerEvents } from "preact-context-menu";

import { useTranslation } from "../../../../lib/i18n";

import ImageFile from "./ImageFile";

interface Props {
    attachments: API.File[];
}

function GalleryTile({
    attachment,
    attachments,
    position,
    hiddenCount,
}: {
    attachment: API.File;
    attachments: API.File[];
    position: number;
    hiddenCount: number;
}) {
    const triggerEvents = useTriggerEvents("Menu", { attachment });
    if (attachment.metadata.type !== "Image") return null;

    return (
        <div className={styles.tile} {...triggerEvents}>
            <ImageFile
                attachment={attachment}
                gallery={attachments}
                position={position}
                width={attachment.metadata.width}
                height={attachment.metadata.height}
            />
            {hiddenCount > 0 && (
                <span className={styles.more} aria-hidden="true">
                    {`+${hiddenCount}`}
                </span>
            )}
        </div>
    );
}

/** Mirrors Zeko iOS: two square columns, with a tall leading tile for three. */
export default function ImageGallery({ attachments }: Props) {
    const translate = useTranslation();
    const visibleAttachments = attachments.slice(0, 4);
    const hiddenCount = Math.max(
        0,
        attachments.length - visibleAttachments.length,
    );

    return (
        <div
            className={classNames(styles.gallery, {
                [styles.three]: attachments.length === 3,
            })}
            role="group"
            aria-label={translate("app.main.channel.media.gallery", {
                count: String(attachments.length),
            })}>
            {visibleAttachments.map((attachment, position) => (
                <GalleryTile
                    key={attachment._id}
                    attachment={attachment}
                    attachments={attachments}
                    position={position}
                    hiddenCount={
                        position === visibleAttachments.length - 1
                            ? hiddenCount
                            : 0
                    }
                />
            ))}
        </div>
    );
}
