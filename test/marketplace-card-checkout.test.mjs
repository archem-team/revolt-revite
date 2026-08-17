import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("marketplace cards support direct cart quantity and homepage checkout", async () => {
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

    assert.match(source, /function addProductToCart\(/);
    assert.match(source, /function marketplaceProductPath\(/);
    assert.match(source, /window\.addEventListener\("popstate", syncProductRoute\)/);
    assert.match(
        source,
        /displayedProducts\.map[\s\S]*?className=\{styles\.productActions\}/,
    );
    assert.match(source, /Decrease \$\{product\.name\} quantity/);
    assert.match(source, /Increase \$\{product\.name\} quantity/);
    assert.match(source, />\s*Add to cart\s*<\/button>/);
    assert.match(
        source,
        /className=\{styles\.productVisual\}[\s\S]*?href=\{marketplaceProductPath\(product\)\}[\s\S]*?followProductLink\(event, product\)/,
    );
    assert.match(source, /<h2>[\s\S]*?marketplaceProductPath\([\s\S]*?product\.productName/);
    assert.match(
        source,
        /className=\{styles\.headerCheckout\}[\s\S]*?setCartOpen\(true\);[\s\S]*?void beginCheckout\(\);[\s\S]*?Checkout/,
    );
    assert.match(styles, /\.productActions\s*\{/);
    assert.match(styles, /\.cardQuantity\s*\{/);
});
