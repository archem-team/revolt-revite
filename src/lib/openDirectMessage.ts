import type { History } from "history";
import type { Channel, User } from "revolt.js";

import Settings from "../mobx/stores/Settings";

import { modalController } from "../controllers/modals/ModalController";

function canOpenDirectMessage(settings: Settings, user: User) {
    if (!settings.get("privacy:require_friends_for_dms", false)) {
        return true;
    }

    return (
        user.relationship === "Friend" ||
        user.relationship === "User" ||
        !!user.bot
    );
}

/**
 * Opens a DM with optional friend-gating.
 * If friend-gating is enabled and target is not a friend, a friend request is
 * sent first (when possible) and the DM is blocked.
 */
export async function openDirectMessage(
    settings: Settings,
    history: History,
    user: User,
) {
    if (!canOpenDirectMessage(settings, user)) {
        if (user.relationship === "None" || user.relationship === null) {
            try {
                await user.addFriend();
            } catch {
                // Ignore friend request errors and still show a clear user-facing notice.
            }

            modalController.push({
                type: "error",
                error: "FriendRequestSentDMRestricted",
            });
            return;
        }

        modalController.push({
            type: "error",
            error: "FriendRequiredForDM",
        });
        return;
    }

    const channel: Channel = await user.openDM();
    history.push(`/channel/${channel._id}`);
}
