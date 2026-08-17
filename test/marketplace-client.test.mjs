import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatExactAmount } from "../src/lib/paymentAmount.js";

test("payment amounts retain exact digits without insignificant zeroes", () => {
    assert.equal(formatExactAmount("183.400000000000000000"), "183.4");
    assert.equal(formatExactAmount("0.00123000"), "0.00123");
    assert.equal(formatExactAmount("12.000"), "12");
    assert.equal(formatExactAmount("100"), "100");
});

test("marketplace client uses the dedicated production API host", async () => {
    const source = await readFile(
        new URL("../src/lib/marketplace.ts", import.meta.url),
        "utf8",
    );

    assert.match(source, /https:\/\/market\.peptide\.chat/);
    assert.doesNotMatch(source, /https:\/\/vendors\.peptide\.chat/);
});

test("marketplace search exposes server-backed sorting and filters", async () => {
    const [client, page] = await Promise.all([
        readFile(new URL("../src/lib/marketplace.ts", import.meta.url), "utf8"),
        readFile(
            new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
            "utf8",
        ),
    ]);

    for (const parameter of [
        "sort",
        "minPrice",
        "maxPrice",
        "warehouse",
        "shipsTo",
        "hasLabReport",
    ]) {
        assert.match(client, new RegExp(`params\\.set\\("${parameter}"`));
    }
    assert.match(page, /Price: low to high/);
    assert.match(page, /Fastest delivery/);
    assert.match(page, /COA available/);
    assert.match(page, /Two-letter country code/);
    assert.match(page, /aria-expanded=\{filtersOpen\}/);
    assert.match(page, /aria-controls="marketplace-filter-tray"/);
    assert.match(page, /aria-label="Active filters"/);
});

test("marketplace search cycles useful examples until the field is active", async () => {
    const page = await readFile(
        new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
        "utf8",
    );

    for (const example of [
        "Try Reta 15",
        "Try Reta 15 in Australia",
        "Try cheapest BPC-157 with COA",
        "Try fastest Tirzepatide delivered to the UK",
    ]) {
        assert.match(page, new RegExp(example));
    }
    assert.match(page, /if \(query \|\| searchFocused\) return/);
    assert.match(
        page,
        /placeholder=\{\s*SEARCH_EXAMPLES\[searchExampleIndex\]\s*\}/,
    );
});

