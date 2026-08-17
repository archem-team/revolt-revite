import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the marketplace removes explicit $1 payment test products from search responses", async () => {
    const marketplaceClient = await readFile(
        new URL("../src/lib/marketplace.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        marketplaceClient,
        /product\.priceWithTax !== 100/,
        "the filter must be limited to $1 variants",
    );
    assert.match(marketplaceClient, /identity\.includes\("payment-test"\)/);
    assert.match(marketplaceClient, /identity\.includes\("payment test"\)/);
    assert.match(
        marketplaceClient,
        /alternativeProducts:\s*response\.alternativeProducts\.filter/,
        "alternative results must not reintroduce payment test products",
    );
    assert.match(
        marketplaceClient,
        /return withoutMarketplacePaymentTestProducts\(response\)/,
        "every marketplace search response must pass through the filter",
    );
});

test("filtered pages advance using the server page size", async () => {
    const marketplacePage = await readFile(
        new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
        "utf8",
    );
    assert.match(
        marketplacePage,
        /offset: result\.pagination\.offset \+ result\.pagination\.limit/,
    );
    assert.doesNotMatch(
        marketplacePage,
        /offset: result\.pagination\.offset \+ result\.products\.length/,
    );
});
