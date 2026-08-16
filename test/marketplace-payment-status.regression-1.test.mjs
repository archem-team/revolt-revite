import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Regression: ISSUE-006 — settled payment notice disappeared with the cart
// Found by /qa on 2026-08-17
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("payment status notice remains visible after a settled cart is cleared", async () => {
    const source = await readFile(
        new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
        "utf8",
    );

    const emptyCart = source.indexOf("Your cart is empty.");
    const cartConditionalEnd = source.indexOf(")}", emptyCart);
    const statusNotice = source.indexOf("{checkoutNotice ? (", emptyCart);
    assert.ok(emptyCart > 0);
    assert.ok(cartConditionalEnd > emptyCart);
    assert.ok(statusNotice > cartConditionalEnd);
    assert.match(source, /setCheckoutNotice\(`Payment status: \$\{next\.payment\.status\}\.\`\)/);
});
