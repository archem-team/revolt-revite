import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("server rail remains stable while compact routes are positioned", async () => {
    const [sidebar, compactPanels] = await Promise.all([
        read("src/components/navigation/left/ServerListSidebar.tsx"),
        read("src/lib/compactPanels.ts"),
    ]);

    assert.match(sidebar, /const RailBase = styled\.div`[\s\S]*min-height: 0/);
    assert.match(
        sidebar,
        /> div \{[\s\S]*height: 100%;[\s\S]*min-height: 0;[\s\S]*\}/,
    );
    assert.match(sidebar, /\.list \{[\s\S]*min-height: 0;[\s\S]*\}/);
    assert.match(compactPanels, /POSITION_TOLERANCE_PX/);
    assert.doesNotMatch(compactPanels, /scrollIntoView/);
    assert.match(compactPanels, /panels\.scrollLeft = target/);
});
