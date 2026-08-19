import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalDeepLink } from "../src/lib/deepLinks.js";

const id = "01J8W7NPV2DM3XR48JAYB1RDFK";
const channel = "01J8Y8T3XQ75D9KW32CG522952";
const message = "01J8Y9A3XQ75D9KW32CG522999";

test("accepts the canonical Zeko deep-link contract on both web hosts", () => {
    const paths = [
        "/invite/pepsource",
        `/channel/${channel}`,
        `/channel/${channel}/${message}`,
        `/server/${id}`,
        `/server/${id}/channel/${channel}`,
        `/server/${id}/channel/${channel}/${message}`,
    ];

    for (const host of ["peptide.chat", "app.peptide.chat"]) {
        for (const path of paths) {
            assert.equal(canonicalDeepLink(`https://${host}${path}`), path);
        }
    }
});

test("rejects insecure, foreign, and malformed links", () => {
    const links = [
        `http://peptide.chat/channel/${channel}`,
        `https://evil.example/channel/${channel}`,
        "https://peptide.chat/channel",
        `https://peptide.chat/server/${id}/channels/${channel}`,
        `https://peptide.chat/channel/${channel}/${message}/extra`,
        "javascript:alert(1)",
    ];

    for (const link of links) assert.equal(canonicalDeepLink(link), null);
});

test("publishes the current Zeko app associations", async () => {
    const aasa = JSON.parse(
        await readFile("public/.well-known/apple-app-site-association", "utf8"),
    );
    const assetLinks = JSON.parse(
        await readFile("public/.well-known/assetlinks.json", "utf8"),
    );

    assert.deepEqual(aasa.applinks.details[0].appIDs, [
        "R8387T64JW.chat.zeko.app",
    ]);
    assert.deepEqual(
        aasa.applinks.details[0].components.map((item) => item["/"]),
        ["/open-app", "/invite/*", "/channel/*", "/server/*"],
    );
    assert.equal(assetLinks[0].target.package_name, "com.zekochat");
    assert.ok(assetLinks[0].target.sha256_cert_fingerprints.length > 0);
});
