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
 *   - HTML / everything unhashed (/, /sw.js, manifest): no-cache, i.e.
 *     revalidate with the server on every load.
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

const serve = sirv(dir, {
    single: true, // SPA fallback to index.html, like `sirv --single`
    etag: true,
    setHeaders(res, pathname) {
        if (pathname.startsWith("/assets/")) {
            res.setHeader(
                "Cache-Control",
                "public, max-age=31536000, immutable",
            );
        } else {
            res.setHeader("Cache-Control", "no-cache");
        }
    },
});

http.createServer((req, res) => {
    // parity with `sirv --cors`
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, Content-Type, Accept, Range",
    );
    serve(req, res);
}).listen(port, "0.0.0.0", () => {
    console.log(`Serving ${dir} on 0.0.0.0:${port}`);
});
