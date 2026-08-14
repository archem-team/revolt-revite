import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import test from "node:test";

const APP_ID = "R8387T64JW.chat.zeko.app";
const APP_STORE_URL = "https://apps.apple.com/app/id6756353165";
const ANDROID_PACKAGE = "com.zekochat";
const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.zekochat";
const APP_LINK = "https://app.peptide.chat/open-app";

function request(port, path, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.get({ host: "127.0.0.1", port, path, headers }, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () =>
                resolve({ body, headers: res.headers, status: res.statusCode }),
            );
        });
        req.on("error", reject);
    });
}

async function waitForServer(port) {
    for (let attempt = 0; attempt < 50; attempt++) {
        try {
            await request(port, "/.well-known/apple-app-site-association");
            return;
        } catch (_error) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    throw new Error("Timed out waiting for the test web server");
}

test("mobile Open App uses the associated HTTPS route", async () => {
    const banner = await readFile(
        "src/components/app/AppInstallBanner.tsx",
        "utf8",
    );
    assert.match(banner, new RegExp(`const APP_LINK_URL = "${APP_LINK}"`));
    assert.match(banner, /const IOS_URL = APP_LINK_URL/);
    assert.match(banner, /const ANDROID_URL = APP_LINK_URL/);
    assert.doesNotMatch(banner, /const IOS_URL = "https:\/\/apps\.apple\.com/);
    assert.doesNotMatch(
        banner,
        /const ANDROID_URL =\s*"https:\/\/play\.google\.com/,
    );

    const aasa = JSON.parse(
        await readFile("public/.well-known/apple-app-site-association", "utf8"),
    );
    assert.deepEqual(aasa.applinks.details[0].appIDs, [APP_ID]);
    assert.deepEqual(
        aasa.applinks.details[0].components.map((component) => component["/"]),
        ["/open-app", "/invite/*", "/channel/*", "/server/*"],
    );

    const assetLinks = JSON.parse(
        await readFile("public/.well-known/assetlinks.json", "utf8"),
    );
    assert.equal(assetLinks[0].target.package_name, ANDROID_PACKAGE);
    assert.deepEqual(assetLinks[0].relation, [
        "delegate_permission/common.handle_all_urls",
    ]);
});

test("serves associations directly and selects the mobile store fallback", async (t) => {
    const port = 20000 + (process.pid % 20000);
    const server = spawn(process.execPath, ["scripts/serve.js", "public"], {
        env: { ...process.env, PORT: String(port) },
        stdio: "ignore",
    });
    t.after(() => server.kill());

    await waitForServer(port);

    const aasa = await request(port, "/.well-known/apple-app-site-association");
    assert.equal(aasa.status, 200);
    assert.equal(aasa.headers.location, undefined);
    assert.match(aasa.headers["content-type"], /^application\/json/);
    assert.deepEqual(JSON.parse(aasa.body).applinks.details[0].appIDs, [
        APP_ID,
    ]);

    const assetLinks = await request(port, "/.well-known/assetlinks.json");
    assert.equal(assetLinks.status, 200);
    assert.equal(assetLinks.headers.location, undefined);
    assert.match(assetLinks.headers["content-type"], /^application\/json/);
    assert.equal(
        JSON.parse(assetLinks.body)[0].target.package_name,
        ANDROID_PACKAGE,
    );

    const iosFallback = await request(port, "/open-app", {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)",
    });
    assert.equal(iosFallback.status, 302);
    assert.equal(iosFallback.headers.location, APP_STORE_URL);
    assert.equal(iosFallback.headers["cache-control"], "no-store");

    const androidFallback = await request(port, "/open-app", {
        "User-Agent": "Mozilla/5.0 (Linux; Android 15; Pixel 8a)",
    });
    assert.equal(androidFallback.status, 302);
    assert.equal(androidFallback.headers.location, PLAY_STORE_URL);
    assert.equal(androidFallback.headers["cache-control"], "no-store");
});
