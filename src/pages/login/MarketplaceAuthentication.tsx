import { observer } from "mobx-react-lite";
import { useEffect } from "preact/hooks";

import { AuthenticationCard } from "./Login";
import Context from "../../context";
import { clientController } from "../../controllers/client/ClientController";

const AuthenticationContent = observer(
    ({ onAuthenticated }: { onAuthenticated: (session: unknown) => void }) => {
        const loggedIn = clientController.isLoggedIn();

        useEffect(() => {
            if (loggedIn) {
                onAuthenticated(clientController.getActiveSessionToken());
            }
        }, [loggedIn, onAuthenticated]);

        return loggedIn ? (
            <p role="status">PepChat identity confirmed.</p>
        ) : (
            <AuthenticationCard marketplace />
        );
    },
);

export default function MarketplaceAuthentication({
    onAuthenticated,
}: {
    onAuthenticated: (session: unknown) => void;
}) {
    return (
        <Context>
            <AuthenticationContent onAuthenticated={onAuthenticated} />
        </Context>
    );
}
