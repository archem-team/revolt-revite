/* eslint-disable */
/**
 * Static file server replacing `sirv-cli` so cache headers can differ per
 * path — sirv-cli only supports a single global Cache-Control.
 *
 * Why this matters: each release ships a fresh set of hash-named files under
 * /assets and deletes the previous ones. Without an explicit Cache-Control,
 * browsers heuristically cache index.html (10% of its Last-Modified age), so
 * after a deploy clients keep loading a stale index.html whose asset hashes
 * no longer exist — white screen until a hard refresh.
 *
 *   - HTML / everything unhashed: no-cache, i.e. revalidate on every load.
 *   - /sw.js: no-store in browsers and CDNs so update checks reach origin.
 *   - /assets/<name>.<hash>.<ext>: immutable for a year — a given URL's
 *     content never changes, only the URL does.
 *
 * `sirv` is a dependency of `sirv-cli` (a production dependency), so it is
 * always present in the pruned production node_modules.
 */
const http = require("http");
const sirv = require("sirv");

const dir = process.argv[2] || "dist";
const port = Number(process.env.PORT) || 5000;
const releaseId = process.env.RELEASE_ID || "unknown";
const iosAppStoreUrl = "https://apps.apple.com/app/id6756353165";

function setHeaders(res, pathname) {
    if (pathname === "/.well-known/apple-app-site-association") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
    } else if (pathname === "/sw.js") {
        const value = "no-store, no-cache, must-revalidate, max-age=0";
        res.setHeader("Cache-Control", value);
        res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
        res.setHeader("CDN-Cache-Control", "no-store");
    } else if (pathname.startsWith("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
        res.setHeader("Cache-Control", "no-cache");
    }
}

const serveStatic = sirv(dir, {
    single: false,
    etag: true,
    setHeaders,
});

const serveSpa = sirv(dir, {
    single: true,
    etag: true,
    setHeaders,
});

http.createServer((req, res) => {
    // parity with `sirv --cors`
    res.setHeader("X-PepChat-Release", releaseId);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, Content-Type, Accept, Range",
    );
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/open-app") {
        // iOS intercepts this associated Universal Link when Zeko is installed.
        // Reaching the web server means it was not intercepted, so fall back to
        // the App Store without relying on a fragile client-side timer.
        res.statusCode = 302;
        res.setHeader("Location", iosAppStoreUrl);
        res.setHeader("Cache-Control", "no-store");
        res.end();
    } else if (pathname.startsWith("/assets/")) {
        // Never return index.html with a 200 status for a missing JS/CSS file.
        serveStatic(req, res, () => {
            res.statusCode = 404;
            res.setHeader("Cache-Control", "no-store");
            res.end("Not found");
        });
    } else {
        serveSpa(req, res);
    }
}).listen(port, "0.0.0.0", () => {
    console.log(`Serving ${dir} on 0.0.0.0:${port}`);
});
