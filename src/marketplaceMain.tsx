import "./styles/marketplace-entry.css";

import { render } from "preact";
import { lazy, Suspense } from "preact/compat";
import { useState } from "preact/hooks";

import MarketplaceLogin from "./pages/login/MarketplaceLogin";

const MarketplaceAuthentication = lazy(
    () => import("./pages/login/MarketplaceAuthentication"),
);

function Authentication({
    onAuthenticated,
}: {
    onAuthenticated: (session: unknown) => void;
}) {
    const [requested, setRequested] = useState(false);

    if (!requested) {
        return (
            <button
                className="marketplace-auth-request"
                type="button"
                onClick={() => setRequested(true)}>
                Continue to PepChat sign in
            </button>
        );
    }

    return (
        <Suspense fallback={<p role="status">Loading secure sign in…</p>}>
            <MarketplaceAuthentication onAuthenticated={onAuthenticated} />
        </Suspense>
    );
}

function MarketplaceLegalLinks() {
    return (
        <nav className="marketplace-legal-links" aria-label="Legal">
            <a
                href="https://copper-mildrid-58.tiiny.site"
                target="_blank"
                rel="noreferrer">
                Acceptable Usage Policy
            </a>
            <a
                href="https://emerald-theresita-57.tiiny.site"
                target="_blank"
                rel="noreferrer">
                Terms of Service
            </a>
            <a
                href="https://crimson-elena-61.tiiny.site"
                target="_blank"
                rel="noreferrer">
                Privacy Policy
            </a>
        </nav>
    );
}

function MarketplaceApp() {
    const [pepchatSession, setPepchatSession] = useState<unknown>();

    return (
        <MarketplaceLogin
            authentication={
                <Authentication
                    onAuthenticated={(session) =>
                        setPepchatSession(() => session)
                    }
                />
            }
            loggedIn={Boolean(pepchatSession)}
            getPepchatSession={() => pepchatSession}
            locale={
                <select aria-label="Marketplace language" defaultValue="en">
                    <option value="en">English</option>
                </select>
            }
            legal={<MarketplaceLegalLinks />}
            logoSrc="/assets/wide.svg"
        />
    );
}

render(<MarketplaceApp />, document.getElementById("app")!);
