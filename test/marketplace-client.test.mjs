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
