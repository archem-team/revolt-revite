import { TimeFive } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import { User, API } from "revolt.js";
import styled, { css } from "styled-components/macro";
import { decodeTime } from "ulid";

import { Ref } from "preact";
import { Text } from "preact-i18n";

import { internalEmit } from "../../../lib/eventEmitter";

import { dayjs } from "../../../context/Locale";

import { useClient } from "../../../controllers/client/ClientController";
import { modalController } from "../../../controllers/modals/ModalController";
import Tooltip from "../Tooltip";
import UserIcon from "./UserIcon";

// Configuration constant for easy adjustment
const NEW_MEMBER_THRESHOLD_DAYS = 14;

// Vendor badge flags - reusing existing enum values
const TRUSTED_SELLER_BADGE = 8; // ResponsibleDisclosure
const VERIFIED_VENDOR_BADGE = 512; // ReservedRelevantJokeBadge1
// NOTE: ReservedRelevantJokeBadge2 (1024) is rendered as "Gump" in the full badge
// list (`src/components/common/user/UserBadges.tsx`). It should not trigger the
// compact "Verified Vendor" indicator next to usernames.
const VERIFIED_MANUFACTURER_BADGE = 0;

// Combined mask to check for any vendor badge
const VENDOR_BADGES_MASK = TRUSTED_SELLER_BADGE | VERIFIED_VENDOR_BADGE;

const BotBadge = styled.div`
    display: inline-block;
    flex-shrink: 0;
    /* The line box sets the pill height, so the label stays centred whatever
       the author row's line-height is (the .detail row runs a 20px box). */
    line-height: 1.4em;
    padding: 0 6px;
    /* Absolute, not em-relative: at 0.6em the same badge rendered ~8.4px in a
       message row but ~6.7px in the member list (whose rows are 0.8em). */
    font-size: 0.625rem;
    font-weight: 700;
    /* Small uppercase text needs a little tracking to stay readable. */
    letter-spacing: 0.03em;
    user-select: none;
    text-transform: uppercase;
    color: var(--accent-contrast);
    background: var(--accent);
    border-radius: var(--radius-pill);
`;

const LOTUS_MASK =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8.55 12zm10.43-1.61zm-3.49-.76c-.18-2.79-1.31-5.51-3.43-7.63a12.188 12.188 0 0 0-3.55 7.63c1.28.68 2.46 1.56 3.49 2.63 1.03-1.06 2.21-1.94 3.49-2.63zm-6.5 2.65c-.14-.1-.3-.19-.45-.29.15.11.31.19.45.29zm6.42-.25c-.13.09-.27.16-.4.26.13-.1.27-.17.4-.26zM12 15.45C9.85 12.17 6.18 10 2 10c0 5.32 3.36 9.82 8.03 11.49.63.23 1.29.4 1.97.51.68-.12 1.33-.29 1.97-.51C18.64 19.82 22 15.32 22 10c-4.18 0-7.85 2.17-10 5.45z'/%3E%3C/svg%3E";

/* Stoat's new-user mark: the Material Symbols "spa" lotus, filled, at 16px
   (Message.tsx -> <Symbol size={16} fill>spa</Symbol>). revite ships boxicons
   only, so the glyph is inlined rather than adding a Material icon package for
   one path.

   Stoat tints it --md-sys-color-primary, which in an M3 dark scheme is a light
   tone-80 purple. Our --accent is the raw brand purple (tone 31) and would sit
   at ~2:1 here, so the accent is lifted toward the foreground instead — the
   same hue, light enough to read on both the sidebar and the chat panel. */
const NewHereBadge = styled.span`
    display: inline-block;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    vertical-align: middle;
    background-color: color-mix(
        in srgb,
        var(--accent),
        var(--foreground) 45%
    );
    -webkit-mask: url("${LOTUS_MASK}") center / contain no-repeat;
    mask: url("${LOTUS_MASK}") center / contain no-repeat;
`;

const TrustedSellerBadge = styled.img`
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    vertical-align: middle;
`;

const BadgeWrapper = styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
    /* Lets the row shrink inside a narrow column (member list, DM sidebar) so
       the name elides rather than the trailing badge being clipped away. */
    min-width: 0;

    /* Only the name (first child) yields. Everything after it is a badge or a
       Tooltip wrapper around one — and Tooltip renders a plain <div> with no
       flex-shrink of its own, so pin them here rather than on each badge. */
    > *:not(:first-child) {
        flex-shrink: 0;
    }
