import { observer } from "mobx-react-lite";
import { Text } from "preact-i18n";
import { useState } from "preact/hooks";

import { Button, Column, Modal } from "@revoltchat/ui";

import { ModalProps } from "../types";

/**
 * Modal shown when a non-friend tries to DM a user with
 * "require friends for DMs" privacy setting enabled.
 */
export default observer(
    function BlockedIncomingDM({
        user,
        onClose,
    }: ModalProps<"blocked_incoming_dm">) {
        const [sending, setSending] = useState(false);

        const handleSendFriendRequest = async () => {
            setSending(true);
            try {
                await user.addFriend();
            } catch (error) {
                console.error("Failed to send friend request:", error);
            } finally {
                setSending(false);
            }
        };

        return (
            <Modal
                {...{ onClose }}
                title="Direct Message Blocked"
                actions={[
                    {
                        onClick: () => {
                            handleSendFriendRequest();
                            onClose();
                        },
                        confirmation: true,
                        children: (
                            <Text id="app.settings.pages.account.privacy.send_request" />
                        ),
                        disabled: sending,
                    },
                    {
                        onClick: onClose,
                        palette: "plain",
                        children: <Text id="app.special.modals.actions.close" />,
                    },
                ]}>
                <Column>
                    <Text id="app.settings.pages.account.privacy.blocked_incoming_dm_message" />
                    {user.username && (
                        <div
                            style={{
                                marginTop: "12px",
                                padding: "8px",
                                borderRadius: "8px",
                                background:
                                    "rgba(255, 255, 255, 0.05)",
                            }}>
                            <strong>@{user.username}</strong> tried to send you
                            a direct message.
                        </div>
                    )}
                </Column>
            </Modal>
        );
    },
);
