import { useHistory } from "react-router-dom";

import { Text } from "preact-i18n";

import { ModalForm } from "@revoltchat/ui";

import { ACCEPTABLE_USE_POLICY_URL } from "../../../config/branding";
import { useClient } from "../../client/ClientController";
import { mapError } from "../../client/jsx/error";
import { ModalProps } from "../types";

/**
 * Server creation modal
 */
export default function CreateServer({
    ...props
}: ModalProps<"create_server">) {
    const history = useHistory();
    const client = useClient();

    return (
        <ModalForm
            {...props}
            title={<Text id="app.main.servers.create" />}
            description={
                <div>
                    By creating this server, you agree to the{" "}
                    <a
                        href={ACCEPTABLE_USE_POLICY_URL}
                        target="_blank"
                        rel="noreferrer">
                        Acceptable Use Policy.
                    </a>
                </div>
            }
            schema={{
                name: "text",
            }}
            data={{
                name: {
                    field: (
                        <Text id="app.main.servers.name" />
                    ) as React.ReactChild,
                },
            }}
            callback={async ({ name }) => {
                const server = await client.servers
                    .createServer({
                        name,
                    })
                    .catch(mapError);

                history.push(`/server/${server._id}`);
            }}
            submit={{
                children: <Text id="app.special.modals.actions.create" />,
            }}
        />
    );
}
