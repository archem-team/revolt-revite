import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveDictionaryEntry } from "../src/lib/i18nFields.js";

test("translation lookup resolves strings and safely falls back", () => {
    const dictionary = {
        app: { main: { channel: { system: { present: "Translated" } } } },
    };

    assert.equal(
        resolveDictionaryEntry(dictionary, "app.main.channel.system.present"),
        "Translated",
    );
    assert.equal(
        resolveDictionaryEntry(dictionary, "app.main.channel.system.missing"),
        "app.main.channel.system.missing",
    );
    assert.equal(
        resolveDictionaryEntry(
            dictionary,
            "app.main.channel.system.missing",
            "Fallback",
        ),
        "Fallback",
    );
});

test("English base dictionary defines pin and unpin system messages", async () => {
    const definition = JSON.parse(
        await readFile(new URL("../external/lang/en.json", import.meta.url)),
    );
    const system = definition.app.main.channel.system;

    assert.equal(system.message_pinned, "{{user}} pinned a message");
    assert.equal(system.message_unpinned, "{{user}} unpinned a message");
});
