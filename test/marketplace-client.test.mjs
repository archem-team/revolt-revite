import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("marketplace client uses the dedicated production API host", async () => {
    const source = await readFile(
        new URL("../src/lib/marketplace.ts", import.meta.url),
        "utf8",
    );

    assert.match(source, /https:\/\/market\.peptide\.chat/);
    assert.doesNotMatch(source, /https:\/\/vendors\.peptide\.chat/);
});

test("marketplace search exposes server-backed sorting and filters", async () => {
    const [client, page] = await Promise.all([
        readFile(new URL("../src/lib/marketplace.ts", import.meta.url), "utf8"),
        readFile(
            new URL("../src/pages/login/MarketplaceLogin.tsx", import.meta.url),
            "utf8",
        ),
    ]);

    for (const parameter of [
        "sort",
        "minPrice",
        "maxPrice",
        "warehouse",
        "shipsTo",
        "hasLabReport",
    ]) {
        assert.match(client, new RegExp(`params\\.set\\("${parameter}"`));
    }
    assert.match(page, /Price: low to high/);
    assert.match(page, /Fastest delivery/);
    assert.match(page, /COA available/);
    assert.match(page, /Two-letter country code/);
});
