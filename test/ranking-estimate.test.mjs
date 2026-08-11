import assert from "node:assert/strict";
import test from "node:test";

import {
    estimateDonationForPosition,
    fetchLiveRankingScore,
    fetchRankingSnapshot,
} from "../src/pages/ranking/rankingEstimate.js";

test("estimate adds the next whole dollar needed to overtake a score", () => {
    assert.deepEqual(
        estimateDonationForPosition({
            currentRank: 18,
            currentScore: 82.75,
            targetRank: 9,
            targetScore: 100,
        }),
        { status: "estimate", amount: 18 },
    );
    assert.deepEqual(
        estimateDonationForPosition({
            currentRank: 18,
            currentScore: 80,
            targetRank: 9,
            targetScore: 100,
        }),
        { status: "estimate", amount: 21 },
    );
});

test("estimate returns zero when the vendor is already at the target", () => {
    assert.deepEqual(
        estimateDonationForPosition({
            currentRank: 4,
            currentScore: 500,
            targetRank: 9,
            targetScore: 120,
        }),
        { status: "already", amount: 0 },
    );
});

test("estimate identifies positions controlled by more than score", () => {
    assert.deepEqual(
        estimateDonationForPosition({
            currentRank: 14,
            currentScore: 250,
            targetRank: 3,
            targetScore: 40,
        }),
        { status: "placement", amount: null },
    );
});

test("snapshot fetch follows pagination and normalises ranking fields", async () => {
    const requests = [];
    const pages = [
        {
            success: true,
            data: [
                {
                    id: "official",
                    name: "PepChat",
                    type: "other",
                    sortOrder: 0,
                    rankingScore: 0,
                },
                {
                    id: "vendor-a",
                    name: "Vendor A",
                    type: "vendor",
                    sortOrder: 1,
                    rankingScore: 250.5,
                },
            ],
            meta: { pagination: { totalPages: 2 } },
        },
        {
            success: true,
            data: [
                {
                    id: "vendor-b",
                    name: "Vendor B",
                    type: "reseller",
                    sortOrder: 2,
                    rankingScore: null,
                },
            ],
            meta: { pagination: { totalPages: 2 } },
        },
    ];

    const entries = await fetchRankingSnapshot({
        apiBase: "https://peptide.chat/api/",
        token: "session-token",
        fetchImpl: async (url, init) => {
            requests.push({ url, init });
            return {
                ok: true,
                status: 200,
                json: async () => pages[requests.length - 1],
            };
        },
    });

    assert.equal(requests.length, 2);
    assert.equal(new URL(requests[1].url).searchParams.get("page"), "2");
    assert.equal(requests[0].init.headers["x-session-token"], "session-token");
    assert.deepEqual(
        entries.map(({ id, rankingScore }) => ({ id, rankingScore })),
        [
            { id: "official", rankingScore: 0 },
            { id: "vendor-a", rankingScore: 250.5 },
            { id: "vendor-b", rankingScore: 0 },
        ],
    );
});

test("live score fetch uses the exact profile endpoint", async () => {
    let request;
    const score = await fetchLiveRankingScore({
        apiBase: "https://peptide.chat/api/",
        token: "session-token",
        serverId: "vendor/a",
        fetchImpl: async (url, init) => {
            request = { url, init };
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    data: { rankingScore: 123.45 },
                }),
            };
        },
    });

    assert.equal(score, 123.45);
    assert.equal(
        request.url,
        "https://peptide.chat/api/directory/communities/vendor%2Fa",
    );
    assert.equal(request.init.headers["x-session-token"], "session-token");
});
