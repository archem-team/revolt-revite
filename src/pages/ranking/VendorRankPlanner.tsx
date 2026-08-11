import { observer } from "mobx-react-lite";

import { useEffect, useState } from "preact/hooks";

import {
    clientController,
    useClient,
} from "../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../directory/types";
import {
    estimateDonationForPosition,
    fetchLiveRankingScore,
    fetchRankingSnapshot,
} from "./rankingEstimate";

type Language = "en" | "zh";
type SnapshotEntry = Awaited<ReturnType<typeof fetchRankingSnapshot>>[number];
type PanelState = "loading" | "error" | "logged-out" | "empty" | "ready";

const plannerCopy = {
    en: {
        title: "Plan a target position",
        intro: "Choose a directory position to estimate the support needed at today’s published scores.",
        serverLabel: "Vendor server",
        currentPosition: "Current position",
        currentScore: "Current score",
        targetLabel: "Target position",
        targetHint: (max: number) => `Choose a position from 1 to ${max}.`,
        targetError: (max: number) =>
            `Enter a whole position from 1 to ${max}.`,
        targetScore: "Score to overtake",
        donation: "Estimated donation",
        already: "Already at or above this position",
        placement: "This position is not currently reachable by score alone.",
        placementHint:
            "A placement agreement may be controlling the order. Choose another position or check again after the ranking refreshes.",
        estimateHint:
            "A newly recorded $1 adds 1 point today. The estimate rounds up to the next whole dollar.",
        caveat: "Live estimate only. Other donations, daily score decay, and placement agreements can change the amount and final position.",
        refresh: "Refresh scores",
        refreshed: "Scores refreshed",
        loadingTitle: "Loading your ranking",
        loadingBody: "Reading the current directory positions and scores.",
        errorTitle: "Ranking data didn’t load",
        errorBody: "The current scores are unavailable. Refresh and try again.",
        retry: "Try again",
        loggedOutTitle: "See your vendor estimate",
        loggedOutBody:
            "Sign in with a vendor manager account to calculate the support needed for a target position.",
        signIn: "Sign in",
        emptyTitle: "No listed vendor found",
        emptyBody:
            "This account does not manage a listed vendor or reseller server.",
        back: "Back to PepChat",
    },
    zh: {
        title: "规划目标排名",
        intro: "选择目录中的目标位置，根据今天公布的分数估算所需支持金额。",
        serverLabel: "商家服务器",
        currentPosition: "当前位置",
        currentScore: "当前得分",
        targetLabel: "目标位置",
        targetHint: (max: number) => `请选择 1 至 ${max} 的位置。`,
        targetError: (max: number) => `请输入 1 至 ${max} 的整数位置。`,
        targetScore: "需要超过的分数",
        donation: "预计捐赠金额",
        already: "当前排名已经达到或超过此位置",
        placement: "目前无法仅通过分数达到此位置。",
        placementHint:
            "该位置可能受到排名协议影响。请选择其他位置，或在排名刷新后重试。",
        estimateHint:
            "今天新记录的 1 美元会增加 1 分；估算金额向上取整到下一美元。",
        caveat: "仅为实时估算。其他捐赠、每日分数衰减和排名协议都可能改变金额和最终位置。",
        refresh: "刷新分数",
        refreshed: "分数已刷新",
        loadingTitle: "正在加载您的排名",
        loadingBody: "正在读取当前目录位置和分数。",
        errorTitle: "无法加载排名数据",
        errorBody: "当前分数暂不可用。请刷新后重试。",
        retry: "重试",
        loggedOutTitle: "查看您的商家估算",
        loggedOutBody:
            "请使用商家管理员账户登录，以计算达到目标位置所需的支持金额。",
        signIn: "登录",
        emptyTitle: "未找到已上架商家",
        emptyBody: "此账户未管理已上架的商家或经销商服务器。",
        back: "返回 PepChat",
    },
} as const;

type PlannerCopy = typeof plannerCopy[Language];

