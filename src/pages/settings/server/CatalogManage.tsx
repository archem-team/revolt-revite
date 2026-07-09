import { observer } from "mobx-react-lite";
import { Server } from "revolt.js";
import { useEffect, useState } from "preact/hooks";
import { useClient } from "../../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../../directory/types";

// ─── Types ───────────────────────────────────────────────────────────

interface Variation {
    dosage?: string | null;
    price: number;
    display_quantity?: string | null;
    unit?: string | null;
    note?: string | null;
}

interface CatalogEntry {
    id: string;
    serverId?: string | null;
    product: string;
    normalized?: string | null;
    variations: Variation[];
    currency: string;
    sku?: string | null;
    categories: string[];
    source: string;
    active: boolean;
    fromPrice: number;
    toPrice?: number | null;
    createdAt: string;
    updatedAt: string;
}

interface EntryListResponse {
    success: boolean;
    data: { items: CatalogEntry[]; pagination: any };
}

// ─── Inline styles ───────────────────────────────────────────────────

const S = {
    wrap: { padding: "24px", maxWidth: "860px" } as const,
    btn: (variant: "primary" | "danger" | "outline") => ({
        padding: "8px 18px", borderRadius: "6px", fontSize: "14px", fontWeight: 600,
        cursor: "pointer",
        background: variant === "primary" ? "var(--accent)" :
                    variant === "danger" ? "var(--error)" : "transparent",
        color: variant === "outline" ? "var(--foreground)" : "white",
        border: variant === "outline" ? "1px solid var(--tertiary-foreground)" : "none",
    } as const),
    input: { width: "100%", padding: "8px 10px", borderRadius: "6px",
        border: "1px solid var(--tertiary-foreground)", background: "var(--secondary-background)",
        color: "var(--foreground)", fontSize: "13px", boxSizing: "border-box" as const },
    label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const,
        letterSpacing: "0.06em", color: "var(--secondary-foreground)", marginBottom: "6px" } as const,
    card: { background: "var(--secondary-background)", borderRadius: "8px", padding: "16px",
        marginBottom: "12px", border: "1px solid var(--tertiary-foreground)" } as const,
    row: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" as const },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "6px" } as const,
    status: (ok: boolean) => ({ fontSize: "13px", color: ok ? "var(--success)" : "var(--error)", marginLeft: "12px" } as const),
    divider: { borderTop: "1px solid var(--tertiary-foreground)", margin: "16px 0" } as const,
};

// ─── Variation row in the form ───────────────────────────────────────

