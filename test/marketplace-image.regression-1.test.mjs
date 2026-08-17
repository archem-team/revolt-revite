import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Regression: ISSUE-003 — failed seller images showed a broken-image glyph
// Found by /qa on 2026-08-17
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("marketplace avoids card image failures and keeps detail image fallback", async () => {
    const source = await readFile(
        new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
        "utf8",
    );

    assert.match(source, /imageUrl && !failed \?/);
    assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
    assert.match(source, /<span>\{productName\.slice\(0, 2\)\.toUpperCase\(\)\}<\/span>/);
    assert.match(
        source,
        /displayedProducts\.map[\s\S]*?product\.productName[\s\S]*?slice\(0, 2\)[\s\S]*?toUpperCase\(\)/,
    );
    assert.equal(source.match(/<ProductVisual/g)?.length, 1);
});
