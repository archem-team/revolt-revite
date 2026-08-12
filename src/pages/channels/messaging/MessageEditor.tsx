import { Message } from "revolt.js";
import styled from "styled-components/macro";

import { useEffect, useState } from "preact/hooks";

import TextAreaAutoSize from "../../../lib/TextAreaAutoSize";
import { convertMentionsToWireFormat } from "../../../lib/convertMentions";
import { useTranslation } from "../../../lib/i18n";
import { isTouchscreenDevice } from "../../../lib/isTouchscreenDevice";

import AutoComplete, {
    useAutoComplete,
} from "../../../components/common/AutoComplete";
import { modalController } from "../../../controllers/modals/ModalController";

const EditorBase = styled.div`
    display: flex;
    flex-direction: column;

    textarea {
        resize: none;
        padding: 12px;
        white-space: pre-wrap;
        font-size: var(--text-size);
        border-radius: var(--border-radius);
        background: var(--secondary-header);
    }

    .caption {
        padding: 2px;
        font-size: 11px;
        color: var(--tertiary-foreground);

        button {
            padding: 0;
            border: 0;
            color: inherit;
            background: transparent;
            cursor: pointer;
            font: inherit;

            &:hover {
                text-decoration: underline;
            }

            &:focus-visible {
                outline: 2px solid var(--focus-ring);
                outline-offset: 2px;
            }
        }
    }
`;

interface Props {
    message: Message;
    finish: () => void;
}

export default function MessageEditor({ message, finish }: Props) {
    const [content, setContent] = useState(message.content ?? "");
    const translate = useTranslation();

    async function save() {
        finish();

        // The editor's autocomplete inserts friendly @RoleName / @username
        // text just like the composer, so run the same wire-format
        // conversion the composer runs at send.
        const converted = convertMentionsToWireFormat(
            content,
            message.channel!,
            message.client,
        );

        if (converted.length === 0) {
            modalController.push({
                type: "delete_message",
                target: message,
            });
        } else if (converted !== message.content) {
            await message.edit({
                content: converted,
            });
        }
    }

    // ? Stop editing when pressing ESC.
    useEffect(() => {
        function keyUp(e: KeyboardEvent) {
            if (e.key === "Escape" && !modalController.isVisible) {
                finish();
            }
        }

        document.body.addEventListener("keyup", keyUp);
        return () => document.body.removeEventListener("keyup", keyUp);
    }, [finish]);

    const {
        onChange,
        onKeyUp,
        onKeyDown,
        onFocus,
        onBlur,
        ...autoCompleteProps
    } = useAutoComplete((v) => setContent(v ?? ""), {
        users: { type: "channel", id: message.channel!._id },
        channels:
            message.channel!.channel_type === "TextChannel"
                ? { server: message.channel!.server_id! }
                : undefined,
    });

    return (
        <EditorBase>
            <AutoComplete detached {...autoCompleteProps} />
            <TextAreaAutoSize
                forceFocus
                maxRows={10}
                value={content}
                maxLength={2000}
                padding="var(--message-box-padding)"
                onChange={(ev) => {
                    onChange(ev);
                    setContent(ev.currentTarget.value);
                }}
                onKeyDown={(e) => {
                    if (onKeyDown(e)) return;

                    if (
                        !e.shiftKey &&
                        e.key === "Enter" &&
                        !isTouchscreenDevice
                    ) {
                        e.preventDefault();
                        save();
                    }
                }}
                onKeyUp={onKeyUp}
                onFocus={onFocus}
                onBlur={onBlur}
            />
            <span className="caption">
                <button
                    type="button"
                    aria-label={translate("app.main.channel.editor.cancel")}
                    onClick={finish}>
                    {translate("app.special.modals.actions.cancel")}
                </button>{" "}
                {"·"}{" "}
                <button
                    type="button"
                    aria-label={translate("app.main.channel.editor.save")}
                    onClick={save}>
                    {translate("app.special.modals.actions.save")}
                </button>
            </span>
        </EditorBase>
    );
}
