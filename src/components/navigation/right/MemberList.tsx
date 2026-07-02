import { Link } from "react-router-dom";
import { GroupedVirtuoso } from "react-virtuoso";
import { Channel, User } from "revolt.js";
import styled, { css } from "styled-components/macro";

import { Text } from "preact-i18n";
import { memo } from "preact/compat";

import { internalEmit } from "../../../lib/eventEmitter";

import { modalController } from "../../../controllers/modals/ModalController";
import { UserButton } from "../items/ButtonItem";

export type MemberListGroup = {
    type: "online" | "offline" | "role" | "no_offline";
    name?: string;
    users: User[];
};

const ListCategory = styled.div<{ first?: boolean }>`
    opacity: 0.8;
    font-size: 0.8em;
    font-weight: 600;
    user-select: none;

    padding: 4px 14px;
    padding-top: 12px;

    color: var(--secondary-foreground);
    /* Role-group headers are plain text on the canvas.
       They stay opaque (canvas colour, not transparent) because virtuoso pins
       them as sticky headers over the scrolling rows. */
    background: var(--background);

    ${(props) =>
        !props.first &&
        css`
            /* Generous whitespace between role groups. */
            padding-top: 22px;
        `}
`;

// ! FIXME: temporary performance fix
const NoOomfie = styled.div`
    padding: 4px;
    padding-bottom: 12px;

    font-size: 0.8em;
    text-align: center;
    color: var(--secondary-foreground);

    flex-direction: column;
    display: flex;
    gap: 4px;
`;

const ItemContent = memo(
    ({ item, context }: { item: User; context: Channel }) => (
        <UserButton
            key={item._id}
            user={item}
            margin
            context={context}
            onClick={(e) => {
                if (e.shiftKey) {
                    internalEmit(
                        "MessageBox",
                        "append",
                        `<@${item._id}>`,
                        "mention",
                    );
                } else {
                    modalController.push({
                        type: "user_profile",
                        user_id: item._id,
                    });
                }
            }}
        />
    ),
);

export default function MemberList({
    entries,
    context,
}: {
    entries: MemberListGroup[];
    context: Channel;
}) {
    return (
        <GroupedVirtuoso
            groupCounts={entries.map((x) => x.users.length)}
            groupContent={(index) => {
                const entry = entries[index];
                return (
                    <ListCategory first={index === 0}>
                        {entry.type === "role" ? (
                            <>{entry.name}</>
                        ) : entry.type === "online" ? (
                            <Text id="app.status.online" />
                        ) : (
                            <Text id="app.status.offline" />
                        )}
                        {entry.type !== "no_offline" && (
                            <>
                                {" – "}
                                {entry.users.length}
                            </>
                        )}
                    </ListCategory>
                );
            }}
            itemContent={(absoluteIndex, groupIndex) => {
                const relativeIndex =
                    absoluteIndex -
                    entries
                        .slice(0, groupIndex)
                        .reduce((a, b) => a + b.users.length, 0);

                const entry = entries[groupIndex];
                if (entry.type === "no_offline") {
                    return (
                        <NoOomfie>
                            <div>
                                Offline users have temporarily been disabled for
                                larger servers - see{" "}
                                <a
                                    href="https://github.com/revoltchat/backend/issues/178"
                                    target="_blank"
                                    rel="noreferrer">
                                    issue #178
                                </a>{" "}
                                for when this will be resolved.
                            </div>
                            <div>
                                You may re-enable them{" "}
                                <Link to="/settings/experiments">
                                    <a>here</a>
                                </Link>
                                .
                            </div>
                        </NoOomfie>
                    );
                }

                const item = entry.users[relativeIndex];
                if (!item) return null;

                return (
                    <div>
                        <ItemContent item={item} context={context} />
                    </div>
                );
            }}
        />
    );
}
