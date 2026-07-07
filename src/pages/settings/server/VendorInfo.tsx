import { observer } from "mobx-react-lite";
import { Server } from "revolt.js";
import { useEffect, useState } from "preact/hooks";
import { useClient } from "../../../controllers/client/ClientController";
import {
    defPay, defWh, defPr, defGu, defOr, toggle,
} from "../../directory/dataUtils";
import {
    PAYMENT_LABELS, WAREHOUSE_LABELS, PRODUCT_LABELS,
    GUARANTEE_LABELS, ORDER_LABELS, API_BASE,
} from "../../directory/types";
import type { Payment, Warehouses, Products, Guarantees, OrderTypes } from "../../directory/types";

interface VendorData {
    payment: Payment;
    warehouses: Warehouses;
    products: Products;
    guarantees: Guarantees;
    // purity/volume are numeric percentages (held as form strings); reship note
    purityPct: string;
    volumePct: string;
    reshipText: string;
    orderTypes: OrderTypes;
    shippingTime: string;
    freeShipping: boolean;
    freeShippingThreshold: string;
}

const defaultData = (): VendorData => ({
    payment: { ...defPay },
    warehouses: { ...defWh },
    products: { ...defPr },
    guarantees: { ...defGu },
    purityPct: "",
    volumePct: "",
    reshipText: "",
    orderTypes: { ...defOr },
    shippingTime: "",
    freeShipping: false,
    freeShippingThreshold: "",
});

const numToStr = (v: unknown) => (typeof v === "number" ? String(v) : "");

function apiToData(c: any): VendorData {
    const apiGu = c.guarantee ?? {};
    return {
        payment: { ...defPay, ...(c.payment ?? {}) },
        warehouses: { ...defWh, ...(c.warehouses ?? {}) },
        products: { ...defPr, ...(c.products ?? {}) },
        guarantees: {
            purity: apiGu.purity ?? false,
            volume: apiGu.volume ?? false,
            reship: apiGu.reship ?? false,
        },
        purityPct: numToStr(apiGu.purityPct),
        volumePct: numToStr(apiGu.volumePct),
        reshipText: apiGu.reshipDesc ?? "",
        orderTypes: { ...defOr, ...(c.orderTypes ?? {}) },
        shippingTime: c.shippingTime ?? "",
        freeShipping: c.freeShipping ?? false,
        freeShippingThreshold: numToStr(c.freeShippingThreshold),
    };
}

function buildPayload(form: VendorData, isReseller: boolean) {
    return {
        payment: form.payment,
        warehouses: form.warehouses,
        products: form.products,
        guarantee: {
            purity: form.guarantees.purity, purityPct: form.purityPct ? Number(form.purityPct) : null,
            volume: form.guarantees.volume, volumePct: form.volumePct ? Number(form.volumePct) : null,
            reship: form.guarantees.reship, reshipDesc: form.reshipText,
        },
        orderTypes: isReseller ? form.orderTypes : undefined,
        shippingTime: form.shippingTime || undefined,
        freeShipping: form.freeShipping,
        freeShippingThreshold: form.freeShippingThreshold ? Number(form.freeShippingThreshold) : undefined,
    };
}

const S = {
    wrap: { padding: "24px", maxWidth: "680px" } as const,
    section: { marginBottom: "24px" } as const,
    label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--secondary-foreground)", marginBottom: "8px" } as const,
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "6px", marginBottom: "8px" } as const,
    checkItem: (checked: boolean) => ({
        display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px",
        borderRadius: "6px", cursor: "pointer", fontSize: "13px",
        background: checked ? "var(--accent)" : "var(--secondary-background)",
        color: checked ? "white" : "var(--foreground)",
        transition: "background 0.15s",
    } as const),
    input: { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--tertiary-foreground)", background: "var(--secondary-background)", color: "var(--foreground)", fontSize: "13px", boxSizing: "border-box" as const },
    row: { display: "flex", gap: "12px", marginBottom: "8px" } as const,
    btn: (variant: "primary" | "outline") => ({
        padding: "8px 18px", borderRadius: "6px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
        background: variant === "primary" ? "var(--accent)" : "transparent",
        color: variant === "primary" ? "white" : "var(--foreground)",
        border: variant === "primary" ? "none" : "1px solid var(--tertiary-foreground)",
    } as const),
    status: (ok: boolean) => ({ fontSize: "13px", color: ok ? "var(--success)" : "var(--error)", marginLeft: "12px" } as const),
    divider: { borderTop: "1px solid var(--tertiary-foreground)", margin: "20px 0" } as const,
};

