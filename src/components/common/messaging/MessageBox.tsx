import { Block } from "@styled-icons/boxicons-regular";
import { User } from "@styled-icons/boxicons-regular";
import {
    FileGif as GifIcon,
    HappyBeaming,
    Send,
} from "@styled-icons/boxicons-solid";
import Axios, { CancelTokenSource } from "axios";
import { observer } from "mobx-react-lite";
import { Channel } from "revolt.js";
import styled, { css } from "styled-components/macro";
import { ulid } from "ulid";

import { Text } from "preact-i18n";
import { memo } from "preact/compat";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { IconButton, Picker } from "@revoltchat/ui";

import TextAreaAutoSize from "../../../lib/TextAreaAutoSize";
import { getRetryAfterMs, retrySeconds } from "../../../lib/chatSendFailure";
import { convertMentionsToWireFormat } from "../../../lib/convertMentions";
import { debounce } from "../../../lib/debounce";
import { defer, chainedDefer } from "../../../lib/defer";
import { internalEmit, internalSubscribe } from "../../../lib/eventEmitter";
import { useTranslation } from "../../../lib/i18n";
import { isTouchscreenDevice } from "../../../lib/isTouchscreenDevice";
import { Gif, MediaKind, gifShare, klipyEnabled } from "../../../lib/klipy";
import {
    getRenderer,
    SMOOTH_SCROLL_ON_RECEIVE,
} from "../../../lib/renderer/Singleton";

import { state, useApplicationState } from "../../../mobx/State";
import { DraftObject } from "../../../mobx/stores/Draft";
import { Reply } from "../../../mobx/stores/MessageQueue";

import { dayjs } from "../../../context/Locale";

import { emojiDictionary } from "../../../assets/emojis";
import {
    clientController,
    useClient,
} from "../../../controllers/client/ClientController";
import { takeError } from "../../../controllers/client/jsx/error";
import {
    FileUploader,
    grabFiles,
    uploadFile,
} from "../../../controllers/client/jsx/legacy/FileUploads";
import { modalController } from "../../../controllers/modals/ModalController";
import { RenderEmoji } from "../../markdown/plugins/emoji";
import AutoComplete, { useAutoComplete } from "../AutoComplete";
import { PermissionTooltip } from "../Tooltip";
import ComposerOverlay from "./ComposerOverlay";
import MediaPicker, { MediaTab } from "./MediaPicker";
import FilePreview from "./bars/FilePreview";
import ReplyBar from "./bars/ReplyBar";

type Props = {
    channel: Channel;
};

export type UploadState =
    | { type: "none" }
    | { type: "attached"; files: File[] }
    | {
          type: "uploading";
          files: File[];
          percent: number;
          cancel: CancelTokenSource;
      }
    | { type: "sending"; files: File[] }
    | { type: "failed"; files: File[]; error: string };

const Base = styled.div`
    z-index: 1;
    display: flex;
    /* Pin the attach/emoji/send slots to the BOTTOM edge: when a long
       paste grows the textarea, the actions stay next to the caret line
       instead of riding 400px up with the bar's top. */
    align-items: flex-end;
    background: var(--message-box);

    /* The composition bar floats as a near-pill —
       The bar uses radius "xl" (28px); the panel
       pads 8px inline and the bar keeps 8px to the bottom, so the bar runs
       nearly edge-to-edge. */
    ${() =>
        !isTouchscreenDevice &&
        css`
            margin: 0 var(--space-2) var(--space-2);
            border-radius: 28px;
            overflow: hidden;
        `}

    textarea {
        font-size: var(--text-size);
        background: transparent;
        /* Cap the bar viewport-relatively (reference: 32vh) — on short
           windows the composer stops growing sooner and scrolls inside. */
        max-height: 32vh;

        &::placeholder {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }
`;

const Blocked = styled.div`
    display: flex;
    align-items: center;
    user-select: none;
    font-size: var(--text-size);
    /* Full text colour, aligned to the composer's own geometry: the
       icon slot is the file button's 56px (icon lands where + sits) and
       the text starts exactly where the placeholder starts — switching
       between sendable and read-only channels moves nothing. */
    color: var(--foreground);
    flex-grow: 1;
    cursor: not-allowed;
    min-height: 52px;

    .text {
        padding: 0 12px 0 0;
    }

    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 52px;
        flex-shrink: 0;
    }

    > div > div {
        cursor: default;
    }

    svg {
        flex-shrink: 0;
    }
`;

