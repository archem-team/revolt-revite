import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("marketplace checkout keeps Altra's review and payment safety boundary", async () => {
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

    assert.match(source, /Review order/);
    assert.match(source, /No payment has been created/);
    assert.match(source, /: "Create secure payment"/);
    assert.match(source, /EXACT AMOUNT TO SEND/);
    assert.match(source, /Copy exact amount/);
    assert.match(source, /Copy address/);
    assert.doesNotMatch(source, />Place order</);
    assert.match(styles, /\.checkoutSummary\s*\{/);
    assert.match(styles, /\.orderReview\s*\{/);
    assert.match(styles, /\.exactPaymentAmount\s*\{/);
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
