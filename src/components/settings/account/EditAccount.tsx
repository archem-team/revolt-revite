import { At } from "@styled-icons/boxicons-regular";
import { Envelope, Key, Pencil, Phone, CheckCircle } from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";

import { Text } from "preact-i18n";
import { useEffect, useState } from "preact/hooks";

import {
    AccountDetail,
    CategoryButton,
    Column,
    HiddenValue,
} from "@revoltchat/ui";

import { useSession } from "../../../controllers/client/ClientController";
import { modalController } from "../../../controllers/modals/ModalController";

export default observer(() => {
    const session = useSession()!;
    const client = session.client!;

    const [email, setEmail] = useState("...");

    useEffect(() => {
        if (email === "..." && session.state === "Online") {
            client.api
                .get("/auth/account/")
                .then((account) => setEmail(account.email));
        }
    }, [client, email, session.state]);

    return (
        <>
            <Column group>
                <AccountDetail user={client.user!} />
            </Column>

            {(
                [
                    [
                        "username",
                        client.user!.username +
                        "#" +
                        client.user!.discriminator,
                        At,
                    ],
                    ["email", email, Envelope],
                    ["password", "•••••••••", Key],
                ] as const
            ).map(([field, value, Icon]) => (
                <CategoryButton
                    key={field}
                    icon={<Icon size={24} />}
                    description={
                        field === "email" ? (
                            <HiddenValue
                                value={value}
                                placeholder={"•••••••••••@••••••.•••"}
                            />
                        ) : (
                            value
                        )
                    }
                    account
                    action={<Pencil size={20} />}
                    onClick={() =>
                        modalController.push({
                            type: "modify_account",
                            client,
                            field,
                        })
                    }>
                    <Text id={`login.${field}`} />
                </CategoryButton>
            ))}

            {/* Phone Verification */}
            <CategoryButton
                icon={<Phone size={24} />}
                description={
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {(client.user as any)?.phone_verified ? (
                            <>
                                <CheckCircle size={16} style={{ color: "var(--success)" }} />
                                <span style={{ color: "var(--success)" }}>
                                    <Text id="app.settings.pages.account.phone.phone_verified" />
                                </span>
                            </>
                        ) : (
                            <span style={{ color: "var(--warning)" }}>
                                <Text id="app.settings.pages.account.phone.phone_not_verified" />
                            </span>
                        )}
                    </div>
                }
                account
                action={<Pencil size={20} />}
                onClick={() =>
                    modalController.push({
                        type: "phone_verification",
                        client,
                    })
                }>
                <Text id="app.settings.pages.account.phone.phone_verification" />
            </CategoryButton>
        </>
    );
});