const Action = styled.div`
    > a {
        /* 52px-tall bar, 42px-wide icon slots
           (their InlineIcon width). */
        height: 52px;
        width: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .mobile {
        width: 56px;
    }

    ${() =>
        !isTouchscreenDevice &&
        css`
            .mobile {
                display: none;
            }
        `}
`;

const FileAction = styled.div`
    > a {
        height: 52px;
        width: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
`;

const FloatingLayer = styled.div`
    position: relative;
`;

const SendStatus = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 34px;
    margin: 0 var(--space-2);
    padding: 6px 12px;
    border-radius: var(--border-radius);
    color: var(--foreground);
    background: var(--secondary-background);
    font-size: 12px;

    &[data-error="true"] {
        border-inline-start: 3px solid var(--error);
    }
`;

const ThisCodeWillBeReplacedAnywaysSoIMightAsWellJustDoItThisWay__Padding = styled.div`
    width: 16px;
`;

// For sed replacement
const RE_SED = new RegExp("^s/([^])*/([^])*$");

// Tests for code block delimiters (``` at start of line)
const RE_CODE_DELIMITER = new RegExp("^```", "gm");

export const HackAlertThisFileWillBeReplaced = observer(
    ({
        onSelect,
        onClose,
        embedded,
    }: {
        onSelect: (emoji: string) => void;
        onClose: () => void;
        embedded?: boolean;
    }) => {
        const renderEmoji = useMemo(
            () =>
                memo(({ emoji }: { emoji: string }) => (
                    <RenderEmoji match={emoji} {...({} as any)} />
                )),
            [],
        );

        const emojis: Record<string, any> = {
            default: Object.keys(emojiDictionary).map((id) => ({ id })),
        };

        // ! FIXME: also expose typing from component
        const categories: any[] = [];

        for (const server of state.ordering.orderedServers) {
            // ! FIXME: add a separate map on each server for emoji
            const list = [...clientController.getReadyClient()!.emojis.values()]
                .filter(
                    (emoji) =>
                        emoji.parent.type !== "Detached" &&
                        emoji.parent.id === server._id,
                )
                .map(({ _id, name }) => ({ id: _id, name }));

            if (list.length > 0) {
                emojis[server._id] = list;
                categories.push({
                    id: server._id,
                    name: server.name,
                    iconURL: server.generateIconURL({ max_side: 256 }),
                });
            }
        }

        categories.push({
            id: "default",
            name: "Default",
            emoji: "smiley",
        });

        return (
            <Picker
                emojis={emojis}
                categories={categories}
                renderEmoji={renderEmoji}
                onSelect={onSelect}
                onClose={onClose}
                embedded={embedded}
            />
        );
    },
);

// ! FIXME: add to app config and load from app config
export const CAN_UPLOAD_AT_ONCE = 5;

