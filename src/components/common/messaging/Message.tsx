import { observer } from "mobx-react-lite";
import { Message as MessageObject } from "revolt.js";
import styled from "styled-components/macro";

import { useTriggerEvents } from "preact-context-menu";
import { memo } from "preact/compat";
import { useEffect, useState } from "preact/hooks";

import { Category } from "@revoltchat/ui";

import { getRetryAfterMs, retrySeconds } from "../../../lib/chatSendFailure";
import { internalEmit } from "../../../lib/eventEmitter";
import { isTouchscreenDevice } from "../../../lib/isTouchscreenDevice";

import { useApplicationState } from "../../../mobx/State";
import { QueuedMessage } from "../../../mobx/stores/MessageQueue";

import { I18nError } from "../../../context/Locale";

import { FILE_SERVER_ORIGIN } from "../../../config/branding";
import { takeError } from "../../../controllers/client/jsx/error";
import { modalController } from "../../../controllers/modals/ModalController";
import Markdown from "../../markdown/Markdown";
import UserIcon from "../user/UserIcon";
import { Username } from "../user/UserShort";
import MessageBase, {
    MessageContent,
    MessageDetail,
    MessageInfo,
} from "./MessageBase";
import Attachment from "./attachments/Attachment";
import ImageGallery from "./attachments/ImageGallery";
import { MessageReply } from "./attachments/MessageReply";
import { Reactions } from "./attachments/Reactions";
import { MessageOverlayBar } from "./bars/MessageOverlayBar";
import Embed from "./embed/Embed";
import InviteList from "./embed/EmbedInvite";

interface Props {
    attachContext?: boolean;
    queued?: QueuedMessage;
    message: MessageObject & { webhook: { name: string; avatar?: string } };
    highlight?: boolean;
    contrast?: boolean;
    content?: Children;
    head?: boolean;
    hideReply?: boolean;
}

const FailureActions = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    color: var(--error);
    font-size: 12px;

    button {
        min-height: 30px;
        padding: 0 10px;
        border: 0;
        border-radius: var(--border-radius);
        color: var(--foreground);
        background: var(--secondary-background);
        cursor: pointer;
        font: inherit;

        &:hover,
        &:focus-visible {
            background: var(--tertiary-background);
        }

        &:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
        }

        &:active:not(:disabled) {
            transform: translateY(1px);
        }

        &:disabled {
            opacity: 0.55;
            cursor: not-allowed;
        }
    }
