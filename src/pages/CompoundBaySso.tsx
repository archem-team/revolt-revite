import { useEffect, useState } from "preact/hooks";
import { useLocation } from "react-router-dom";

import { useClient } from "../controllers/client/ClientController";
import { requestCompoundBayRedirect } from "../lib/compoundBaySso";
import { BACKEND_API_BASE } from "./directory/types";

import "./CompoundBaySso.scss";

export default function CompoundBaySso() {
    const client = useClient();
    const location = useLocation();
    const [message, setMessage] = useState("Confirming your PepChat identity…");
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const returnUrl = new URLSearchParams(location.search).get("return_to");
        if (!returnUrl) {
            setFailed(true);
            setMessage("This Compound Bay sign-in request is incomplete.");
            return;
        }

        const controller = new AbortController();
        void requestCompoundBayRedirect({
            apiBase: BACKEND_API_BASE,
            session: client.session,
            returnUrl,
            signal: controller.signal,
        })
            .then((redirectUrl) => window.location.assign(redirectUrl))
            .catch((error) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setFailed(true);
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "PepChat sign-in is temporarily unavailable.",
                );
            });

        return () => controller.abort();
    }, [client, location.search]);

    return (
        <main className="compound-bay-sso">
            <section>
                <h1>{failed ? "Sign-in unavailable" : "Opening Compound Bay"}</h1>
                <p role="status" aria-live="polite">
                    {message}
                </p>
                {failed && <a href="/">{"Return to PepChat"}</a>}
            </section>
        </main>
    );
}