function VariationRow({ v, idx, onChange, onRemove }: {
    v: Variation; idx: number;
    onChange: (idx: number, v: Variation) => void;
    onRemove: (idx: number) => void;
}) {
    return (
        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
            <input style={{ ...S.input, width: "90px" }} placeholder="Dosage" value={v.dosage ?? ""}
                onInput={e => onChange(idx, { ...v, dosage: (e.target as HTMLInputElement).value })} />
            <input style={{ ...S.input, width: "80px" }} type="number" step="0.01" placeholder="Price" value={v.price || ""}
                onInput={e => onChange(idx, { ...v, price: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
            <input style={{ ...S.input, width: "70px" }} placeholder="Unit" value={v.unit ?? ""}
                onInput={e => onChange(idx, { ...v, unit: (e.target as HTMLInputElement).value })} />
            <button style={S.btn("danger")} onClick={() => onRemove(idx)}>×</button>
        </div>
    );
}

// ─── Edit form for one product ───────────────────────────────────────

function ProductForm({ initial, onSave, onCancel }: {
    initial?: Partial<CatalogEntry>;
    onSave: (data: any) => void;
    onCancel: () => void;
}) {
    const [product, setProduct] = useState(initial?.product ?? "");
    const [sku, setSku] = useState(initial?.sku ?? "");
    const [currency, setCurrency] = useState(initial?.currency ?? "USD");
    const [categories, setCategories] = useState((initial?.categories ?? []).join(", "));
    const [variations, setVariations] = useState<Variation[]>(
        initial?.variations?.length ? initial.variations : [{ dosage: "", price: 0, unit: "kit" }]
    );

    function updateVar(idx: number, v: Variation) {
        setVariations(variations.map((x, i) => i === idx ? v : x));
    }
    function removeVar(idx: number) {
        setVariations(variations.filter((_, i) => i !== idx));
    }
    function addVar() {
        setVariations([...variations, { dosage: "", price: 0, unit: "kit" }]);
    }

    function handleSave() {
        const catArr = categories.split(",").map(c => c.trim()).filter(Boolean);
        const cleanVars = variations.filter(v => v.price > 0 || v.dosage);
        if (!product || cleanVars.length === 0) return;
        onSave({
            product: product.trim(),
            normalized: product.trim().toLowerCase(),
            sku: sku.trim() || null,
            currency,
            categories: catArr,
            variations: cleanVars,
        });
    }

    return (
        <div style={S.card}>
            <div style={S.label}>Product Name</div>
            <input style={{ ...S.input, marginBottom: 8 }} value={product}
                onInput={e => setProduct((e.target as HTMLInputElement).value)} placeholder="e.g. Tirzepatide" />

            <div style={S.row}>
                <div style={{ flex: 1 }}>
                    <div style={S.label}>SKU (optional)</div>
                    <input style={S.input} value={sku} onInput={e => setSku((e.target as HTMLInputElement).value)} />
                </div>
                <div style={{ width: 100 }}>
                    <div style={S.label}>Currency</div>
                    <select style={S.input} value={currency} onChange={e => setCurrency(e.currentTarget.value)}>
                        <option value="USD">USD</option><option value="CNY">CNY</option>
                    </select>
                </div>
            </div>

            <div style={S.label}>Categories (comma-separated)</div>
            <input style={{ ...S.input, marginBottom: 12 }} value={categories}
                onInput={e => setCategories((e.target as HTMLInputElement).value)}
                placeholder="e.g. Peptides, GLP-1" />

            <div style={S.label}>Variations (dosage + price)</div>
            {variations.map((v, i) => (
                <VariationRow key={i} v={v} idx={i} onChange={updateVar} onRemove={removeVar} />
            ))}
            <button style={{ ...S.btn("outline"), marginTop: 4 }} onClick={addVar}>+ Add variation</button>

            <div style={S.divider} />
            <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn("primary")} onClick={handleSave}>Save</button>
                <button style={S.btn("outline")} onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────

interface Props { server: Server }

export const CatalogManage = observer(({ server }: Props) => {
    const client = useClient();
    const [entries, setEntries] = useState<CatalogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
    const [errMsg, setErrMsg] = useState("");

    const sessionToken = typeof client.session === "string"
        ? client.session : (client.session as any)?.token ?? "";
    const headers = { "x-session-token": sessionToken, "Content-Type": "application/json" };
    const sid = server._id;

    function loadEntries() {
        setLoading(true);
        fetch(`${BACKEND_API_BASE}/catalog?serverId=${sid}&pageSize=200`, { headers })
            .then(r => r.json())
            .then((res: EntryListResponse) => {
                if (res?.success) setEntries(res.data.items);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }

    useEffect(() => { loadEntries(); }, [sid]);

    async function handleCreate(data: any) {
        setSaveState("saving");
        try {
            const r = await fetch(`${BACKEND_API_BASE}/catalog`, {
                method: "POST", headers,
                body: JSON.stringify({ ...data, serverId: sid }),
            });
            const res = await r.json();
            if (!r.ok) throw new Error(res?.error || "Failed to create");
            setShowNewForm(false);
            setSaveState("ok");
            setTimeout(() => setSaveState("idle"), 2000);
            loadEntries();
        } catch (e: any) {
            setErrMsg(e.message); setSaveState("error");
        }
    }

    async function handleUpdate(id: string, data: any) {
        setSaveState("saving");
        try {
            const r = await fetch(`${BACKEND_API_BASE}/catalog/${id}`, {
                method: "PUT", headers,
                body: JSON.stringify(data),
            });
            const res = await r.json();
            if (!r.ok) throw new Error(res?.error || "Failed to update");
            setEditingId(null);
            setSaveState("ok");
            setTimeout(() => setSaveState("idle"), 2000);
            loadEntries();
        } catch (e: any) {
            setErrMsg(e.message); setSaveState("error");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this product?")) return;
        try {
            const r = await fetch(`${BACKEND_API_BASE}/catalog/${id}`, {
                method: "DELETE", headers,
            });
            if (!r.ok) throw new Error("Failed to delete");
            loadEntries();
        } catch (e: any) {
            setErrMsg(e.message);
        }
    }

    const editingEntry = editingId ? entries.find(e => e.id === editingId) : null;

    return (
        <div style={S.wrap}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                    <h3 style={{ margin: 0 }}>Product Catalog</h3>
                    <p style={{ fontSize: 13, color: "var(--secondary-foreground)", marginTop: 4 }}>
                        Manage your product catalog. {entries.length} products listed.
                    </p>
                </div>
                <button style={S.btn("primary")} onClick={() => setShowNewForm(true)}>+ Add Product</button>
            </div>

            {saveState !== "idle" && (
                <div style={{ marginBottom: 12 }}>
                    <span style={S.status(saveState === "ok" || saveState === "saving")}>
                        {saveState === "saving" ? "Saving…" : saveState === "ok" ? "Saved!" : `Error: ${errMsg}`}
                    </span>
                </div>
            )}

            {showNewForm && (
                <ProductForm onSave={handleCreate} onCancel={() => setShowNewForm(false)} />
            )}

            {editingId && editingEntry && (
                <ProductForm
                    initial={editingEntry}
                    onSave={data => handleUpdate(editingId, data)}
                    onCancel={() => setEditingId(null)}
                />
            )}

            {loading ? (
                <p style={{ color: "var(--secondary-foreground)", fontSize: 14 }}>Loading catalog…</p>
            ) : entries.length === 0 ? (
                <p style={{ color: "var(--tertiary-foreground)", fontSize: 14 }}>
                    No products yet. Click "+ Add Product" to get started.
                </p>
            ) : (
                entries.map(entry => (
                    <div key={entry.id} style={{
                        ...S.card, display: "flex", justifyContent: "space-between", alignItems: "flex-start"
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{entry.product}</div>
                            <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 2 }}>
                                ${entry.fromPrice}{entry.toPrice && entry.toPrice > entry.fromPrice ? ` — $${entry.toPrice}` : ""} / {entry.currency}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--secondary-foreground)", marginTop: 2 }}>
                                {entry.variations?.length ?? 0} variations
                                {entry.sku ? ` • SKU: ${entry.sku}` : ""}
                            </div>
                            {entry.categories?.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                                    {entry.categories.map(c => (
                                        <span key={c} style={{
                                            fontSize: 10, padding: "2px 6px", borderRadius: 4,
                                            background: "var(--tertiary-background)", color: "var(--secondary-foreground)"
                                        }}>{c}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button style={S.btn("outline")} onClick={() => setEditingId(entry.id)}>Edit</button>
                            <button style={S.btn("danger")} onClick={() => handleDelete(entry.id)}>×</button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
});
