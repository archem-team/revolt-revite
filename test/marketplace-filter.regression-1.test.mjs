import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCountryCode } from "../src/lib/marketplaceFilters.js";

// Regression: ISSUE-002 — maxlength discarded valid letters before cleanup
// Found by /qa on 2026-08-16
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("marketplace destination filters clean before applying the country-code limit", () => {
    assert.equal(normalizeCountryCode("u$S"), "US");
    assert.equal(normalizeCountryCode(" gb "), "GB");
    assert.equal(normalizeCountryCode("can"), "CA");
    assert.equal(normalizeCountryCode("12"), "");
});
