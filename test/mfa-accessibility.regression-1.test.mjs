import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Regression: ISSUE-004 — MFA methods were inert anchors in an unnamed modal
// Found by /qa on 2026-08-17
// Report: .gstack/qa-reports/marketplace-deep-qa-2026-08-16.md
test("MFA challenge exposes one named dialog with native method buttons", async () => {
    const source = await readFile(
        new URL(
            "../src/controllers/modals/components/MFAFlow.tsx",
            import.meta.url,
        ),
        "utf8",
    );

    assert.doesNotMatch(source, /CategoryButton/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby="mfa-flow-title"/);
    assert.match(source, /<MethodButton\s+type="button"/);
    assert.match(source, /<span id="mfa-flow-title">/);
});
