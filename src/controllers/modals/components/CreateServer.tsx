import { useHistory } from "react-router-dom";
import { useState } from "preact/hooks";

import { Text } from "preact-i18n";

import { ModalForm } from "@revoltchat/ui";

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
    const [isHovering, setIsHovering] = useState(false);

    return (
        <ModalForm
            {...props}
            title={<Text id="app.main.servers.create" />}
            description={
                <div>
                    By creating this server, you agree to the{" "}
                    <a
                        href="https://revolt.chat/aup"
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
                    style: {
                        background: "#1C1720",
                        color: "#fffffd",
                        padding: "11px 16px",
                        border: "1px solid #332e36",
                        borderRadius: "6px",
                        fontSize: "0.9375rem",
                        fontFamily: "inherit",
                        fontWeight: "500",
                        boxSizing: "border-box",
                        outline: "none",
                        width: "100%"
                    } as any
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
                palette: "accent",
            }}
            actions={[
                {
                    onClick: () => true,
                    children: "Cancel",
                    palette: "secondary",
                    style: {
                        background: isHovering ? "#b91c1c" : "#dc2626",
                        color: "#ffffff",
                        transition: "background-color 0.2s ease",
                    },
                    onMouseEnter: () => setIsHovering(true),
                    onMouseLeave: () => setIsHovering(false),
                }
            ]}
        />
    );
}
