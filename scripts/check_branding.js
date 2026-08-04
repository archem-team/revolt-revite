/* eslint-disable no-console, @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_EXTENSIONS = new Set([
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".scss",
    ".svg",
    ".ts",
    ".tsx",
]);

const LEGACY_LINK_COMPATIBILITY_FILES = new Set([
    "src/components/common/messaging/embed/EmbedInvite.tsx",
    "src/components/common/messaging/embed/LinkPreview.tsx",
    "src/lib/links.ts",
    "src/mobx/stores/helpers/SSecurity.ts",
    "src/updateWorker.ts",
    "src/version.ts",
]);

const UPSTREAM_DESTINATION =
    /(?:https?:\/\/)?(?:[\w.-]+\.)?(?:revolt\.chat|insrt\.uk)|https?:\/\/(?:www\.)?github\.com\/revoltchat|https?:\/\/rvlt\.gg/i;
const UPSTREAM_PRODUCT_NAME = /\b(?:Rovolt|Revolt|Revite|REVOLT)\b/;
const INTERNAL_NAME =
    /@revoltchat|revolt\.js|RevoltConfig|IS_REVOLT|RevoltApp|revite:|X-Revolt-Token|\.revolt\b/;

const failures = [];

function walk(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const absolute = path.join(directory, entry.name);
            return entry.isDirectory() ? walk(absolute) : [absolute];
        });
}

function relative(file) {
    return path.relative(ROOT, file).split(path.sep).join("/");
}

function checkSource(file) {
    const fileName = relative(file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (
            UPSTREAM_DESTINATION.test(line) &&
            !LEGACY_LINK_COMPATIBILITY_FILES.has(fileName)
        ) {
            failures.push(`${fileName}:${index + 1}: upstream destination`);
        }

        if (
            UPSTREAM_PRODUCT_NAME.test(line) &&
            !INTERNAL_NAME.test(line) &&
            !trimmed.startsWith("//") &&
            !trimmed.startsWith("*") &&
            !trimmed.startsWith("/*")
        ) {
            failures.push(`${fileName}:${index + 1}: upstream product name`);
        }
    });
}

function visitStrings(value, fileName, key = "") {
    if (typeof value === "string") {
        if (UPSTREAM_PRODUCT_NAME.test(value)) {
            failures.push(`${fileName}:${key}: upstream product name`);
        }
        if (key.endsWith("new_to_revolt") && !/pepchat/i.test(value)) {
            failures.push(`${fileName}:${key}: missing PepChat brand name`);
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            visitStrings(item, fileName, `${key}[${index}]`),
        );
        return;
    }

    if (value && typeof value === "object") {
        Object.entries(value).forEach(([childKey, child]) =>
            visitStrings(
                child,
                fileName,
                key ? `${key}.${childKey}` : childKey,
            ),
        );
    }
}

const sourceFiles = walk(path.join(ROOT, "src")).filter((file) =>
    SOURCE_EXTENSIONS.has(path.extname(file)),
);
sourceFiles.forEach(checkSource);
checkSource(path.join(ROOT, "index.html"));
checkSource(path.join(ROOT, "vite.config.ts"));

const localeDirectory = path.join(ROOT, "external/lang");
for (const file of fs.readdirSync(localeDirectory)) {
    if (!file.endsWith(".json") || file === "contributors.json") continue;
    const absolute = path.join(localeDirectory, file);
    visitStrings(
        JSON.parse(fs.readFileSync(absolute, "utf8")),
        `external/lang/${file}`,
    );
}

for (const file of walk(path.join(ROOT, "public"))) {
    if (UPSTREAM_PRODUCT_NAME.test(path.basename(file))) {
        failures.push(`${relative(file)}: upstream-branded asset name`);
    }
}

if (failures.length) {
    console.error(
        `Branding audit failed:\n${failures.map((x) => `- ${x}`).join("\n")}`,
    );
    process.exit(1);
}

console.log("Branding audit passed.");
