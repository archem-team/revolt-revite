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

test("English base dictionary defines required moderation strings", async () => {
    const definition = JSON.parse(
        await readFile(new URL("../external/lang/en.json", import.meta.url)),
    );
    const system = definition.app.main.channel.system;

    assert.equal(system.message_pinned, "{{user}} pinned a message");
    assert.equal(system.message_unpinned, "{{user}} unpinned a message");
    assert.equal(
        definition.app.main.channel.misc.muted,
        "You have been muted and can't send messages.",
    );
    assert.equal(definition.app.context_menu.pin_message, "Pin message");
    assert.equal(definition.app.context_menu.unpin_message, "Unpin message");
    assert.equal(definition.app.context_menu.mute_user, "Mute user");
    assert.equal(definition.app.context_menu.unmute_user, "Unmute user");
    assert.equal(
        definition.permissions.MentionEveryone.t,
        "Mention Everyone",
    );
    assert.equal(definition.permissions.MentionRoles.t, "Mention Roles");
});
