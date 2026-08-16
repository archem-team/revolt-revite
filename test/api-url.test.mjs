import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiUrl } from "../src/lib/apiUrlCore.js";

test("marketplace credentials cannot be sent to a stale Revolt API origin", () => {
    assert.equal(
        resolveApiUrl("https://api.revolt.chat/", "market.peptide.chat"),
        "https://peptide.chat/api",
    );
    assert.equal(
        resolveApiUrl("https://custom.example/api", "market.peptide.chat"),
        "https://custom.example/api",
    );
    assert.equal(
        resolveApiUrl("https://api.revolt.chat", "app.example"),
        "https://api.revolt.chat",
    );
});