export default observer(({ channel }: Props) => {
    const state = useApplicationState();

    const [uploadState, setUploadState] = useState<UploadState>({
        type: "none",
    });
    const [typing, setTyping] = useState<boolean | number>(false);
    const [replies, setReplies] = useState<Reply[]>([]);
    const [picker, setPicker] = useState(false);
    const [sendFailure, setSendFailure] = useState<{
        error: string;
        retryAt?: number;
    }>();
    const [now, setNow] = useState(Date.now());
    const [pickerTab, setPickerTab] = useState<MediaTab>("emoji");
    const client = useClient();
    const translate = useTranslation();
    const cooldown = retrySeconds(sendFailure?.retryAt, now);
    const isCoolingDown = cooldown > 0;

    useEffect(() => {
        if (!isCoolingDown) return;
        const timer = window.setInterval(() => setNow(Date.now()), 250);
        return () => window.clearInterval(timer);
    }, [isCoolingDown]);

    useEffect(() => setSendFailure(undefined), [channel._id]);

    const closePicker = useCallback(() => setPicker(false), []);

    /**
     * Open the media panel on a given tab, or close it if that tab is
     * already showing — so each button toggles its own section.
     */
    const openPicker = useCallback(
        (tab: MediaTab) => {
            setPicker((open) => !(open && pickerTab === tab));
            setPickerTab(tab);
        },
        [pickerTab],
    );

    const renderer = getRenderer(channel);

    if (
        channel.channel_type !== "SavedMessages" &&
        ((client.user?.flags ?? 0) & 16) !== 0
    ) {
        return (
            <Base>
                <Blocked>
                    <div className="icon">
                        <Block size={24} />
                    </div>
                    <div className="text">
                        <Text id="app.main.channel.misc.muted" />
                    </div>
                </Blocked>
            </Base>
        );
    }

    if (channel.server?.member?.timeout) {
        return (
            <Base>
                <Blocked>
                    <div className="icon">
                        <PermissionTooltip
                            permission="SendMessages"
                            placement="top">
                            <Block size={24} />
                        </PermissionTooltip>
                    </div>
                    <div className="text">
                        <Text
                            id="app.main.channel.misc.timed_out"
                            fields={{
                                // TODO: make this reactive
                                time: dayjs().to(
                                    channel.server.member.timeout,
                                    true,
                                ),
                            }}
                        />
                    </div>
                </Blocked>
            </Base>
        );
    }

    if (
        channel.channel_type != "SavedMessages" &&
        ((!channel.havePermission("SendMessage") &&
            channel.channel_type == "TextChannel") ||
            channel.recipient?.relationship == "Blocked" ||
            channel.recipient?.relationship == "BlockedOther")
    ) {
        return (
            <Base>
                <Blocked>
                    <div className="icon">
                        <PermissionTooltip
                            permission="SendMessages"
                            placement="top">
                            <Block size={24} />
                        </PermissionTooltip>
                    </div>
                    <div className="text">
                        <Text id="app.main.channel.misc.no_sending" />
                    </div>
                </Blocked>
            </Base>
        );
    }
    // Push message content to draft.
    const setMessage = useCallback(
        (content?: string) => {
            const dobj: DraftObject = {
                content,
            };
            state.draft.set(channel._id, dobj);
        },
        [state.draft, channel._id],
    );

    useEffect(() => {
        /**
         *
         * @param content
         * @param action
         */
        function append(content: string, action: "quote" | "mention") {
            const text =
                action === "quote"
                    ? `${content
                          .split("\n")
                          .map((x) => `> ${x}`)
                          .join("\n")}\n\n`
                    : `${content} `;

            if (!state.draft.has(channel._id)) {
                setMessage(text);
            } else {
                setMessage(`${state.draft.get(channel._id)}\n${text}`);
            }
        }

        return internalSubscribe(
            "MessageBox",
            "append",
            append as (...args: unknown[]) => void,
        );
    }, [state.draft, channel._id, setMessage]);

    /**
     * Trigger send message.
     */
    async function send() {
        if (cooldown > 0) return;
        if (uploadState.type === "uploading" || uploadState.type === "sending")
            return;

        let content = state.draft.get(channel._id)?.content?.trim() ?? "";
        if (uploadState.type !== "none") return sendFile(content);
        if (content.length === 0) return;

        // Check for @everyone mentions first
        if (content.includes("@everyone")) {
            // kept for potential future logic, but currently does nothing
        }

        // Convert friendly @RoleName / @username mentions to wire format
        // (<%ROLE_ID> / <@USER_ID>) — shared with MessageEditor.
        content = convertMentionsToWireFormat(content, channel, client);

        internalEmit("NewMessages", "hide");
        stopTyping();
        setMessage();
        setReplies([]);
        const nonce = ulid();

        // sed style message editing.
        // If the user types for example `s/abc/def`, the string "abc"
        // will be replaced with "def" in their last sent message.
        if (RE_SED.test(content)) {
            renderer.messages.reverse();
            const msg = renderer.messages.find(
                (msg) => msg.author_id === client.user!._id,
            );
            renderer.messages.reverse();

            if (msg?.content) {
                // eslint-disable-next-line prefer-const
                let [_, toReplace, newText, flags] = content.split(/\//);

                if (toReplace == "*") toReplace = msg.content.toString();

                const newContent =
                    toReplace == ""
                        ? msg.content.toString() + newText
                        : msg.content
                              .toString()
                              .replace(new RegExp(toReplace, flags), newText);

                if (newContent != msg.content) {
                    if (newContent.length == 0) {
                        msg.delete().catch(console.error);
                    } else {
                        msg.edit({
                            content: newContent.substr(0, 2000),
                        })
                            .then(() =>
                                chainedDefer(() =>
                                    renderer.jumpToBottom(
                                        SMOOTH_SCROLL_ON_RECEIVE,
                                    ),
                                ),
                            )
                            .catch(console.error);
                    }
                }
            }
        } else {
            state.settings.sounds.playSound("outbound");

            state.queue.add(nonce, channel._id, {
                _id: nonce,
                channel: channel._id,
                author: client.user!._id,

                content,
                replies,
            });

            // Use chainedDefer for more reliable scrolling
            chainedDefer(() => renderer.jumpToBottom(SMOOTH_SCROLL_ON_RECEIVE));

            try {
                await channel.sendMessage({
                    content,
                    nonce,
                    replies,
                });
                setSendFailure(undefined);

                // Add another scroll to bottom after the message is sent
                chainedDefer(() =>
                    renderer.jumpToBottom(SMOOTH_SCROLL_ON_RECEIVE),
                );
            } catch (error) {
                const retryAfter = getRetryAfterMs(error);
                const failure = {
                    error: takeError(error),
                    retryAt: retryAfter ? Date.now() + retryAfter : undefined,
                };
                state.queue.fail(nonce, failure.error, failure.retryAt);
                setSendFailure(failure);
            }
        }
    }

    /**
     * Send a picked GIF or sticker as its own message.
     *
     * The direct media URL is the content: january embeds that as an
     * image, where the provider's page URL yields no embed at all. Any
     * draft the user is part-way through typing is left untouched —
     * the GIF is a separate message, as it is elsewhere.
     */
    async function sendGif(gif: Gif, kind: MediaKind, searchQuery?: string) {
        const nonce = ulid();
        state.settings.sounds.playSound("outbound");
        setReplies([]);

        // KLIPY personalise results from what actually gets sent; this is
        // fire-and-forget and never blocks the message.
        gifShare(kind, gif.slug, searchQuery);

        state.queue.add(nonce, channel._id, {
            _id: nonce,
            channel: channel._id,
            author: client.user!._id,

            content: gif.url,
            replies,
        });

        chainedDefer(() => renderer.jumpToBottom(SMOOTH_SCROLL_ON_RECEIVE));

        try {
            await channel.sendMessage({ content: gif.url, nonce, replies });
            chainedDefer(() => renderer.jumpToBottom(SMOOTH_SCROLL_ON_RECEIVE));
        } catch (error) {
            state.queue.fail(nonce, takeError(error));
        }
    }

    /**
     *
     * @param content
     * @returns
     */
    async function sendFile(content: string) {
        if (uploadState.type !== "attached" && uploadState.type !== "failed")
            return;

        const attachments: string[] = [];
        setMessage;

        const cancel = Axios.CancelToken.source();
        const files = uploadState.files;
        stopTyping();
        setUploadState({ type: "uploading", files, percent: 0, cancel });

        try {
            for (let i = 0; i < files.length && i < CAN_UPLOAD_AT_ONCE; i++) {
                const file = files[i];
                attachments.push(
                    await uploadFile(
                        client.configuration!.features.autumn.url,
                        "attachments",
                        file,
                        {
                            onUploadProgress: (e) =>
                                setUploadState({
                                    type: "uploading",
                                    files,
                                    percent: Math.round(
                                        (i * 100 + (100 * e.loaded) / e.total) /
                                            Math.min(
                                                files.length,
                                                CAN_UPLOAD_AT_ONCE,
                                            ),
                                    ),
                                    cancel,
                                }),
                            cancelToken: cancel.token,
                        },
                    ),
                );
            }
        } catch (err) {
            // eslint-disable-next-line
            if ((err as any)?.message === "cancel") {
                setUploadState({
                    type: "attached",
                    files,
                });
            } else {
                setUploadState({
                    type: "failed",
                    files,
                    error: takeError(err),
                });
            }

            return;
        }

        setUploadState({
            type: "sending",
            files,
        });

        const nonce = ulid();
        try {
            await channel.sendMessage({
                content,
                nonce,
                replies,
                attachments,
            });
            setSendFailure(undefined);
        } catch (err) {
            const retryAfter = getRetryAfterMs(err);
            const failure = {
                error: takeError(err),
                retryAt: retryAfter ? Date.now() + retryAfter : undefined,
            };
            setUploadState({
                type: "failed",
                files,
                error: failure.error,
            });
            setSendFailure(failure);

            return;
        }

        setMessage();
        setReplies([]);
        state.settings.sounds.playSound("outbound");

        if (files.length > CAN_UPLOAD_AT_ONCE) {
            setUploadState({
                type: "attached",
                files: files.slice(CAN_UPLOAD_AT_ONCE),
            });
        } else {
            setUploadState({ type: "none" });
        }
    }

    /**
     *
     * @returns
     */
    function startTyping() {
        if (typeof typing === "number" && +new Date() < typing) return;

        const ws = client.websocket;
        if (ws.connected) {
            setTyping(+new Date() + 2500);
            ws.send({
                type: "BeginTyping",
                channel: channel._id,
            });
        }
    }

    /**
     *
     * @param force
     */
    function stopTyping(force?: boolean) {
        if (force || typing) {
            const ws = client.websocket;
            if (ws.connected) {
                setTyping(false);
                ws.send({
                    type: "EndTyping",
                    channel: channel._id,
                });
            }
        }
    }

    function isInCodeBlock(cursor: number): boolean {
        const content = state.draft.get(channel._id)?.content || "";
        const contentBeforeCursor = content.substring(0, cursor);

        let delimiterCount = 0;
        for (const delimiter of contentBeforeCursor.matchAll(
            RE_CODE_DELIMITER,
        )) {
            delimiterCount++;
        }

        // Odd number of ``` delimiters before cursor => we are in code block
        return delimiterCount % 2 === 1;
    }

    // TODO: change to useDebounceCallback
    // eslint-disable-next-line
    const debouncedStopTyping = useCallback(
        debounce(stopTyping as (...args: unknown[]) => void, 1000),
        [channel._id],
    );
    const {
        onChange,
        onKeyUp,
        onKeyDown,
        onFocus,
        onBlur,
        ...autoCompleteProps
    } = useAutoComplete(setMessage, {
        users: { type: "channel", id: channel._id },
        channels:
            channel.channel_type === "TextChannel"
                ? { server: channel.server_id! }
                : undefined,
    });

    return (
        <>
            <AutoComplete {...autoCompleteProps} />
            <FilePreview
                state={uploadState}
                addFile={() =>
                    uploadState.type === "attached" &&
                    grabFiles(
                        20_000_000,
                        (files) =>
                            setUploadState({
                                type: "attached",
                                files: [...uploadState.files, ...files],
                            }),
                        () =>
                            modalController.push({
                                type: "error",
                                error: "FileTooLarge",
                            }),
                        true,
                    )
                }
                removeFile={(index) => {
                    if (uploadState.type !== "attached") return;
                    if (uploadState.files.length === 1) {
                        setUploadState({ type: "none" });
                    } else {
                        setUploadState({
                            type: "attached",
                            files: uploadState.files.filter(
                                (_, i) => index !== i,
                            ),
                        });
                    }
                }}
            />
            <ReplyBar
                channel={channel}
                replies={replies}
                setReplies={setReplies}
            />
            {sendFailure && (
                <SendStatus role="status" data-error="true">
                    <span>
                        {cooldown > 0
                            ? `Rate limited · You can retry in ${cooldown}s`
                            : "Send failed · Your message is preserved below"}
                    </span>
                    <span>
                        {cooldown > 0 ? `${cooldown}s` : "Retry available"}
                    </span>
                </SendStatus>
            )}
            <FloatingLayer>
                {picker && (
                    <MediaPicker
                        tab={pickerTab}
                        setTab={setPickerTab}
                        onSelectGif={sendGif}
                        onClose={closePicker}>
                        {({ embedded }) => (
                            <HackAlertThisFileWillBeReplaced
                                embedded={embedded}
                                onSelect={(emoji) => {
                                    const v = state.draft.get(channel._id);
                                    // Standard emoji go in as the unicode character
                                    // (rendered as the same Twemoji image in composer
                                    // and message); custom emoji have no unicode
                                    // form and stay :ULID:.
                                    const inserted =
                                        emoji in emojiDictionary
                                            ? emojiDictionary[
                                                  emoji as keyof typeof emojiDictionary
                                              ]
                                            : `:${emoji}:`;
                                    const cnt: DraftObject = {
                                        content:
                                            (v?.content
                                                ? `${v.content} `
                                                : "") + inserted,
                                    };
                                    state.draft.set(channel._id, cnt);
                                }}
                                onClose={closePicker}
                            />
                        )}
                    </MediaPicker>
                )}
            </FloatingLayer>
            <Base>
                {/* {channel.havePermission("UploadFiles") ? ( */}
                <FileAction>
                    <FileUploader
                        size={24}
                        behaviour="multi"
                        style="attachment"
                        fileType="attachments"
                        maxFileSize={20_000_000}
                        attached={uploadState.type !== "none"}
                        uploading={
                            uploadState.type === "uploading" ||
                            uploadState.type === "sending"
                        }
                        remove={async () => setUploadState({ type: "none" })}
                        onChange={(files) =>
                            setUploadState({ type: "attached", files })
                        }
                        cancel={() =>
                            uploadState.type === "uploading" &&
                            uploadState.cancel.cancel("cancel")
                        }
                        append={(files) => {
                            if (files.length === 0) return;

                            if (uploadState.type === "none") {
                                setUploadState({ type: "attached", files });
                            } else if (uploadState.type === "attached") {
                                setUploadState({
                                    type: "attached",
                                    files: [...uploadState.files, ...files],
                                });
                            }
                        }}
                    />
                </FileAction>
                {/* ) : (
                    <ThisCodeWillBeReplacedAnywaysSoIMightAsWellJustDoItThisWay__Padding />
                )} */}
                <TextAreaAutoSize
                    autoFocus
                    hideBorder
                    maxRows={20}
                    id="message"
                    maxLength={2000}
                    onKeyUp={onKeyUp}
                    value={state.draft.get(channel._id)?.content ?? ""}
                    padding="var(--message-box-padding)"
                    overlay={(value) => (
                        <ComposerOverlay value={value} channel={channel} />
                    )}
                    onKeyDown={(e) => {
                        if (e.ctrlKey && e.key === "Enter") {
                            e.preventDefault();
                            return send();
                        }

                        if (onKeyDown(e)) return;

                        if (
                            e.key === "ArrowUp" &&
                            !state.draft.has(channel._id)
                        ) {
                            e.preventDefault();
                            internalEmit("MessageRenderer", "edit_last");
                            return;
                        }

                        if (
                            !e.shiftKey &&
                            !e.isComposing &&
                            e.key === "Enter" &&
                            !isTouchscreenDevice &&
                            !isInCodeBlock(e.currentTarget.selectionStart)
                        ) {
                            e.preventDefault();
                            return send();
                        }

                        if (e.key === "Escape") {
                            if (replies.length > 0) {
                                setReplies(replies.slice(0, -1));
                            } else if (
                                uploadState.type === "attached" &&
                                uploadState.files.length > 0
                            ) {
                                setUploadState({
                                    type:
                                        uploadState.files.length > 1
                                            ? "attached"
                                            : "none",
                                    files: uploadState.files.slice(0, -1),
                                });
                            }
                        }

                        debouncedStopTyping(true);
                    }}
                    placeholder={
                        channel.channel_type === "DirectMessage"
                            ? translate("app.main.channel.message_who", {
                                  person: channel.recipient?.username,
                              })
                            : channel.channel_type === "SavedMessages"
                            ? translate("app.main.channel.message_saved")
                            : translate("app.main.channel.message_where", {
                                  channel_name: channel.name ?? undefined,
                              })
                    }
                    disabled={
                        uploadState.type === "uploading" ||
                        uploadState.type === "sending"
                    }
                    onChange={(e) => {
                        setMessage(e.currentTarget.value);
                        startTyping();
                        onChange(e);
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                />
                {klipyEnabled && (
                    <Action>
                        <IconButton onClick={() => openPicker("gif")}>
                            <GifIcon size={24} />
                        </IconButton>
                    </Action>
                )}
                <Action>
                    <IconButton
                        aria-label={translate(
                            "app.main.channel.accessibility.open_emoji_picker",
                        )}
                        aria-expanded={picker}
                        onClick={() => openPicker("emoji")}>
                        <HappyBeaming size={24} aria-hidden="true" />
                    </IconButton>
                </Action>
                <Action>
                    <IconButton
                        className={
                            state.settings.get("appearance:show_send_button")
                                ? ""
                                : "mobile"
                        }
                        onClick={send}
                        disabled={
                            cooldown > 0 ||
                            uploadState.type === "uploading" ||
                            uploadState.type === "sending"
                        }
                        aria-label={
                            cooldown > 0
                                ? translate(
                                      "app.main.channel.accessibility.retry_sending",
                                      { seconds: String(cooldown) },
                                  )
                                : translate(
                                      "app.main.channel.accessibility.send_message",
                                  )
                        }
                        onMouseDown={(e) => e.preventDefault()}>
                        <Send size={24} aria-hidden="true" />
                    </IconButton>
                </Action>
            </Base>
        </>
    );
});
