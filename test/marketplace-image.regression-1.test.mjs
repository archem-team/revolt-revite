import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Regression: ISSUE-003 — failed seller images showed a broken-image glyph
// Found by /qa on 2026-08-17
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("marketplace uses the Uther-style generated bottle when product images are unavailable", async () => {
    const [source, styles] = await Promise.all([
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

    assert.match(source, /resolvedImageUrl && !failed \?/);
    assert.match(
        source,
        /relativePath\.startsWith\("assets\/"\)[\s\S]*?`https:\/\/\$\{storefront\}\.peptide\.chat\/`/,
    );
    assert.match(source, /src=\{resolvedImageUrl\}/);
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
    assert.equal(source.match(/vendorCode=\{/g)?.length, 2);
    assert.equal(source.match(/<ProductVisual/g)?.length, 2);
    assert.match(
        styles,
        /\.detailVisual\s*\{[\s\S]*?img\s*\{[\s\S]*?object-fit: contain;/,
    );
    assert.match(
        styles,
        /\.productVisual\s*\{[\s\S]*?img\s*\{[\s\S]*?object-fit: contain;/,
    );
    assert.match(
        styles,
        /@media[^]*?\.detailVisual\s*\{[^}]*?height: 240px;[^}]*?min-height: 0;[^]*?img\s*\{[^}]*?height: 240px;[^}]*?max-height: 240px;/,
    );
});

test("lab reports keep the marketplace in the current tab so Back restores the product", async () => {
    const source = await readFile(
        new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
        "utf8",
    );

    assert.match(
        source,
        /className=\{styles\.coaLink\}[\s\S]*?target="_self"[\s\S]*?>\s*View lab report/,
    );
    assert.doesNotMatch(
        source,
        /className=\{styles\.coaLink\}[\s\S]*?target="_blank"/,
    );
    assert.match(
        source,
        /PRODUCT_RETURN_STORAGE_KEY[\s\S]*?useState<MarketplaceProduct \| null>\(readProductReturn\)/,
    );
    assert.match(
        source,
        /onClick=\{\(\) =>[\s\S]*?sessionStorage\.setItem\([\s\S]*?PRODUCT_RETURN_STORAGE_KEY,[\s\S]*?JSON\.stringify\(selectedProduct\)/,
    );
    assert.match(source, /window\.addEventListener\("pageshow", restoreProduct\)/);
});
