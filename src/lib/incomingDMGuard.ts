import type { Channel, User } from "revolt.js";

import Settings from "../mobx/stores/Settings";

import { modalController } from "../controllers/modals/ModalController";

/**
 * Check if an incoming DM should be blocked based on privacy settings.
 * Returns true if the DM should be blocked, false otherwise.
 */
export function shouldBlockIncomingDM(
    settings: Settings,
    sender: User | undefined,
): boolean {
    // If privacy setting is off, allow all DMs
    if (!settings.get("privacy:require_friends_for_dms", false)) {
        return false;
    }

    // If sender is unknown, block it
    if (!sender) {
        return true;
    }

    // Allow DMs from friends, yourself, and bots
    return !(
        sender.relationship === "Friend" ||
        sender.relationship === "User" ||
        sender.bot
    );
}

/**
 * Handle an incoming DM channel.
 * If the sender is not a friend and privacy setting is enabled,
 * show a modal instead of opening the DM.
 */
export function handleIncomingDM(
    settings: Settings,
    channel: Channel,
): boolean {
    if (channel.channel_type !== "DirectMessage") {
        return false;
    }

    const sender = channel.recipient;

    if (shouldBlockIncomingDM(settings, sender)) {
        if (sender) {
            modalController.push({
                type: "blocked_incoming_dm",
                user: sender,
            });
        }
        return true;
    }

    return false;
}
