/**
 * @typedef {Object} RankingSnapshotEntry
 * @property {string} id
 * @property {string} name
 * @property {"vendor" | "reseller" | "other"} type
 * @property {number} sortOrder
 * @property {number} rankingScore
 */

/**
 * Fetch every page so exact-position estimates are not capped at the API's
 * 100-row page size.
 *
 * @param {{ apiBase: string, token: string, fetchImpl?: typeof fetch, signal?: AbortSignal }} options
 * @returns {Promise<RankingSnapshotEntry[]>}
 */
export async function fetchRankingSnapshot({
    apiBase,
    token,
    fetchImpl = fetch,
    signal,
}) {
    if (!token) throw new Error("A session token is required");

    /** @type {RankingSnapshotEntry[]} */
    const entries = [];
    let page = 1;
    let totalPages = 1;

    do {
        const url = new URL(
            `${apiBase.replace(/\/$/, "")}/directory/communities`,
        );
        url.searchParams.set("sort", "ranking");
        url.searchParams.set("order", "asc");
        url.searchParams.set("pageSize", "100");
        url.searchParams.set("page", String(page));

        const response = await fetchImpl(url.toString(), {
            headers: { "x-session-token": token },
            signal,
        });
        if (!response.ok) {
            throw new Error(`Ranking request failed with ${response.status}`);
        }

        const payload = await response.json();
        if (!payload?.success || !Array.isArray(payload.data)) {
            throw new Error("Ranking response was not valid");
        }

        for (const item of payload.data) {
            const sortOrder = Number(item.sortOrder ?? item.sortorder);
            const rankingScore = Number(item.rankingScore);
            if (
                typeof item.id !== "string" ||
                !Number.isInteger(sortOrder) ||
                sortOrder < 0
            ) {
                continue;
            }

            entries.push({
                id: item.id,
                name: typeof item.name === "string" ? item.name : "",
                type: item.type,
                sortOrder,
                rankingScore: Number.isFinite(rankingScore)
                    ? Math.max(0, rankingScore)
                    : 0,
            });
        }

        const nextTotal = Number(payload.meta?.pagination?.totalPages);
        totalPages = Number.isInteger(nextTotal)
            ? Math.max(1, Math.min(nextTotal, 1_000))
            : 1;
        page += 1;
    } while (page <= totalPages);

    return entries.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
}

/**
 * The directory list intentionally avoids joining the donation ledger, so its
 * rankingScore can be stale or zero. The exact profile endpoint calculates the
 * live decayed score for the one server we need.
 *
 * @param {{ apiBase: string, token: string, serverId: string, fetchImpl?: typeof fetch, signal?: AbortSignal }} options
 * @returns {Promise<number>}
 */
export async function fetchLiveRankingScore({
    apiBase,
    token,
    serverId,
    fetchImpl = fetch,
    signal,
}) {
    if (!token) throw new Error("A session token is required");
    if (!serverId) throw new Error("A server id is required");

    const response = await fetchImpl(
        `${apiBase.replace(/\/$/, "")}/directory/communities/${encodeURIComponent(
            serverId,
        )}`,
        {
            headers: { "x-session-token": token },
            signal,
        },
    );
    if (!response.ok) {
        throw new Error(`Ranking score request failed with ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data ?? payload;
    const rankingScore = Number(data?.rankingScore);
    if (!Number.isFinite(rankingScore)) {
        throw new Error("Ranking score response was not valid");
    }

    return Math.max(0, rankingScore);
}

/**
 * @param {{ currentRank: number, currentScore: number, targetRank: number, targetScore: number }} input
 * @returns {{ status: "already" | "estimate" | "placement", amount: number | null }}
 */
export function estimateDonationForPosition({
    currentRank,
    currentScore,
    targetRank,
    targetScore,
}) {
    if (currentRank <= targetRank) {
        return { status: "already", amount: 0 };
    }

    const scoreGap = targetScore - currentScore;
    if (scoreGap <= 0) {
        return { status: "placement", amount: null };
    }

    return {
        status: "estimate",
        amount: Math.floor(scoreGap) + 1,
    };
}
