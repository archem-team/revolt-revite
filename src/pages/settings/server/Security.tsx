import { Shield } from "@styled-icons/boxicons-solid";
import isEqual from "lodash.isequal";
import { observer } from "mobx-react-lite";
import { Server } from "revolt.js";

import styles from "./Panes.module.scss";
import { Text } from "preact-i18n";
import { useEffect, useState } from "preact/hooks";

import { Button, Checkbox, InputBox } from "@revoltchat/ui";

import { noop } from "../../../lib/js";

interface Props {
    server: Server;
}

export const Security = observer(({ server }: Props) => {
    const [requirePhoneVerified, setRequirePhoneVerified] = useState(
        (server as any)?.security?.require_phone_verified ?? false,
    );
    const [minAccountAge, setMinAccountAge] = useState(
        (server as any)?.security?.min_account_age ?? null,
    );

    useEffect(
        () =>
            setRequirePhoneVerified(
                (server as any)?.security?.require_phone_verified ?? false,
            ),
        [(server as any)?.security?.require_phone_verified],
    );

    useEffect(
        () =>
            setMinAccountAge(
                (server as any)?.security?.min_account_age ?? null,
            ),
        [(server as any)?.security?.min_account_age],
    );

    const [changed, setChanged] = useState(false);

    function save() {
        const security = {
            require_phone_verified: requirePhoneVerified,
            min_account_age:
                minAccountAge && minAccountAge > 0 ? minAccountAge : null,
        };

        const currentSecurity = (server as any)?.security ?? {};
        if (!isEqual(security, currentSecurity)) {
            server.edit({ security }).then(noop);
            setChanged(false);
        }
    }

    useEffect(() => {
        const currentSecurity = (server as any)?.security ?? {};
        const newSecurity = {
            require_phone_verified: requirePhoneVerified,
            min_account_age:
                minAccountAge && minAccountAge > 0 ? minAccountAge : null,
        };

        if (!isEqual(newSecurity, currentSecurity)) {
            if (!changed) setChanged(true);
        } else {
            if (changed) setChanged(false);
        }
    }, [requirePhoneVerified, minAccountAge, changed, server]);

    return (
        <div className={styles.overview}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "20px",
                }}>
                <Shield size={32} />
                <div>
                    <h2 style={{ margin: 0 }}>
                        <Text id="app.settings.server_pages.security.title" />
                    </h2>
                    <p
                        style={{
                            margin: "4px 0 0 0",
                            color: "var(--secondary-foreground)",
                            fontSize: "0.875rem",
                        }}>
                        <Text id="app.settings.server_pages.security.description" />
                    </p>
                </div>
            </div>

            <hr />

            <h3>
                <Text id="app.settings.server_pages.security.phone_verification" />
            </h3>
            <Checkbox
                value={requirePhoneVerified}
                onChange={(value) => {
                    setRequirePhoneVerified(value);
                    if (!changed) setChanged(true);
                }}
                title={
                    <Text id="app.settings.server_pages.security.require_phone_verification" />
                }
                description={
                    <Text id="app.settings.server_pages.security.require_phone_verification_desc" />
                }
            />

            <hr />

            <h3>
                <Text id="app.settings.server_pages.security.minimum_account_age" />
            </h3>
            <div style={{ marginBottom: "12px" }}>
                <label
                    style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "0.875rem",
                    }}>
                    <Text id="app.settings.server_pages.security.minimum_account_age_label" />
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <InputBox
                        type="number"
                        value={minAccountAge?.toString() ?? ""}
                        min="0"
                        max="3650"
                        palette="secondary"
                        onChange={(e) => {
                            const value = e.currentTarget.value
                                ? parseInt(e.currentTarget.value)
                                : null;
                            setMinAccountAge(value);
                            if (!changed) setChanged(true);
                        }}
                        placeholder="0"
                        style={{ maxWidth: "120px" }}
                    />
                    <span style={{ color: "var(--secondary-foreground)" }}>
                        <Text id="app.settings.server_pages.security.days" />
                    </span>
                </div>
                <p
                    style={{
                        marginTop: "8px",
                        color: "var(--secondary-foreground)",
                        fontSize: "0.875rem",
                    }}>
                    <Text id="app.settings.server_pages.security.minimum_account_age_desc" />
                </p>
            </div>

            <hr />

            <p>
                <Button onClick={save} palette="secondary" disabled={!changed}>
                    <Text id="app.special.modals.actions.save" />
                </Button>
            </p>
        </div>
    );
});
