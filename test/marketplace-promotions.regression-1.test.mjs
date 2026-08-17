import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
    new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
    "utf8",
);
const client = await readFile(
    new URL("../src/lib/marketplace.ts", import.meta.url),
    "utf8",
);
const styles = await readFile(
    new URL("../src/pages/login/MarketplaceLogin.module.scss", import.meta.url),
    "utf8",
);

test("marketplace promotion payload stays additive for staged backend rollout", () => {
    assert.match(client, /regularPriceWithTax\?: number/);
    assert.match(client, /promotion\?: \{/);
    assert.match(client, /discountPercentage: number/);
    assert.match(client, /publicMessage: string/);
});

test("sale prices appear across cards, package choices, cart, and checkout", () => {
    assert.match(page, /function PriceDisplay/);
    assert.ok((page.match(/<PriceDisplay/g) ?? []).length >= 3);
    assert.match(page, /Sale price \$\{money/);
    assert.match(page, /selectedVariant\?\.promotion\?\.publicMessage/);
    assert.match(page, /cartRegularSubtotal > cartSubtotal/);
    assert.match(styles, /\.discountBadge/);
    assert.match(styles, /\.promotionMessage/);
});

test("stale promotion quotes force a refreshed cart review", () => {
    assert.match(client, /MARKETPLACE_QUOTE_CHANGED/);
    assert.match(client, /MARKETPLACE_TOTAL_CHANGED/);
    assert.match(page, /refreshCartAfterPriceChange/);
    assert.match(page, /Price changed—review your cart before continuing/);
});
