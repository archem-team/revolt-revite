import { RE_MENTIONS } from "revolt.js";
import styled from "styled-components";

import { clientController } from "../../../controllers/client/ClientController";
import UserShort from "../../common/user/UserShort";
import { createComponent, CustomComponentProps } from "./remarkRegexComponent";

// RE_EVERYONE is not exported in the ESM build, define it locally
const RE_EVERYONE = /@everyone/g;
// Defined locally for the same reason (typecheck resolves the stale npm
// revolt.js vendored under external/components, which lacks the export)
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
    /* Mention pill: gold text on a dark olive pill. */
    color: #d6a939;
    background: #312d1d;
    border-radius: calc(var(--border-radius) * 2);

    span {
        color: #d6a939 !important;
    }

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
    return (
        <Mention>
            <UserShort
                showServerIdentity
                user={clientController.getAvailableClient().users.get(match)}
            />
        </Mention>
    );
}

const EveryoneMention = styled.span`
    padding: 0 6px;
    flex-shrink: 0;

    /* Same box as the user mention above. That one is inline-flex, so its
       pill fills the line box; a plain inline span's background only covers
       the glyph metrics, which made this pill noticeably shorter. */
    align-items: center;
    display: inline-flex;
    vertical-align: middle;

    font-weight: 600;
    cursor: pointer;
    /* Mention pill: gold text on a dark olive pill. */
    color: #d6a939;
    background: #312d1d;
    border-radius: calc(var(--border-radius) * 2);

    transition: 0.1s ease filter;

    &:hover {
        filter: brightness(0.75);
    }
`;

export function RenderEveryoneMention() {
    return <EveryoneMention>@everyone</EveryoneMention>;
}

export const remarkMention = createComponent("mention", RE_MENTIONS, (match) =>
    clientController.getAvailableClient().users.has(match),
);

export const remarkEveryone = createComponent(
    "everyone",
    RE_EVERYONE,
    () => true,
);

/** Find a role by id across all known servers (role ids are unique ULIDs). */
function findRole(id: string) {
    for (const server of clientController
        .getAvailableClient()
        .servers.values()) {
        const role = server.roles?.[id];
        if (role) return role;
    }
}

const RoleMention = styled.span<{ colour?: string | null }>`
    padding: 0 6px;
    flex-shrink: 0;

    align-items: center;
    display: inline-flex;
    vertical-align: middle;

    font-weight: 600;
    cursor: pointer;
    /* Mention pill: role colour (fallback gold) on a dark olive pill. */
    color: ${(props) =>
        props.colour && !props.colour.includes("gradient")
            ? props.colour
            : "#d6a939"};
    background: #312d1d;
    border-radius: calc(var(--border-radius) * 2);

    transition: 0.1s ease filter;

    &:hover {
        filter: brightness(0.75);
    }
`;

export function RenderRoleMention({ match }: CustomComponentProps) {
    const role = findRole(match);
    if (!role) return null;

    return <RoleMention colour={role.colour}>{`@${role.name}`}</RoleMention>;
}

export const remarkRoleMention = createComponent(
    "rolemention",
    RE_ROLE_MENTIONS,
    (match) => findRole(match) !== undefined,
);
