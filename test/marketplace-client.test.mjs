import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
    assert.match(page, /setPending\(true\);\s*setQuery/s);
    assert.match(page, /className=\{styles\.searchSpinner\}/);
    assert.match(page, /Searching seller catalogues…/);
    assert.match(page, /aria-live="polite"/);
    assert.match(styles, /@keyframes marketplace-search-spin/);
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
