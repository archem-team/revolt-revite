import { XCircle } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { Servers, Users } from "revolt.js/dist/api/objects";
import { Route } from "revolt.js/dist/api/routes";

import styles from "./Panes.module.scss";
import { Text } from "preact-i18n";
import { useContext, useEffect, useState } from "preact/hooks";

import { Server } from "../../../mobx";

import { AppContext } from "../../../context/revoltjs/RevoltClient";

import UserIcon from "../../../components/common/user/UserIcon";
import IconButton from "../../../components/ui/IconButton";
import Preloader from "../../../components/ui/Preloader";

interface Props {
    server: Server;
}

export const Bans = observer(({ server }: Props) => {
    const client = useContext(AppContext);
    const [deleting, setDelete] = useState<string[]>([]);
    const [data, setData] = useState<
        Route<"GET", "/servers/id/bans">["response"] | undefined
    >(undefined);

    useEffect(() => {
        client.servers.fetchBans(server._id).then(setData as any);
    }, []);

    return (
        <div className={styles.userList}>
            <div className={styles.subtitle}>
                <span>
                    <Text id="app.settings.server_pages.bans.user" />
                </span>
                <span class={styles.reason}>
                    <Text id="app.settings.server_pages.bans.reason" />
                </span>
                <span>
                    <Text id="app.settings.server_pages.bans.revoke" />
                </span>
            </div>
            {typeof data === "undefined" && <Preloader type="ring" />}
            {data?.bans.map((x) => {
                let user = data.users.find((y) => y._id === x._id.user);

                return (
                    <div
                        className={styles.ban}
                        data-deleting={deleting.indexOf(x._id.user) > -1}>
                        <span>
                            <UserIcon attachment={user?.avatar} size={24} />
                            {user?.username}
                        </span>
                        <div className={styles.reason}>
                            {x.reason ?? (
                                <Text id="app.settings.server_pages.bans.no_reason" />
                            )}
                        </div>
                        <IconButton
                            onClick={async () => {
                                setDelete([...deleting, x._id.user]);

                                await client.servers.unbanUser(
                                    server._id,
                                    x._id.user,
                                );

                                setData({
                                    ...data,
                                    bans: data.bans.filter(
                                        (y) => y._id.user !== x._id.user,
                                    ),
                                });
                            }}
                            disabled={deleting.indexOf(x._id.user) > -1}>
                            <XCircle size={24} />
                        </IconButton>
                    </div>
                );
            })}
        </div>
    );
});
