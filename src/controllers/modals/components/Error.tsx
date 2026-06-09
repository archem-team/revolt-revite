import { Text } from "preact-i18n";

import { Modal } from "@revoltchat/ui";

import { noopTrue } from "../../../lib/js";

import { ModalProps } from "../types";

export default function Error({ error, ...props }: ModalProps<"error">) {
    return (
        <Modal
            {...props}
            title={<Text id="app.special.modals.error" />}
            actions={[
                {
                    onClick: noopTrue,
                    confirmation: true,
                    style: { background: "#363636" },
                    children: <Text id="app.special.modals.actions.ok" />,
                },
                {
                    palette: "plain-secondary",
                    onClick: () => location.reload(),
                    style: { background: "#363636" },
                    children: <Text id="app.special.modals.actions.reload" />,
                },
            ]}>
            <Text id={`error.${error}`}>{error}</Text>
        </Modal>
    );
}
