import { RankPlannerPanel } from "./VendorRankPlanner";

const entries = [
    {
        id: "vendor-a",
        name: "Northstar Labs",
        type: "vendor" as const,
        sortOrder: 14,
        rankingScore: 82.75,
    },
    {
        id: "vendor-b",
        name: "Meridian Supply",
        type: "reseller" as const,
        sortOrder: 22,
        rankingScore: 41.2,
    },
];

const ready = {
    entries,
    selected: entries[0],
    selectedId: entries[0].id,
    onSelect: () => undefined,
    targetValue: "9",
    onTargetInput: () => undefined,
    onTargetBlur: () => undefined,
    maxRank: 38,
    targetEntry: {
        id: "target",
        name: "Target",
        type: "vendor" as const,
        sortOrder: 9,
        rankingScore: 100,
    },
    estimate: { status: "estimate" as const, amount: 18 },
    targetInvalid: false,
    onRefresh: () => undefined,
    refreshedAt: new Date("2026-08-11T12:00:00Z"),
};

const previewStates = [
    {
        label: "Default",
        className: "",
        ready: { ...ready, estimate: undefined },
    },
    { label: "Hover", className: "is-hover", ready },
    { label: "Focus", className: "is-focus", ready },
    { label: "Active", className: "is-active", ready },
    { label: "Disabled", className: "", ready: { ...ready, disabled: true } },
    { label: "Loading", state: "loading" as const },
    { label: "Error", state: "error" as const },
    { label: "Success", className: "is-success", ready },
];

export default function VendorRankPlannerPreview() {
    return (
        <section className="ranking-planner-preview">
            <h2>Vendor rank planner — interaction states</h2>
            {previewStates.map((preview) => (
                <div
                    className="ranking-planner-preview-row"
                    key={preview.label}>
                    <strong>{preview.label}</strong>
                    <RankPlannerPanel
                        language="en"
                        state={preview.state ?? "ready"}
                        ready={preview.state ? undefined : preview.ready}
                        onRetry={() => undefined}
                        forceClassName={preview.className}
                    />
                </div>
            ))}
        </section>
    );
}
