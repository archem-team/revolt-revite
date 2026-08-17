import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Hallmark checkout fixes keep the action concise and prices tabular", async () => {
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

    assert.match(source, /: "Place order"/);
    assert.doesNotMatch(source, /Place order and show payment instructions/);
    assert.equal(
        styles.match(/font-variant-numeric: tabular-nums;/g)?.length,
        4,
    );
});

test("marketplace wordmark uses a compact light brand plate", async () => {
    const styles = await readFile(
        new URL(
            "../src/pages/login/MarketplaceLogin.module.scss",
            import.meta.url,
        ),
        "utf8",
    );

    assert.match(styles, /treatment: quiet light plate/);
    assert.match(
        styles,
        /\.logoPlate\s*\{[\s\S]*?border: 1px solid var\(--market-line\);/,
    );
    assert.match(
        styles,
        /\.logoPlate\s*\{[\s\S]*?background: var\(--market-paper-2\);/,
    );
    assert.match(styles, /\.logoWordmark\s*\{[\s\S]*?opacity: 0\.9;/);
});
