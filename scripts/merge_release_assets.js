/* eslint-disable */
/**
 * Merge hashed assets from recent container releases into the current build.
 *
 * During a rolling deployment, browsers may still reference the previous
 * release after its pod has gone away. Keeping those immutable files in newer
 * images makes those URLs continue to work. Manifests bound retention by both
 * age and count so images do not grow forever.
 */
const path = require("path");
const {
    copy,
    ensureDir,
    pathExists,
    readFile,
    readdir,
    remove,
    stat,
    writeFile,
} = require("fs-extra");

const root = process.env.ASSET_BUILD_ROOT
    ? path.resolve(process.env.ASSET_BUILD_ROOT)
    : path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const assetsDir = path.join(distDir, "assets");
const manifestsDir = path.join(distDir, "asset-releases");
const previousDir = path.join(root, "previous-release");
const previousAssetsDir = path.join(previousDir, "assets");
const previousManifestsDir = path.join(previousDir, "asset-releases");

const retentionDays = Number(process.env.ASSET_RETENTION_DAYS || 30);
const maxPreviousReleases = Number(
    process.env.ASSET_MAX_PREVIOUS_RELEASES || 20,
);
const minPreviousReleases = Number(
    process.env.ASSET_MIN_PREVIOUS_RELEASES || 2,
);
const releaseId = (process.env.RELEASE_ID || "local")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 128);

async function listFiles(dir, prefix = "") {
    if (!(await pathExists(dir))) return [];

    const result = [];
    for (const name of await readdir(dir)) {
        const absolutePath = path.join(dir, name);
        const relativePath = path.posix.join(prefix, name);
        const info = await stat(absolutePath);
        if (info.isDirectory()) {
            result.push(...(await listFiles(absolutePath, relativePath)));
        } else if (info.isFile()) {
            result.push(relativePath);
        }
    }

    return result.sort();
}

async function readPreviousManifests() {
    if (!(await pathExists(previousManifestsDir))) return [];

    const manifests = [];
    for (const name of await readdir(previousManifestsDir)) {
        if (!name.endsWith(".json")) continue;
        try {
            const manifest = JSON.parse(
                await readFile(path.join(previousManifestsDir, name), "utf8"),
            );
            if (
                manifest &&
                typeof manifest.releaseId === "string" &&
                typeof manifest.createdAt === "string" &&
                Array.isArray(manifest.files)
            ) {
                manifests.push(manifest);
            }
        } catch (error) {
            console.warn(`Ignoring invalid asset manifest ${name}.`);
        }
    }

    return manifests;
}

async function copyManifestFiles(manifest) {
    const copiedFiles = [];
    for (const relativePath of manifest.files) {
        if (
            typeof relativePath !== "string" ||
            relativePath.startsWith("/") ||
            relativePath.split("/").includes("..")
        ) {
            continue;
        }

        const source = path.join(previousAssetsDir, relativePath);
        const destination = path.join(assetsDir, relativePath);
        if (!(await pathExists(source))) continue;
        if (!(await pathExists(destination))) {
            await ensureDir(path.dirname(destination));
            await copy(source, destination, { overwrite: false });
        }
        copiedFiles.push(relativePath);
    }

    return { ...manifest, files: copiedFiles };
}

async function main() {
    await ensureDir(assetsDir);
    const currentFiles = await listFiles(assetsDir);
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    let previousManifests = await readPreviousManifests();
    if (!previousManifests.length && (await pathExists(previousAssetsDir))) {
        const legacyFiles = (await listFiles(previousAssetsDir)).filter(
            (file) => !file.endsWith(".map"),
        );
        if (legacyFiles.length) {
            previousManifests = [
                {
                    releaseId: "legacy-previous",
                    createdAt: new Date(now).toISOString(),
                    files: legacyFiles,
                },
            ];
        }
    }

    previousManifests.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    const retained = previousManifests
        .filter((manifest, index) => {
            if (index < minPreviousReleases) return true;
            const createdAt = Date.parse(manifest.createdAt);
            return Number.isFinite(createdAt) && now - createdAt <= retentionMs;
        })
        .slice(0, maxPreviousReleases);

    await remove(manifestsDir);
    await ensureDir(manifestsDir);

    for (const manifest of retained) {
        const copiedManifest = await copyManifestFiles(manifest);
        await writeFile(
            path.join(manifestsDir, `${manifest.releaseId}.json`),
            `${JSON.stringify(copiedManifest, null, 2)}\n`,
        );
    }

    const currentManifest = {
        releaseId,
        createdAt: new Date(now).toISOString(),
        // Source maps are useful for the current release but do not need to be
        // carried into every later image; excluding them halves retention size.
        files: currentFiles.filter((file) => !file.endsWith(".map")),
    };
    await writeFile(
        path.join(manifestsDir, `${releaseId}.json`),
        `${JSON.stringify(currentManifest, null, 2)}\n`,
    );

    console.log(
        `Retained ${retained.length} previous asset release(s) alongside ${releaseId}.`,
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