test("marketplace search shows immediate progress for typing and Enter", async () => {
    const [page, styles] = await Promise.all([
        readFile(
            new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/pages/login/MarketplaceLogin.module.scss",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);

    assert.match(page, /aria-busy=\{pending\}/);
    assert.match(page, /setSearchRevision\(\(revision\) => revision \+ 1\)/);
    assert.match(page, /searchImmediatelyRef\.current = true/);
    assert.match(
        page,
        /const delay = searchImmediatelyRef\.current \? 0 : query \? 250 : 0/,
    );
    assert.match(page, /setPending\(true\);\s*setQuery/s);
    assert.match(page, /className=\{styles\.searchSpinner\}/);
    assert.match(page, /Searching seller catalogues…/);
    assert.match(page, /aria-live="polite"/);
    assert.match(page, /const interpretation = pending \? undefined/);
    assert.match(styles, /@keyframes marketplace-search-spin/);
});

test("marketplace checkout follows the complete signed PepShop contract", async () => {
    const [client, page] = await Promise.all([
        readFile(new URL("../src/lib/marketplace.ts", import.meta.url), "utf8"),
        readFile(
            new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
            "utf8",
        ),
    ]);
    for (const endpoint of [
        "/marketplace/v1/quotes",
        "/marketplace/v1/shipping-quotes",
        "/marketplace/v1/identity/exchange",
        "/marketplace/v1/checkouts",
        "/payments",
    ]) {
        assert.match(client, new RegExp(endpoint.replaceAll("/", "\\/")));
    }
    assert.match(client, /"Idempotency-Key"/);
    assert.match(client, /acceptLegalTerms: true/);
    assert.match(client, /escrowRequested: false/);
    assert.match(page, /PAYMENT_STORAGE_KEY/);
    assert.match(page, /Refresh payment status/);
    assert.doesNotMatch(page, /cancel order|open dispute|request refund/i);
});

test("marketplace search uses an accessible in-page autocomplete", async () => {
    const [page, styles] = await Promise.all([
        readFile(
            new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/pages/login/MarketplaceLogin.module.scss",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);

    assert.doesNotMatch(page, /<datalist/);
    assert.doesNotMatch(page, /list="marketplace-search-suggestions"/);
    assert.match(page, /role="combobox"/);
    assert.match(page, /aria-autocomplete="list"/);
    assert.match(page, /aria-expanded=\{autocompleteVisible\}/);
    assert.match(page, /role="listbox"/);
    assert.match(page, /role="option"/);
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
        assert.match(page, new RegExp(`event\\.key === "${key}"`));
    }
    assert.match(styles, /\.autocompleteList\s*\{/);
    assert.match(styles, /max-height: min\(248px, 42dvh\)/);
});

test("marketplace page owns its scroll container and keeps the hero compact", async () => {
    const styles = await readFile(
        new URL(
            "../src/pages/login/MarketplaceLogin.module.scss",
            import.meta.url,
        ),
        "utf8",
    );

    assert.match(styles, /\.marketplace\s*\{[^}]*height: 100%/s);
    assert.match(styles, /\.marketplace\s*\{[^}]*overflow-y: auto/s);
    assert.match(styles, /font-size: clamp\(38px, 4\.6vw, 64px\)/);
});

test("marketplace branch keeps signed-in visitors on the root homepage", async () => {
    const app = await readFile(
        new URL("../src/pages/app.tsx", import.meta.url),
        "utf8",
    );

    assert.match(app, /<Route exact path="\/">\s*<LoadSuspense>\s*<Login \/>/s);
    assert.ok(
        app.indexOf('<Route exact path="/">') <
            app.indexOf(
                '<Route path="/">\n                        {/* Authenticated',
            ),
        "exact marketplace homepage route must precede the PepChat catch-all",
    );
});

test("marketplace host never paints the PepChat login during boot", async () => {
    const [document, main, marketplaceMain, chatMain] = await Promise.all([
        readFile(new URL("../index.html", import.meta.url), "utf8"),
        readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
        readFile(
            new URL("../src/marketplaceMain.tsx", import.meta.url),
            "utf8",
        ),
        readFile(new URL("../src/chatMain.tsx", import.meta.url), "utf8"),
    ]);

    assert.match(document, /hostname === "market\.peptide\.chat"/);
    assert.match(document, /data-marketplace-host/);
    assert.match(document, /\.marketplace-boot\s*\{/);
    assert.match(main, /void import\("\.\/marketplaceMain"\)/);
    assert.match(main, /void import\("\.\/chatMain"\)/);
    assert.match(
        main,
        /window\.setTimeout\(\(\) => void import\("\.\/chatMain"\), 0\)/,
    );
    assert.match(marketplaceMain, /import MarketplaceAuthentication/);
    assert.doesNotMatch(
        marketplaceMain,
        /\.\/posthog|\.\/sentry|\.\/updateWorker/,
    );
    assert.match(chatMain, /import "\.\/posthog"/);
    assert.match(chatMain, /import "\.\/sentry"/);
});

test("marketplace owns direct authentication without the PepChat runtime", async () => {
    const [main, authentication, dialog] = await Promise.all([
        readFile(
            new URL("../src/marketplaceMain.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/pages/login/MarketplaceAuthentication.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/pages/login/MarketplaceAuthDialog.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);

    assert.match(main, /import MarketplaceAuthentication/);
    assert.match(authentication, /loadMarketplaceSession/);
    assert.match(authentication, /validateMarketplaceSession/);
    assert.match(authentication, /<MarketplaceAuthDialog/);
    assert.doesNotMatch(
        authentication,
        /Context|AuthenticationCard|clientController/,
    );
    assert.match(dialog, /loginMarketplace/);
    assert.match(dialog, /continueMarketplaceMfa/);
    assert.match(dialog, /dialog\.showModal\(\)/);
});

test("marketplace uses one compact PepChat-only account flow", async () => {
    const [login, page, authentication, dialog, pageStyles] = await Promise.all(
        [
            readFile(
                new URL("../src/pages/login/Login.tsx", import.meta.url),
                "utf8",
            ),
            readFile(
                new URL(
                    "../src/pages/login/MarketplaceLogin.tsx",
                    import.meta.url,
                ),
                "utf8",
            ),
            readFile(
                new URL(
                    "../src/pages/login/MarketplaceAuthentication.tsx",
                    import.meta.url,
                ),
                "utf8",
            ),
            readFile(
                new URL(
                    "../src/pages/login/MarketplaceAuthDialog.tsx",
                    import.meta.url,
                ),
                "utf8",
            ),
            readFile(
                new URL(
                    "../src/pages/login/MarketplaceLogin.module.scss",
                    import.meta.url,
                ),
                "utf8",
            ),
        ],
    );

    assert.match(login, /<MarketplaceAuthentication/);
    assert.match(authentication, /requestPepchatSignIn/);
    assert.match(authentication, /rejectPepchatSession/);
    assert.match(authentication, /signOutPepchat/);
    assert.match(dialog, /same email and password as Peptide\.chat/);
    assert.match(dialog, /METHOD_LABELS/);
    assert.match(page, /loggedIn \? "Sign out" : "Sign in"/);
    assert.match(page, /void requestPepchatSignIn\(\)/);
    assert.match(page, /createMarketplaceQuote/);
    assert.match(page, /requestCompoundBayRedirect/);
    assert.match(
        page,
        /exchangeMarketplaceIdentity\(code, quote\.quoteToken\)/,
    );
    assert.doesNotMatch(page, /window\.location\.assign/);
    assert.doesNotMatch(page, /https:\/\/peptide\.chat\/compound-bay/);
    assert.match(page, /function invalidateCheckoutForCartChange\(\)/);
    assert.match(
        page,
        /window\.sessionStorage\.removeItem\(QUOTE_CART_STORAGE_KEY\)/,
    );
    assert.match(page, /QUOTE_CART_STORAGE_KEY,\s*cartSignature\(cart\)/);
    assert.match(page, /if \(quoteMatchesCart\) \{\s*if \(storedBuyerToken\)/s);
    assert.match(page, /setShippingQuote\(null\);\s*setAcceptLegal\(false\)/);
    assert.match(page, /exchangeMarketplaceIdentity/);
    assert.doesNotMatch(page, /src=\{product\.imageUrl\}/);
    assert.match(pageStyles, /\.shell\s*\{[^}]*minmax\(0, 1fr\)/s);
    assert.match(pageStyles, /\.marketplaceFooter\s*\{/);
});

test("linked account tasks use task-specific headings", async () => {
    const form = await readFile(
        new URL("../src/pages/login/forms/Form.tsx", import.meta.url),
        "utf8",
    );
    assert.match(form, /page === "reset"\s*\? "login\.set_password"/);
    assert.match(form, /page === "resend"\s*\? "login\.resend"/);
    assert.match(form, /page === "login" \|\| page === "create"/);
});

test("marketplace homepage suppresses the global app install banner", async () => {
    const [app, banner] = await Promise.all([
        readFile(new URL("../src/pages/app.tsx", import.meta.url), "utf8"),
        readFile(
            new URL(
                "../src/components/app/AppInstallBanner.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);

    assert.match(app, /<AppInstallBanner\s+hidden=\{/);
    assert.match(app, /window\.location\.pathname === "\/"/);
    assert.match(banner, /const shown = visible && !hidden/);
    assert.match(banner, /if \(!shown\) return null/);
});
