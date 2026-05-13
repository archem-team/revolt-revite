import { ArrowBack } from "@styled-icons/boxicons-regular";
import { Redirect, useHistory, useParams } from "react-router-dom";
import { API } from "revolt.js";

import styles from "./Invite.module.scss";
import { Text } from "preact-i18n";
import { useEffect, useState } from "preact/hooks";

import { Button, Category, Error, Preloader } from "@revoltchat/ui";

import { TextReact } from "../../lib/i18n";
import { hasServerJoinApproval } from "../../lib/serverFlags";

import { useApplicationState } from "../../mobx/State";

import ServerIcon from "../../components/common/ServerIcon";
import UserIcon from "../../components/common/user/UserIcon";
import {
    useClient,
    useSession,
} from "../../controllers/client/ClientController";
import RequiresOnline from "../../controllers/client/jsx/RequiresOnline";
import { takeError } from "../../controllers/client/jsx/error";

export default function Invite() {
    const history = useHistory();
    const session = useSession();
    const client = useClient();

    const layout = useApplicationState().layout;

    const { code } = useParams<{ code: string }>();
    const [processing, setProcessing] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [invite, setInvite] = useState<API.InviteResponse | undefined>(
        undefined,
    );

    useEffect(() => {
        if (typeof invite === "undefined") {
            client
                .fetchInvite(code)
                .then((data) => setInvite(data))
                .catch((err) => setError(takeError(err)));
        }
    }, [code, invite]);

    if (code === undefined) return <Redirect to={layout.getLastPath()} />;

    if (typeof invite === "undefined") {
        return (
            <div className={styles.preloader}>
                <RequiresOnline>
                    {error ? (
                        <div
                            className={styles.invite}
                            style={{
                                backgroundImage: `url('https://autumn.revolt.chat/banners/yMurJiXf45VJpbal0X2zQkm4vaXsXGaRtoPUIcvPcH')`,
                                width: "100%",
                                height: "100%",
                            }}>
                            <div className={styles.details}>
                                <h1>
                                    <Text id="app.special.invite.invalid" />
                                </h1>
                                <h2>
                                    <Text id="app.special.invite.invalid_desc" />
                                </h2>
                                <div style="cursor: pointer;">
                                    <Button palette="secondary">
                                        <ArrowBack
                                            size={32}
                                            onClick={() =>
                                                history.push(
                                                    layout.getLastPath(),
                                                )
                                            }
                                        />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Preloader type="spinner" />
                    )}
                </RequiresOnline>
            </div>
        );
    }

    if (invite.type === "Group") return <h1>unimplemented</h1>;

    const approvalRequired = hasServerJoinApproval(invite.server_flags);

    if (pendingApproval) {
        return (
            <div
                className={styles.invite}
                style={{
                    backgroundImage: invite.server_banner
                        ? `url('${client?.generateFileURL(invite.server_banner)}')`
                        : undefined,
                }}>
                <div className={styles.details}>
                    <h1>{invite.server_name}</h1>
                    <h2>
                        <TextReact
                            id="app.special.invite.approval_pending"
                            fields={{ server: invite.server_name }}
                        />
                    </h2>
                    <Category>
                        <TextReact
                            id="app.special.invite.approval_pending_desc"
                            fields={{ channel: invite.channel_name }}
                        />
                    </Category>
                    <Button
                        palette="secondary"
                        onClick={() => history.push("/")}>
                        <TextReact id="app.special.invite.go_home" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={styles.invite}
            style={{
                backgroundImage: invite.server_banner
                    ? `url('${client?.generateFileURL(invite.server_banner)}')`
                    : undefined,
            }}>
            <div className={styles.leave}>
                <ArrowBack
                    size={32}
                    onClick={() => history.push(layout.getLastPath())}
                />
            </div>

            {!processing && (
                <div className={styles.icon}>
                    <ServerIcon
                        attachment={invite.server_icon}
                        server_name={invite.server_name}
                        size={64}
                    />
                </div>
            )}

            <div className={styles.details}>
                {processing ? (
                    <Preloader type="ring" />
                ) : (
                    <>
                        <h1>{invite.server_name}</h1>
                        <h2>
                            #{invite.channel_name} •{" "}
                            <Text
                                id="app.special.invite.user_count"
                                fields={{
                                    member_count: invite.member_count,
                                }}
                            />
                        </h2>
                        {approvalRequired && (
                            <Category>
                                <TextReact id="app.special.invite.approval_required" />
                            </Category>
                        )}
                        <h3>
                            <TextReact
                                id="app.special.invite.invited_by"
                                fields={{
                                    user: (
                                        <>
                                            <UserIcon
                                                size={24}
                                                attachment={invite.user_avatar}
                                            />{" "}
                                            {invite.user_name}
                                        </>
                                    ),
                                }}
                            />
                        </h3>
                        <Category>
                            <Error error={error} />
                        </Category>
                        <Button
                            palette="secondary"
                            onClick={async () => {
                                if (!session) {
                                    return history.push("/");
                                }

                                setProcessing(true);

                                try {
                                    await client.joinInvite(invite);

                                    if (approvalRequired) {
                                        setPendingApproval(true);
                                        return;
                                    }

                                    history.push(
                                        `/server/${invite.server_id}/channel/${invite.channel_id}`,
                                    );
                                } catch (err) {
                                    setError(takeError(err));
                                } finally {
                                    setProcessing(false);
                                }
                            }}>
                            {!session ? (
                                <Text id="app.special.invite.login" />
                            ) : (
                                <Text id="app.special.invite.accept" />
                            )}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
