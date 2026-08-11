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
    assert.match(
        home,
        /aria-label=\{`Open \$\{server\.name\} Pepshop store`\}/,
    );
    assert.match(home, /target="_blank"/);
    assert.match(home, /right: calc\(var\(--space-12\) \+ var\(--space-1\)\)/);
    assert.match(home, /width: calc\(var\(--space-12\) \+ var\(--space-1\)\)/);
    assert.match(home, /height: calc\(var\(--space-10\) \+ var\(--space-1\)\)/);
    assert.match(home, /transform: translateY\(calc\(-50% - 1px\)\)/);
    assert.match(home, /Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V4/);
    assert.match(home, /Hallmark · component: destination-chip/);
    assert.match(home, /const PepshopLink = styled\.a`[\s\S]*?&&&& \{/);
    assert.match(home, /className="pepshop-mark"/);
    assert.match(
        home,
        /\.pepshop-mark \{[\s\S]*?width: var\(--space-12\);[\s\S]*?height: var\(--space-6\);[\s\S]*?padding: 0;/,
    );
    assert.match(home, /color: var\(--unreads\)/);
    assert.match(home, /background: var\(--unreads\)/);
    assert.match(home, /color: var\(--primary-background\)/);
    assert.match(home, /font-size: var\(--font-size-footnote\)/);
    assert.match(home, /className="pepshop-label"/);
    assert.match(home, /<span className="pepshop-label">\{"Shop"\}<\/span>/);
    assert.doesNotMatch(home, /className="pepshop-arrow"/);
    assert.doesNotMatch(home, /<UpArrowAlt/);
    assert.doesNotMatch(home, /<ShoppingBag/);
    assert.doesNotMatch(home, /<StoreAlt/);
    assert.match(
        home,
        /import \{ Lock, MessageAdd \} from "@styled-icons\/boxicons-solid"/,
    );
    assert.match(home, /<MessageAdd size=\{22\} \/>/);
    assert.match(home, /position: absolute/);
    assert.match(home, /padding-right: var\(--space-16\)/);
    assert.match(home, /flex: 0 0 var\(--space-8\)/);
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