interface Props { server: Server }

export const VendorInfo = observer(({ server }: Props) => {
    const client = useClient();
    const [form, setForm] = useState<VendorData>(defaultData());
    const [isReseller, setIsReseller] = useState(false);
    const [loadState, setLoadState] = useState<"loading" | "ready" | "notlisted">("loading");
    const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
    const [errMsg, setErrMsg] = useState("");

    useEffect(() => {
        fetch(`${API_BASE}/directory/communities/${server._id}`)
            .then((r) => r.json())
            .then((res) => {
                const data = res.data ?? res;
                if (!data?.id) { setLoadState("notlisted"); return; }
                setIsReseller(data.type === "reseller");
                setForm(apiToData(data));
                setLoadState("ready");
            })
            .catch(() => setLoadState("notlisted"));
    }, [server._id]);

    const sessionToken = typeof client.session === "string"
        ? client.session
        : (client.session as any)?.token ?? "";

    async function handleSave(e: Event) {
        e.preventDefault();
        if (!sessionToken) { setErrMsg("No active session"); setSaveState("error"); return; }
        setSaveState("saving");
        try {
            const r = await fetch(`${API_BASE}/directory/communities/owner/${server._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "X-Revolt-Token": sessionToken },
                body: JSON.stringify(buildPayload(form, isReseller)),
            });
            const res = await r.json();
            if (!r.ok) throw new Error(res?.error?.message || "Save failed");
            setSaveState("ok");
            setTimeout(() => setSaveState("idle"), 3000);
        } catch (e: any) {
            setErrMsg(e.message);
            setSaveState("error");
        }
    }

    if (loadState === "loading") return <div style={S.wrap}>Loading vendor info…</div>;
    if (loadState === "notlisted") {
        return (
            <div style={S.wrap}>
                <h3>Vendor Info</h3>
                <p style={{ color: "var(--secondary-foreground)", fontSize: "14px", marginTop: "8px" }}>
                    This server does not have a directory listing. Contact an admin to get listed.
                </p>
            </div>
        );
    }

    return (
        <div style={S.wrap}>
            <h3 style={{ marginBottom: "4px" }}>Vendor Info</h3>
            <p style={{ fontSize: "13px", color: "var(--secondary-foreground)", marginBottom: "20px" }}>
                Update your vendor details shown in the PepChat directory.
            </p>

            <form onSubmit={handleSave}>
                {/* Payment Methods */}
                <div style={S.section}>
                    <div style={S.label}>Payment Methods</div>
                    <div style={S.grid}>
                        {(Object.keys(PAYMENT_LABELS) as (keyof typeof PAYMENT_LABELS)[]).map((k) => (
                            <label key={k} style={S.checkItem(!!form.payment[k])}>
                                <input type="checkbox" style={{ display: "none" }} checked={!!form.payment[k]}
                                    onChange={() => setForm((f) => ({ ...f, payment: toggle(f.payment, k) }))} />
                                {PAYMENT_LABELS[k]}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={S.divider} />

                {/* Warehouses */}
                <div style={S.section}>
                    <div style={S.label}>Warehouses</div>
                    <div style={S.grid}>
                        {(Object.keys(WAREHOUSE_LABELS) as (keyof Warehouses)[]).map((k) => (
                            <label key={k} style={S.checkItem(!!form.warehouses[k])}>
                                <input type="checkbox" style={{ display: "none" }} checked={!!form.warehouses[k]}
                                    onChange={() => setForm((f) => ({ ...f, warehouses: toggle(f.warehouses, k) }))} />
                                {WAREHOUSE_LABELS[k]}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={S.divider} />

                {/* Products */}
                <div style={S.section}>
                    <div style={S.label}>Products</div>
                    <div style={S.grid}>
                        {(Object.keys(PRODUCT_LABELS) as (keyof typeof PRODUCT_LABELS)[]).map((k) => (
                            <label key={k} style={S.checkItem(!!form.products[k])}>
                                <input type="checkbox" style={{ display: "none" }} checked={!!form.products[k]}
                                    onChange={() => setForm((f) => ({ ...f, products: toggle(f.products, k) }))} />
                                {PRODUCT_LABELS[k]}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={S.divider} />

                {/* Guarantees — purity/volume are numeric %, reship is a note */}
                <div style={S.section}>
                    <div style={S.label}>Guarantees</div>
                    {([
                        { k: "purity", field: "purityPct", numeric: true },
                        { k: "volume", field: "volumePct", numeric: true },
                        { k: "reship", field: "reshipText", numeric: false },
                    ] as const).map(({ k, field, numeric }) => (
                        <div key={k} style={{ marginBottom: "12px" }}>
                            <label style={S.checkItem(form.guarantees[k])}>
                                <input type="checkbox" style={{ display: "none" }} checked={form.guarantees[k]}
                                    onChange={() => setForm((f) => ({ ...f, guarantees: toggle(f.guarantees, k) }))} />
                                {GUARANTEE_LABELS[k]}
                            </label>
                            <input
                                type={numeric ? "number" : "text"}
                                min={numeric ? 0 : undefined}
                                max={numeric ? 100 : undefined}
                                placeholder={numeric ? "% e.g. 99" : "e.g. reship if seized by customs"}
                                style={{ ...S.input, marginTop: "4px", fontSize: "12px" }}
                                value={form[field]}
                                onInput={(e) => setForm((f) => ({ ...f, [field]: (e.target as HTMLInputElement).value }))}
                            />
                        </div>
                    ))}
                </div>

                <div style={S.divider} />

                {/* Shipping */}
                <div style={S.section}>
                    <div style={S.label}>Shipping</div>
                    <div style={S.row}>
                        <input type="text" style={S.input} placeholder="Shipping time e.g. 3-5 days"
                            value={form.shippingTime}
                            onInput={(e) => setForm((f) => ({ ...f, shippingTime: (e.target as HTMLInputElement).value }))} />
                        <input type="number" min={0} style={S.input} placeholder="Free shipping threshold e.g. 150"
                            value={form.freeShippingThreshold}
                            onInput={(e) => setForm((f) => ({ ...f, freeShippingThreshold: (e.target as HTMLInputElement).value }))} />
                    </div>
                    <label style={{ ...S.checkItem(form.freeShipping), display: "inline-flex", marginTop: "4px" }}>
                        <input type="checkbox" style={{ display: "none" }} checked={form.freeShipping}
                            onChange={() => setForm((f) => ({ ...f, freeShipping: !f.freeShipping }))} />
                        Free shipping available
                    </label>
                </div>

                {/* Order Types — reseller only */}
                {isReseller && (
                    <>
                        <div style={S.divider} />
                        <div style={S.section}>
                            <div style={S.label}>Order Types</div>
                            <div style={S.grid}>
                                {(Object.keys(ORDER_LABELS) as (keyof OrderTypes)[]).map((k) => (
                                    <label key={k} style={S.checkItem(form.orderTypes[k])}>
                                        <input type="checkbox" style={{ display: "none" }} checked={form.orderTypes[k]}
                                            onChange={() => setForm((f) => ({ ...f, orderTypes: toggle(f.orderTypes, k) }))} />
                                        {ORDER_LABELS[k]}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div style={{ display: "flex", alignItems: "center", marginTop: "24px" }}>
                    <button type="submit" style={S.btn("primary")} disabled={saveState === "saving"}>
                        {saveState === "saving" ? "Saving…" : "Save Changes"}
                    </button>
                    {saveState === "ok" && <span style={S.status(true)}>Saved!</span>}
                    {saveState === "error" && <span style={S.status(false)}>{errMsg}</span>}
                </div>
            </form>
        </div>
    );
});