`;

function QueuedFailureActions({
    queued,
    client,
}: {
    queued: QueuedMessage;
    client: MessageObject["client"];
}) {
    const application = useApplicationState();
    const [now, setNow] = useState(Date.now());
    const seconds = retrySeconds(queued.retryAt, now);
    const isWaitingToRetry = seconds > 0;

    useEffect(() => {
        if (!isWaitingToRetry) return;
        const timer = window.setInterval(() => setNow(Date.now()), 250);
        return () => window.clearInterval(timer);
    }, [isWaitingToRetry]);

    const retry = async () => {
        if (seconds > 0) return;
        application.queue.start(queued.id);
        try {
            await client.channels.get(queued.channel)?.sendMessage({
                nonce: queued.id,
                content: queued.data.content,
                replies: queued.data.replies,
            });
        } catch (error) {
            const retryAfter = getRetryAfterMs(error);
            application.queue.fail(
                queued.id,
                takeError(error),
                retryAfter ? Date.now() + retryAfter : undefined,
            );
        }
    };

    return (
        <FailureActions role="alert">
            <span>
                {seconds > 0
                    ? `Rate limited · Retry in ${seconds}s`
                    : "Message not sent"}
            </span>
            <button type="button" disabled={seconds > 0} onClick={retry}>
                {seconds > 0 ? `Retry in ${seconds}s` : "Retry"}
            </button>
            <button
                type="button"
                onClick={() => application.queue.remove(queued.id)}>
                {"Cancel"}
            </button>
        </FailureActions>
    );
}

const Message = observer(
    ({
        highlight,
        attachContext,
        message,
        contrast,
        content: replacement,
        head: preferHead,
        queued,
        hideReply,
        type_msg,
    }: Props) => {
        const client = message.client;
        const user = message.author;

        const content = message.content;
        const imageAttachments =
            message.attachments?.filter(
                (attachment) => attachment.metadata.type === "Image",
            ) ?? [];
        const otherAttachments =
            message.attachments?.filter(
                (attachment) => attachment.metadata.type !== "Image",
            ) ?? [];
        const head =
            preferHead || (message.reply_ids && message.reply_ids.length > 0);

        const userContext = attachContext
            ? useTriggerEvents("Menu", {
                  user: message.author_id,
                  contextualChannel: message.channel_id,
                  contextualMessage: message._id,
                  // eslint-disable-next-line
              })
            : undefined;

        const openProfile = () =>
            modalController.push({
                type: "user_profile",
                user_id: message.author_id,
            });

        const handleUserClick = (e: MouseEvent) => {
            if (e.shiftKey && user?._id) {
                internalEmit(
                    "MessageBox",
                    "append",
                    `<@${user._id}>`,
                    "mention",
                );
            } else {
                openProfile();
            }
        };

        // ! FIXME(?): animate on hover
        const [mouseHovering, setAnimate] = useState(false);
        const [reactionsOpen, setReactionsOpen] = useState(false);
        useEffect(() => setAnimate(false), [replacement]);

        return (
            <div id={message._id}>
                {!hideReply &&
                    message.reply_ids?.map((message_id, index) => (
                        <MessageReply
                            key={message_id}
                            index={index}
                            id={message_id}
                            channel={message.channel}
                            parent_mentions={message.mention_ids ?? []}
                        />
                    ))}
                <MessageBase
                    highlight={highlight}
                    head={
                        hideReply
                            ? false
                            : (head &&
                                  !(
                                      message.reply_ids &&
                                      message.reply_ids.length > 0
                                  )) ??
                              false
                    }
                    contrast={contrast}
                    sending={typeof queued !== "undefined"}
                    mention={
                        (client.user &&
                            (message.mention_ids?.includes(client.user._id) ||
                                (message as any).mentionsEveryone ||
                                (message as any).mentionsSelfRoles)) ||
                        undefined
                    }
                    failed={typeof queued?.error !== "undefined"}
                    {...(attachContext
                        ? useTriggerEvents("Menu", {
                              message,
                              contextualChannel: message.channel_id,
                              queued,
                          })
                        : undefined)}
                    onMouseEnter={() => setAnimate(true)}
                    onMouseLeave={() => setAnimate(false)}>
                    <MessageInfo click={typeof head !== "undefined"}>
                        {head ? (
                            <UserIcon
                                className="avatar"
                                url={message.generateMasqAvatarURL()}
                                override={
                                    message.webhook?.avatar
                                        ? `${
                                              message.client.configuration
                                                  ?.features.autumn?.url ??
                                              FILE_SERVER_ORIGIN
                                          }/avatars/${message.webhook.avatar}`
                                        : undefined
                                }
                                target={user}
                                size={36}
                                onClick={handleUserClick}
                                animate={mouseHovering}
                                {...(userContext as any)}
                                showServerIdentity
                            />
                        ) : (
                            <MessageDetail message={message} position="left" />
                        )}
                    </MessageInfo>
                    <MessageContent>
                        {head && (
                            <span className="detail">
                                <Username
                                    user={user}
                                    className="author"
                                    showServerIdentity
                                    onClick={handleUserClick}
                                    masquerade={message.masquerade!}
                                    override={message.webhook?.name}
                                    {...userContext}
                                />
                                <MessageDetail
                                    message={message}
                                    position="top"
                                />
                            </span>
                        )}
                        {replacement ??
                            (content && <Markdown content={content} />)}
                        {!queued && <InviteList message={message} />}
                        {queued?.error && (
                            <>
                                <Category>
                                    <I18nError error={queued.error} />
                                </Category>
                                <QueuedFailureActions
                                    queued={queued}
                                    client={client}
                                />
                            </>
                        )}
                        {imageAttachments.length === 1 && (
                            <Attachment
                                attachment={imageAttachments[0]}
                                hasContent={
                                    content ? content.length > 0 : false
                                }
                            />
                        )}
                        {imageAttachments.length > 1 && (
                            <ImageGallery attachments={imageAttachments} />
                        )}
                        {otherAttachments.map((attachment, index) => (
                            <Attachment
                                key={attachment._id}
                                attachment={attachment}
                                hasContent={
                                    index > 0 ||
                                    imageAttachments.length > 0 ||
                                    (content ? content.length > 0 : false)
                                }
                            />
                        ))}
                        {message.embeds?.map((embed, index) => (
                            <Embed key={index} embed={embed} />
                        ))}
                        <Reactions message={message} />
                        {(mouseHovering || reactionsOpen) &&
                            !replacement &&
                            !type_msg &&
                            !isTouchscreenDevice && (
                                <MessageOverlayBar
                                    reactionsOpen={reactionsOpen}
                                    setReactionsOpen={setReactionsOpen}
                                    message={message}
                                    queued={queued}
                                />
                            )}
                    </MessageContent>
                </MessageBase>
            </div>
        );
    },
);

export default memo(Message);
