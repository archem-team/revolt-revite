import { render } from "preact";

import MarketplaceAuthentication from "./pages/login/MarketplaceAuthentication";
import "./styles/marketplace-entry.css";

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
    return (
        <MarketplaceAuthentication
            locale={
                <select aria-label="Marketplace language" value="en">
                    <option value="en">English</option>
                </select>
            }
            legal={<MarketplaceLegalLinks />}
            logoSrc="/assets/wide.svg"
        />
    );
}

render(<MarketplaceApp />, document.getElementById("app")!);