interface ReadyPanelProps {
    entries: SnapshotEntry[];
    selected: SnapshotEntry;
    selectedId: string;
    onSelect: (id: string) => void;
    targetValue: string;
    onTargetInput: (value: string) => void;
    onTargetBlur: () => void;
    maxRank: number;
    targetEntry?: SnapshotEntry;
    estimate?: ReturnType<typeof estimateDonationForPosition>;
    targetInvalid: boolean;
    onRefresh: () => void;
    refreshedAt: Date | null;
    disabled?: boolean;
}

interface RankPlannerPanelProps {
    language: Language;
    state: PanelState;
    onRetry?: () => void;
    ready?: ReadyPanelProps;
    forceClassName?: string;
}

export function RankPlannerPanel({
    language,
    state,
    onRetry,
    ready,
    forceClassName = "",
}: RankPlannerPanelProps) {
    const t: PlannerCopy = plannerCopy[language];
    const locale = language === "zh" ? "zh-CN" : "en-US";
    const currency = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    });
    const score = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const refreshedTime = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
    });

    if (state === "loading") {
        return (
            <section
                className={`ranking-planner is-loading ${forceClassName}`}
                aria-busy="true">
                <div className="ranking-planner-status-copy">
                    <h2>{t.loadingTitle}</h2>
                    <p>{t.loadingBody}</p>
                </div>
                <div className="ranking-planner-skeleton" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
            </section>
        );
    }

    if (state === "error") {
        return (
            <section
                className={`ranking-planner is-error ${forceClassName}`}
                role="alert">
                <div className="ranking-planner-status-copy">
                    <h2>{t.errorTitle}</h2>
                    <p>{t.errorBody}</p>
                </div>
                <button
                    className="ranking-planner-button"
                    type="button"
                    onClick={onRetry}>
                    {t.retry}
                </button>
            </section>
        );
    }

    if (state === "logged-out" || state === "empty") {
        const loggedOut = state === "logged-out";
        return (
            <section className={`ranking-planner is-empty ${forceClassName}`}>
                <div className="ranking-planner-status-copy">
                    <h2>{loggedOut ? t.loggedOutTitle : t.emptyTitle}</h2>
                    <p>{loggedOut ? t.loggedOutBody : t.emptyBody}</p>
                </div>
                <a
                    className="ranking-planner-button"
                    href={loggedOut ? "/login" : "/"}>
                    {loggedOut ? t.signIn : t.back}
                </a>
            </section>
        );
    }

    if (!ready) return null;

    const estimateStatus = ready.estimate?.status;
    const resultValue =
        estimateStatus === "placement"
            ? "—"
            : ready.estimate
            ? currency.format(ready.estimate.amount ?? 0)
            : "—";
    const resultText =
        estimateStatus === "already"
            ? t.already
            : estimateStatus === "placement"
            ? t.placement
            : t.estimateHint;

    return (
        <section
            className={`ranking-planner ${
                estimateStatus ? "is-success" : ""
            } ${forceClassName}`}
            data-state={estimateStatus ? "success" : "default"}>
            <header className="ranking-planner-header">
                <div>
                    <h2>{t.title}</h2>
                    <p>{t.intro}</p>
                </div>
                <button
                    className="ranking-planner-refresh"
                    type="button"
                    disabled={ready.disabled}
                    onClick={ready.onRefresh}>
                    {t.refresh}
                </button>
            </header>

            <div className="ranking-planner-identity">
                <label>
                    <span>{t.serverLabel}</span>
                    {ready.entries.length > 1 ? (
                        <select
                            value={ready.selectedId}
                            disabled={ready.disabled}
                            onInput={(event) =>
                                ready.onSelect(event.currentTarget.value)
                            }>
                            {ready.entries.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                    {entry.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <strong>{ready.selected.name}</strong>
                    )}
                </label>
                <dl className="ranking-planner-current">
                    <div>
                        <dt>{t.currentPosition}</dt>
                        <dd>
                            {"#"}
                            {ready.selected.sortOrder}
                        </dd>
                    </div>
                    <div>
                        <dt>{t.currentScore}</dt>
                        <dd>
                            {Number.isFinite(ready.selected.rankingScore)
                                ? score.format(ready.selected.rankingScore)
                                : "—"}
                        </dd>
                    </div>
                </dl>
            </div>

            <div className="ranking-planner-workbench">
                <label className="ranking-planner-target">
                    <span>{t.targetLabel}</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={ready.maxRank}
                        step="1"
                        value={ready.targetValue}
                        disabled={ready.disabled}
                        aria-invalid={ready.targetInvalid}
                        aria-describedby="ranking-target-help"
                        onInput={(event) =>
                            ready.onTargetInput(event.currentTarget.value)
                        }
                        onBlur={ready.onTargetBlur}
                    />
                    <small
                        id="ranking-target-help"
                        className={ready.targetInvalid ? "is-error" : ""}>
                        {ready.targetInvalid
                            ? t.targetError(ready.maxRank)
                            : t.targetHint(ready.maxRank)}
                    </small>
                </label>

                <div className="ranking-planner-threshold">
                    <span>{t.targetScore}</span>
                    <strong>
                        {ready.targetEntry &&
                        Number.isFinite(ready.targetEntry.rankingScore)
                            ? score.format(ready.targetEntry.rankingScore)
                            : "—"}
                    </strong>
                </div>

                <div className="ranking-planner-answer" aria-live="polite">
                    <span>{t.donation}</span>
                    <strong>{resultValue}</strong>
                    <p>{resultText}</p>
                    {estimateStatus === "placement" && (
                        <small>{t.placementHint}</small>
                    )}
                </div>
            </div>

            <footer className="ranking-planner-footer">
                <p>{t.caveat}</p>
                {ready.refreshedAt && (
                    <span>{`${t.refreshed}: ${refreshedTime.format(
                        ready.refreshedAt,
                    )}`}</span>
                )}
            </footer>
        </section>
    );
}

export const VendorRankPlanner = observer(
    ({ language }: { language: Language }) => {
        const client = useClient();
        const loggedIn = clientController.isLoggedIn();
        const clientReady = Boolean(clientController.isReady());
        const sessionToken =
            typeof client.session === "string"
                ? client.session
                : (client.session as { token?: string } | undefined)?.token ??
                  "";
        const [entries, setEntries] = useState<SnapshotEntry[]>([]);
        const [loadState, setLoadState] = useState<
            "loading" | "ready" | "error"
        >("loading");
        const [selectedId, setSelectedId] = useState("");
        const [targetValue, setTargetValue] = useState("");
        const [targetTouched, setTargetTouched] = useState(false);
        const [retryKey, setRetryKey] = useState(0);
        const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
        const [liveScores, setLiveScores] = useState<Record<string, number>>(
            {},
        );
        const [scoresLoading, setScoresLoading] = useState(false);

        useEffect(() => {
            if (!loggedIn || !sessionToken) return;
            const controller = new AbortController();
            setLoadState("loading");

            fetchRankingSnapshot({
                apiBase: BACKEND_API_BASE,
                token: sessionToken,
                signal: controller.signal,
                })
                .then((nextEntries) => {
                    setEntries(nextEntries);
                    setRefreshedAt(new Date());
                    setLoadState("ready");
                })
                .catch((error) => {
                    if (error?.name !== "AbortError") setLoadState("error");
                });

            return () => controller.abort();
        }, [loggedIn, sessionToken, retryKey]);

        const manageableIds = new Set(
            [...client.servers.values()]
                .filter(
                    (server) =>
                        server.owner === client.user?._id ||
                        server.havePermission("ManageServer"),
                )
                .map((server) => server._id),
        );
        const vendorEntries = entries.filter(
            (entry) =>
                (entry.type === "vendor" || entry.type === "reseller") &&
                entry.sortOrder > 0 &&
                manageableIds.has(entry.id),
        );
        const effectiveSelectedId = vendorEntries.some(
            (entry) => entry.id === selectedId,
        )
            ? selectedId
            : vendorEntries[0]?.id ?? "";
        const selected = vendorEntries.find(
            (entry) => entry.id === effectiveSelectedId,
        );
        const maxRank = entries.reduce(
            (max, entry) => Math.max(max, entry.sortOrder),
            1,
        );

        const selectedKey = selected?.id;
        const selectedRank = selected?.sortOrder;
        useEffect(() => {
            if (!selectedKey || selectedRank === undefined) return;
            setTargetValue(String(Math.max(1, selectedRank - 1)));
            setTargetTouched(false);
        }, [selectedKey, selectedRank]);

        const requestedTargetRank = Number(targetValue);
        const requestedTargetEntry = entries.find(
            (entry) => entry.sortOrder === requestedTargetRank,
        );
        const scoreRequestKey = [selected?.id, requestedTargetEntry?.id]
            .filter(Boolean)
            .join("|");

        useEffect(() => {
            if (!sessionToken || !selected || !requestedTargetEntry) return;

            const ids = [selected.id, requestedTargetEntry.id].filter(
                (id, index, all) =>
                    all.indexOf(id) === index &&
                    !Object.prototype.hasOwnProperty.call(liveScores, id),
            );
            if (!ids.length) {
                setScoresLoading(false);
                return;
            }

            const controller = new AbortController();
            setScoresLoading(true);
            Promise.all(
                ids.map(async (id) => [
                    id,
                    await fetchLiveRankingScore({
                        apiBase: BACKEND_API_BASE,
                        token: sessionToken,
                        serverId: id,
                        signal: controller.signal,
                    }),
                ] as const),
            )
                .then((scores) => {
                    setLiveScores((current) => ({
                        ...current,
                        ...Object.fromEntries(scores),
                    }));
                    setScoresLoading(false);
                })
                .catch((error) => {
                    if (error?.name !== "AbortError") setLoadState("error");
                });

            return () => controller.abort();
        }, [
            liveScores,
            requestedTargetEntry,
            retryKey,
            scoreRequestKey,
            selected,
            sessionToken,
        ]);

        if (!loggedIn) {
            return <RankPlannerPanel language={language} state="logged-out" />;
        }
        if (!sessionToken || !clientReady || loadState === "loading") {
            return <RankPlannerPanel language={language} state="loading" />;
        }
        if (loadState === "error") {
            return (
                <RankPlannerPanel
                    language={language}
                    state="error"
                    onRetry={() => {
                        setLiveScores({});
                        setRetryKey((value) => value + 1);
                    }}
                />
            );
        }
        if (!selected) {
            return <RankPlannerPanel language={language} state="empty" />;
        }

        const targetRank = requestedTargetRank;
        const targetEntry = entries.find(
            (entry) => entry.sortOrder === targetRank,
        );
        const targetValid =
            Number.isInteger(targetRank) &&
            targetRank >= 1 &&
            targetRank <= maxRank &&
            Boolean(targetEntry);
        const selectedLiveScore = liveScores[selected.id];
        const targetLiveScore = targetEntry
            ? liveScores[targetEntry.id]
            : undefined;
        const scoredSelected = {
            ...selected,
            rankingScore: selectedLiveScore ?? Number.NaN,
        };
        const scoredTargetEntry = targetEntry
            ? {
                  ...targetEntry,
                  rankingScore: targetLiveScore ?? Number.NaN,
              }
            : undefined;
        const estimate =
            targetValid &&
            targetEntry &&
            Number.isFinite(selectedLiveScore) &&
            Number.isFinite(targetLiveScore)
                ? estimateDonationForPosition({
                      currentRank: selected.sortOrder,
                      currentScore: selectedLiveScore,
                      targetRank,
                      targetScore: targetLiveScore,
                  })
                : undefined;

        return (
            <RankPlannerPanel
                language={language}
                state="ready"
                ready={{
                    entries: vendorEntries,
                    selected: scoredSelected,
                    selectedId: effectiveSelectedId,
                    onSelect: setSelectedId,
                    targetValue,
                    onTargetInput: setTargetValue,
                    onTargetBlur: () => setTargetTouched(true),
                    maxRank,
                    targetEntry: scoredTargetEntry,
                    estimate,
                    targetInvalid: targetTouched && !targetValid,
                    onRefresh: () => {
                        setLiveScores({});
                        setRetryKey((value) => value + 1);
                    },
                    refreshedAt,
                    disabled: scoresLoading,
                }}
            />
        );
    },
);
