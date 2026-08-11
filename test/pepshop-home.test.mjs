import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Home renders safe Pepshop links without changing server-card height", async () => {
    const home = await read("src/pages/home/Home.tsx");

    assert.match(home, /pepshopUrl\?: string \| null/);
    assert.match(
        home,
        /url\.protocol === "https:" \|\| url\.protocol === "http:"/,
    );
    assert.match(home, /aria-label=\{`Open \$\{server\.name\} Pepshop`\}/);
    assert.match(home, /target="_blank"/);
    assert.match(home, /right: var\(--space-12\)/);
    assert.match(home, /width: var\(--space-12\)/);
    assert.match(home, /height: var\(--space-12\)/);
    assert.match(home, /const PepshopLink = styled\.a`\s*&&&& \{/);
    assert.match(home, /className="pepshop-mark"/);
    assert.match(home, /color: var\(--unreads\)/);
    assert.match(home, /width: var\(--space-5\)/);
    assert.match(home, /height: var\(--space-5\)/);
    assert.match(home, /<MessageAdd size=\{20\} \/>/);
    assert.doesNotMatch(home, /background: var\(--unreads\)/);
    assert.match(home, /position: absolute/);
    assert.match(home, /padding-right: var\(--space-12\)/);
    assert.doesNotMatch(home, /&::before \{/);
    assert.match(home, /const CACHE_KEY = "server_list_cache_v2"/);

    const pepshopStyles = home.match(
        /const PepshopLink = styled\.a`[\s\S]*?\n`;/,
    )?.[0];
    assert.ok(pepshopStyles);
    assert.doesNotMatch(pepshopStyles, /channel-active/);
    assert.match(pepshopStyles, /prefers-reduced-motion: reduce/);
    assert.match(pepshopStyles, /hover: hover/);
    assert.match(pepshopStyles, /aria-disabled="true"/);
    assert.match(pepshopStyles, /aria-busy="true"/);
    assert.match(pepshopStyles, /data-state="error"/);
    assert.match(pepshopStyles, /data-state="success"/);
    assert.doesNotMatch(home, /<span>\{"Pepshop"\}<\/span>/);
});