`;

type UsernameProps = Omit<
    JSX.HTMLAttributes<HTMLElement>,
    "children" | "as"
> & {
    user?: User;
    prefixAt?: boolean;
    masquerade?: API.Masquerade;
    showServerIdentity?: boolean | "both";

    override?: string;
    innerRef?: Ref<any>;
};

const Name = styled.span<{ colour?: string | null }>`
    /* The name is what yields when space runs out — badges after it carry
       flex-shrink: 0 and stay put. */
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    ${(props) =>
        props.colour &&
        (props.colour.includes("gradient")
            ? css`
                  background: ${props.colour};
                  background-clip: text;
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
              `
            : css`
                  color: ${props.colour};
              `)}
`;

export const Username = observer(
    ({
        user,
        prefixAt,
        masquerade,
        showServerIdentity,
        innerRef,
        override,
        ...otherProps
    }: UsernameProps) => {
        let username =
            (user as unknown as { display_name: string })?.display_name ??
            user?.username;
        let color = masquerade?.colour;
        let timed_out: Date | undefined;
        let isNewHere = false;

        if (override) {
            username = override;
        } else if (user && showServerIdentity) {
            const { server } = useParams<{ server?: string }>();
            if (server) {
                const client = useClient();
                const member = client.members.getKey({
                    server,
                    user: user._id,
                });

                if (member) {
                    if (member.nickname) {
                        if (showServerIdentity === "both") {
                            username = `${member.nickname} (${username})`;
                        } else {
                            username = member.nickname;
                        }
                    }

                    if (member.timeout) {
                        timed_out = member.timeout;
                    }

                    if (!color) {
                        for (const [_, { colour }] of member.orderedRoles) {
                            if (colour) {
                                color = colour;
                            }
                        }
                    }
                }
            }
        }

        // Check if user account is new
        if (user) {
            // Extract account creation timestamp from user ID (ULID)
            const accountCreatedAt = decodeTime(user._id);
            const accountAge = dayjs().diff(dayjs(accountCreatedAt), "day");
            isNewHere = accountAge <= NEW_MEMBER_THRESHOLD_DAYS;
        }

        // Check if user has any vendor badge
        const hasVendorBadge =
            user && user.badges && user.badges & VENDOR_BADGES_MASK;

        const el = (
            <>
                <Name {...otherProps} ref={innerRef} colour={color}>
                    {prefixAt ? "@" : undefined}
                    {masquerade?.name ?? username ?? (
                        <Text id="app.main.channel.unknown_user" />
                    )}
                </Name>

                {timed_out && (
                    <Tooltip
                        content={
                            <Text
                                id="app.main.channel.user_timed_out"
                                fields={{
                                    time: dayjs(timed_out).fromNow(true),
                                }}
                            />
                        }>
                        <TimeFive
                            size={16}
                            color="var(--secondary-foreground)"
                        />
                    </Tooltip>
                )}
            </>
        );

        if (user?.bot) {
            return (
                <BadgeWrapper>
                    {el}
                    <BotBadge>
                        {masquerade ? (
                            <Text id="app.main.channel.bridge" />
                        ) : (
                            <Text id="app.main.channel.bot" />
                        )}
                    </BotBadge>
                </BadgeWrapper>
            );
        }

        if (override) {
            return (
                <BadgeWrapper>
                    {el}
                    <BotBadge>
                        <Text id="app.main.channel.bot" />
                    </BotBadge>
                </BadgeWrapper>
            );
        }

        // Add new member badge for users with new accounts
        if (isNewHere) {
            return (
                <BadgeWrapper>
                    {el}
                    <Tooltip content="I'm new here!">
                        <NewHereBadge />
                    </Tooltip>
                </BadgeWrapper>
            );
        }

        // Add vendor badge (for any of the three vendor types)
        if (hasVendorBadge) {
            return (
                <BadgeWrapper>
                    {el}
                    <Tooltip content="Verified Vendor">
                        <TrustedSellerBadge src="/assets/badges/verifiedvendor.svg" />
                    </Tooltip>
                </BadgeWrapper>
            );
        }

        return el;
    },
);

export default function UserShort({
    user,
    size,
    prefixAt,
    masquerade,
    showServerIdentity,
}: {
    user?: User;
    size?: number;
    prefixAt?: boolean;
    masquerade?: API.Masquerade;
    showServerIdentity?: boolean;
}) {
    const openProfile = () =>
        user &&
        modalController.push({ type: "user_profile", user_id: user._id });

    const handleUserClick = (e: MouseEvent) => {
        if (e.shiftKey && user?._id) {
            e.preventDefault();
            internalEmit("MessageBox", "append", `<@${user?._id}>`, "mention");
        } else {
            openProfile();
        }
    };

    return (
        <>
            <UserIcon
                target={user}
                size={size ?? 24}
                masquerade={masquerade}
                onClick={handleUserClick}
                showServerIdentity={showServerIdentity}
            />
            <Username
                user={user}
                prefixAt={prefixAt}
                masquerade={masquerade}
                onClick={handleUserClick}
                showServerIdentity={showServerIdentity}
            />
        </>
    );
}
