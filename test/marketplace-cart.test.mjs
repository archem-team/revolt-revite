import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMarketplaceCart } from "../src/lib/marketplaceCart.js";

const line = (overrides = {}) => ({
    id: "variant-1",
    productId: "product-1",
    vendorCode: "seller-1",
    vendorName: "Seller One",
    name: "Package 10 mg",
    productName: "Compound",
    priceWithTax: 5800,
    currencyCode: "USD",
    quantity: 1,
    ...overrides,
});

// Regression: ISSUE-001 — malformed persisted lines produced crashes and impossible cart counts
// Found by /qa on 2026-08-16
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("persisted marketplace carts fail closed on malformed state", () => {
    assert.deepEqual(normalizeMarketplaceCart(null), []);
    assert.deepEqual(normalizeMarketplaceCart({}), []);
    assert.deepEqual(normalizeMarketplaceCart([null, { quantity: 1 }]), []);
    assert.deepEqual(normalizeMarketplaceCart([line({ quantity: "2" })]), []);
    assert.deepEqual(normalizeMarketplaceCart([line({ quantity: -2 })]), []);
    assert.deepEqual(
        normalizeMarketplaceCart([
            line(),
            line({ id: "variant-2", currencyCode: "EUR" }),
        ]),
        [],
    );
});

test("persisted marketplace carts preserve, label, and merge valid lines", () => {
    const [restored] = normalizeMarketplaceCart([
        line({ quantity: 60, sellerName: "" }),
        line({ quantity: 60 }),
        null,
    ]);

    assert.equal(restored.quantity, 99);
    assert.equal(restored.sellerName, "Seller One");
    assert.equal(restored.priceWithTax, 5800);
});
