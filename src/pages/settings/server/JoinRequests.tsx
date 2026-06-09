import isEqual from "lodash.isequal";
import { observer } from "mobx-react-lite";
import { Member } from "revolt.js";
import { Server } from "revolt.js";

import styles from "./Panes.module.scss";
import { Text } from "preact-i18n";
import { useEffect, useMemo, useState } from "preact/hooks";

import { Button, Category, Checkbox, Preloader } from "@revoltchat/ui";

import UserIcon from "../../../components/common/user/UserIcon";
import { Username } from "../../../components/common/user/UserShort";
import { hasServerJoinApproval } from "../../../lib/serverFlags";

interface InnerProps {
    member: Member;
    removeSelf: () => void;
}

const Inner = observer(({ member, removeSelf }: InnerProps) => {
    const [roles, setRoles] = useState<string[]>(member.roles ?? []);

    useEffect(() => {
        setRoles(member.roles ?? []);
    }, [member.roles]);

    const serverRoles = member.server?.roles ?? {};

    return (
        <>
            <div className={styles.member} data-open>
                <span>
                    <UserIcon target={member.user} size={24} />{" "}
                    <Username user={member.user} showServerIdentity="both" />
                </span>
                <span title={member.joined_at.toLocaleString()}>
                    {member.joined_at.toLocaleDateString()}
                </span>
                <Button
                    palette="secondary"
                    disabled={isEqual(member.roles ?? [], roles)}
                    onClick={() =>
                        member.edit({ roles }).then(() => {
                            removeSelf();
                        })
                    }>
                    <Text id="app.settings.server_pages.join_requests.approve" />
                </Button>
                <Button
                    palette="error"
                    onClick={() =>
                        member.kick().then(() => {
                            removeSelf();
                        })
                    }>
                    <Text id="app.settings.server_pages.join_requests.deny" />
                </Button>
            </div>
            <div className={styles.memberView}>
                <Category>
                    <Text id="app.settings.server_pages.join_requests.roles" />
                </Category>
                {Object.keys(serverRoles).map((key) => {
                    const role = serverRoles[key];

                    return (
                        <Checkbox
                            key={key}
                            value={roles.includes(key) ?? false}
                            title={
                                <span
                                    style={{
                                        color: role.colour!,
                                    }}>
                                    {role.name}
                                </span>
                            }
                            onChange={(value) => {
                                if (value) {
                                    setRoles([...roles, key]);
                                } else {
                                    setRoles(roles.filter((x) => x !== key));
                                }
                            }}
                        />
                    );
                })}
            </div>
        </>
    );
});

interface Props {
    server: Server;
}

export const JoinRequests = observer(({ server }: Props) => {
    const [members, setMembers] = useState<Member[] | undefined>(undefined);

    useEffect(() => {
        server
            .fetchMembers()
            .then((data) => data.members)
            .then(setMembers);
    }, [server, setMembers]);

    const requests = useMemo(() => {
        if (!members) return undefined;

        if (!hasServerJoinApproval(server.flags)) return [];

        return [...members]
            .filter(
                (member) =>
                    member._id.user !== server.owner &&
                    (member.roles?.length ?? 0) === 0,
            )
            .sort((a, b) => +b.joined_at - +a.joined_at);
    }, [members, server.flags, server.owner]);

    return (
        <div className={styles.userList}>
            <div className={styles.subtitle}>
                <span>
                    <Text id="app.settings.server_pages.join_requests.user" />
                </span>
                <span>
                    <Text id="app.settings.server_pages.join_requests.joined" />
                </span>
                <span>
                    <Text id="app.settings.server_pages.join_requests.actions" />
                </span>
            </div>
            {!hasServerJoinApproval(server.flags) ? (
                <div className={styles.memberView}>
                    <Category>
                        <Text id="app.settings.server_pages.join_requests.disabled" />
                    </Category>
                    <p>
                        <Text id="app.settings.server_pages.join_requests.disabled_desc" />
                    </p>
                </div>
            ) : typeof requests === "undefined" ? (
                <Preloader type="ring" />
            ) : requests.length === 0 ? (
                <div className={styles.memberView}>
                    <Category>
                        <Text id="app.settings.server_pages.join_requests.empty" />
                    </Category>
                </div>
            ) : (
                <div className={styles.virtual}>
                    {requests.map((member) => (
                        <Inner
                            key={`${member._id.server}:${member._id.user}`}
                            member={member}
                            removeSelf={() =>
                                setMembers(
                                    members.filter(
                                        (x) =>
                                            x._id.server !== member._id.server ||
                                            x._id.user !== member._id.user,
                                    ),
                                )
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
});