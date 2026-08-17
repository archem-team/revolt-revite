import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Regression: ISSUE-003 — failed seller images showed a broken-image glyph
// Found by /qa on 2026-08-17
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("marketplace uses the Uther-style generated bottle when product images are unavailable", async () => {
    const source = await readFile(
        new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
        "utf8",
    );

    assert.match(source, /imageUrl && !failed \?/);
    assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
    assert.match(
        source,
        /compoundBottleDataUrl\(\{[\s\S]*?name: productName,[\s\S]*?mass,[\s\S]*?vendorName/,
    );
    assert.match(source, /data-generated-product-image="true"/);
    assert.match(
        source,
        /displayedProducts\.map[\s\S]*?<ProductVisual[\s\S]*?imageUrl=\{product\.imageUrl\}/,
    );
    assert.equal(source.match(/<ProductVisual/g)?.length, 2);
});
