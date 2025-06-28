import { RE_MENTIONS } from "revolt.js";
import styled from "styled-components";

import { clientController } from "../../../controllers/client/ClientController";
import UserShort from "../../common/user/UserShort";
import { createComponent, CustomComponentProps } from "./remarkRegexComponent";

// Role mention regex - matches <%ROLE_ID> format
const RE_ROLE_MENTIONS = /<%([A-z0-9]{26})>/g;

const Mention = styled.a`
    gap: 4px;
    flex-shrink: 0;
    padding-left: 2px;
    padding-right: 6px;
    align-items: center;
    display: inline-flex;
    vertical-align: middle;

    cursor: pointer;

    font-weight: 600;
    text-decoration: none !important;
    background: var(--secondary-background);
    border-radius: calc(var(--border-radius) * 2);

    transition: 0.1s ease filter;

    &:hover {
        filter: brightness(0.75);
    }

    &:active {
        filter: brightness(0.65);
    }

    svg {
        width: 1em;
        height: 1em;
    }
`;

export function RenderMention({ match }: CustomComponentProps) {
    // Special handling for @everyone mentions
    if (match === "everyone") {
        return (
            <Mention>
                @everyone
            </Mention>
        );
    }

    // Special handling for @online mentions
    if (match === "online") {
        return (
            <Mention>
                @online
            </Mention>
        );
    }

    // Normal user mention
    return (
        <Mention>
            <UserShort
                showServerIdentity
                user={clientController.getAvailableClient().users.get(match)}
            />
        </Mention>
    );
}

export function RenderRoleMention({ match }: CustomComponentProps) {
    const client = clientController.getAvailableClient();
    
    // Find the role by searching through all servers
    let role = null;
    
    for (const server of client.servers.values()) {
        // Search through orderedRoles array to find role by ID
        const foundRole = server.orderedRoles.find(r => r.id === match);
        if (foundRole) {
            role = foundRole;
            break;
        }
    }

    // If role not found, show the ID as fallback
    if (!role) {
        return (
            <Mention>
                @{match.slice(0, 8)}...
            </Mention>
        );
    }

    // Show the role name with role color if available
    const roleColor = role.colour || role.color; // Handle both spellings
    const style = roleColor ? { color: roleColor } : {};
    
    return (
        <Mention style={style}>
            @{role.name}
        </Mention>
    );
}

export const remarkMention = createComponent("mention", RE_MENTIONS, (match) => {
    return match === "everyone" || match === "online" || clientController.getAvailableClient().users.has(match);
});

export const remarkRoleMention = createComponent("roleMention", RE_ROLE_MENTIONS, (match) => {
    const client = clientController.getAvailableClient();
    // Check if any server has this role
    for (const server of client.servers.values()) {
        const role = server.orderedRoles.find(r => r.id === match);
        if (role) {
            return true;
        }
    }
    return false;
});

