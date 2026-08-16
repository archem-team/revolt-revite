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
