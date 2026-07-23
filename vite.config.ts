import macrosPlugin from "@insertish/vite-plugin-babel-macros";
import replace from "@rollup/plugin-replace";
import legacy from "@vitejs/plugin-legacy";
import { readFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import preact from "@preact/preset-vite";

function getGitRevision() {
    try {
        const rev = readFileSync(".git/HEAD").toString().trim();
        if (rev.indexOf(":") === -1) {
            return rev;
        }

        return readFileSync(`.git/${rev.substring(5)}`)
            .toString()
            .trim();
    } catch (err) {
        console.error("Failed to get Git revision.");
        return "?";
    }
}

function getGitBranch() {
    try {
        const rev = readFileSync(".git/HEAD").toString().trim();
        if (rev.indexOf(":") === -1) {
            return "DETACHED";
        }

        return rev.split("/").pop();
    } catch (err) {
        console.error("Failed to get Git branch.");
        return "?";
    }
}

function getVersion() {
    return JSON.parse(readFileSync("package.json").toString()).version;
}

export default defineConfig({
    plugins: [
        preact(),
        macrosPlugin(),
        legacy({
            targets: ["defaults", "not IE 11"],
        }),
        VitePWA({
            srcDir: "src",
            filename: "sw.ts",
            strategies: "injectManifest",
            manifest: {
                name: "PepChat – Home of the Peptide Community",
                short_name: "PepChat",
                description:
                    "Join the only chat built for unrestricted peptide discussion. Connect with group buys, Chinese manufacturers, and fellow researchers. No gatekeepers. No censorship. 100% open-source.",
                categories: ["communication", "chat", "messaging"],
                start_url: "/",
                orientation: "portrait",
                /*display_override: ["window-controls-overlay"],*/
                display: "standalone",
                background_color: "#101823",
                theme_color: "#101823",
                icons: [
                    {
                        src: `/assets/icons/android-chrome-192x192.png`,
                        type: "image/png",
                        sizes: "192x192",
                    },
                    {
                        src: `/assets/icons/android-chrome-512x512.png`,
                        type: "image/png",
                        sizes: "512x512",
                    },
                    {
                        src: `/assets/icons/monochrome.svg`,
                        type: "image/svg+xml",
                        sizes: "48x48 72x72 96x96 128x128 256x256",
                        purpose: "monochrome",
                    },
                    {
                        src: `/assets/icons/masking-512x512.png`,
                        type: "image/png",
                        sizes: "512x512",
                        purpose: "maskable",
                    },
                ],
                //TODO: add shortcuts relating to your last opened direct messages
                /*shortcuts: [
                    {
                      "name": "Open Play Later",
                      "short_name": "Play Later",
                      "description": "View the list of podcasts you saved for later",
                      "url": "/play-later?utm_source=homescreen",
                      "icons": [{ "src": "/icons/play-later.png", "sizes": "192x192" }]
                    },
                    {
                      "name": "View Subscriptions",
                      "short_name": "Subscriptions",
                      "description": "View the list of podcasts you listen to",
                      "url": "/subscriptions?utm_source=homescreen",
                      "icons": [{ "src": "/icons/subscriptions.png", "sizes": "192x192" }]
                    }
                  ]*/
            },
        }),
        replace({
            __GIT_REVISION__: getGitRevision(),
            __GIT_BRANCH__: getGitBranch(),
            __APP_VERSION__: getVersion(),
            preventAssignment: true,
        }) as any,
    ],
    server: {
        // Proxy the legacy "manage" admin API in dev so /api/* requests reach
        // the real backend instead of falling through to the SPA index.html.
        // This now only serves the LEGACY endpoints that were NOT ported to the
        // Rust backend (community reviews, submissions, single-community detail,
        // vendor owner) — see API_BASE in src/pages/directory/types.ts.
        // The migrated directory/promo endpoints use BACKEND_API_BASE, an
        // absolute URL that bypasses this proxy entirely.
        proxy: {
            "/api": {
                target: "https://manageapi.peptide.chat",
                changeOrigin: true,
                secure: true,
            },
        },
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
            },
        },
    },
    optimizeDeps: {
        exclude: ["revolt.js", "preact-context-menu", "@revoltchat/ui"],
    },
    resolve: {
        preserveSymlinks: true,
        alias: [
            // Serve the UI library as project source instead of a
            // node_modules dep: dev URLs then carry no ?v hash and no
            // immutable cache header, so submodule rebuilds show up on a
            // normal reload (browsers otherwise pin stale modules forever).
            {
                find: /^@revoltchat\/ui$/,
                replacement: resolve(
                    __dirname,
                    "external/components/esm/index.js",
                ),
            },
        ],
    },
});
