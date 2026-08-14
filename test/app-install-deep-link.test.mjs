import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import test from "node:test";

const APP_ID = "R8387T64JW.chat.zeko.app";
const APP_STORE_URL = "https://apps.apple.com/app/id6756353165";
const UNIVERSAL_LINK = "https://app.peptide.chat/open-app";

function request(port, path) {
    return new Promise((resolve, reject) => {
        const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
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

test("iOS Open App uses the associated HTTPS route", async () => {
    const banner = await readFile(
        "src/components/app/AppInstallBanner.tsx",
        "utf8",
    );
    assert.match(banner, new RegExp(`const IOS_URL = "${UNIVERSAL_LINK}"`));
    assert.doesNotMatch(banner, /const IOS_URL = "https:\/\/apps\.apple\.com/);

    const aasa = JSON.parse(
        await readFile("public/.well-known/apple-app-site-association", "utf8"),
    );
    assert.deepEqual(aasa.applinks.details[0].appIDs, [APP_ID]);
    assert.deepEqual(
        aasa.applinks.details[0].components.map((component) => component["/"]),
        ["/open-app", "/invite/*", "/channel/*", "/server/*"],
    );
});

test("serves AASA directly and redirects only the web fallback", async (t) => {
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

    const fallback = await request(port, "/open-app");
    assert.equal(fallback.status, 302);
    assert.equal(fallback.headers.location, APP_STORE_URL);
    assert.equal(fallback.headers["cache-control"], "no-store");
});
