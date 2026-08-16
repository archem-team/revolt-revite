import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeCountryCode } from "../src/lib/marketplaceFilters.js";

// Regression: ISSUE-005 — delivery country truncated before punctuation cleanup
// Found by /qa on 2026-08-17
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("checkout delivery country normalizes before its two-letter limit", async () => {
    assert.equal(normalizeCountryCode("u$S"), "US");

    const source = await readFile(
        new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
        "utf8",
    );
    assert.match(
        source,
        /field === "countryCode" \? normalizeCountryCode\(value\) : value/,
    );
    assert.doesNotMatch(source, /field === "countryCode" \? 2 : 120/);
});
