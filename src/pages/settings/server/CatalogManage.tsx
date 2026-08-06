import { Plus, Trash, X, Capsule } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { Server } from "revolt.js";
import styled from "styled-components/macro";

import { useEffect, useState } from "preact/hooks";

import { Button, InputBox, Preloader } from "@revoltchat/ui";

import { useClient } from "../../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../../directory/types";

// ─── Types (mirrors the Catalog API) ─────────────────────────────────────────

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
    data: { items: CatalogEntry[]; pagination: unknown };
}

interface ProductPayload {
    product: string;
    normalized: string;
    sku: string | null;
    currency: string;
    categories: string[];
    variations: Variation[];
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const HeadRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .meta {
        min-width: 0;

        h3 {
            margin: 0;
            font-size: 15px;
            color: var(--foreground);
        }

        p {
            margin: 4px 0 0;
            font-size: 13px;
            color: var(--secondary-foreground);
        }
    }
`;

const StatusText = styled.div<{ error?: boolean }>`
    font-size: 13px;
    color: ${(props) => (props.error ? "var(--error)" : "var(--success)")};
`;

// ─── Product list ─────────────────────────────────────────────────────────────

const EntryCard = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    border-radius: 10px;
    background: var(--secondary-background);

    .info {
        flex: 1;
        min-width: 0;
    }

    .name {
        font-size: 15px;
        font-weight: 600;
        color: var(--foreground);
    }

    .price {
        margin-top: 3px;
        font-size: 13px;
        font-weight: 600;
        color: var(--foreground);

        .currency {
            font-size: 11px;
            font-weight: 400;
            color: var(--tertiary-foreground);
        }
    }

    .sub {
        margin-top: 3px;
        font-size: 12px;
        color: var(--tertiary-foreground);
    }

    .actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
    }
`;

const Tags = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;

    span {
        font-size: 10px;
        font-weight: 600;
        line-height: 1;
        padding: 4px 7px;
        border-radius: 6px;
        background: var(--primary-background);
        color: var(--secondary-foreground);
    }
`;

// Small icon-only destructive button used on entry rows and variation rows.
const IconButton = styled.button<{ danger?: boolean }>`
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-background);
    color: var(--tertiary-foreground);
    cursor: pointer;
    transition: color 0.1s ease-in-out;

    &:hover {
        color: ${(props) =>
            props.danger ? "var(--error)" : "var(--foreground)"};
    }
`;

// ─── Form ─────────────────────────────────────────────────────────────────────

const FormCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 10px;
    background: var(--secondary-background);

    input,
    select {
        width: 100%;
    }
`;

const Field = styled.div<{ grow?: boolean; width?: number }>`
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    ${(props) => (props.grow ? "flex: 1;" : "")}
    ${(props) => (props.width ? `width: ${props.width}px;` : "")}

    label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--tertiary-foreground);
    }
`;

const FieldRow = styled.div`
    display: flex;
    gap: 10px;
    align-items: flex-end;
    flex-wrap: wrap;
`;

const Select = styled.select`
    height: 38px;
    padding: 0 32px 0 12px;
    border: none;
    border-radius: var(--border-radius);
    background-color: var(--primary-background);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23848484' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    color: var(--foreground);
    font-family: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
`;

// Variation editor rows live on the darker primary background so they read
// as a group inside the form card.
const VariationList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const VariationEditRow = styled.div`
    display: flex;
    gap: 6px;
    align-items: center;

    input {
        height: 34px;
        padding: 0 10px;
        border: none;
        border-radius: var(--border-radius);
        background: var(--primary-background);
        color: var(--foreground);
        font-family: inherit;
        font-size: 13px;
        box-sizing: border-box;
        min-width: 0;

        &::placeholder {
            color: var(--tertiary-foreground);
        }
    }

    .dosage {
        width: 90px;
        flex-shrink: 0;
    }

    .price {
        width: 90px;
        flex-shrink: 0;
    }

    .qty {
        flex: 1;
    }

    .unit {
        width: 70px;
        flex-shrink: 0;
    }

    @media (max-width: 600px) {
        flex-wrap: wrap;

        .qty {
            flex-basis: 100%;
            order: 1;
        }
    }
`;

const FormActions = styled.div`
    display: flex;
    gap: 8px;
    padding-top: 4px;
    border-top: 1px solid var(--primary-background);
`;

// ─── Empty / loading states ───────────────────────────────────────────────────

const Centered = styled.div`
    display: flex;
    justify-content: center;
    padding: 40px 0;
`;

const Empty = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 24px;
    gap: 6px;

    h4 {
        margin: 16px 0 0;
        font-size: 16px;
        color: var(--foreground);
    }

    p {
        margin: 0;
        max-width: 340px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--secondary-foreground);
    }

    .cta {
        margin-top: 16px;
    }
`;

const Glyph = styled.div`
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    color: var(--accent);
    background: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--accent) 22%, transparent),
        transparent 70%
    );
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number, currency = "USD") => {
    const formatted = n.toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });
    return currency === "USD" ? `$${formatted}` : `${formatted} ${currency}`;
};

const blankVariation = (): Variation => ({
    dosage: "",
    price: 0,
    display_quantity: "",
    unit: "kit",
    note: "",
});

// ─── Edit form for one product ────────────────────────────────────────────────

function ProductForm({
    initial,
    saving,
    onSave,
    onCancel,
}: {
    initial?: Partial<CatalogEntry>;
    saving: boolean;
    onSave: (data: ProductPayload) => void;
    onCancel: () => void;
}) {
    const [product, setProduct] = useState(initial?.product ?? "");
    const [sku, setSku] = useState(initial?.sku ?? "");
    const [currency, setCurrency] = useState(initial?.currency ?? "USD");
    const [categories, setCategories] = useState(
        (initial?.categories ?? []).join(", "),
    );
    const [variations, setVariations] = useState<Variation[]>(
        initial?.variations?.length
            ? initial.variations.map((v) => ({ ...v }))
            : [blankVariation()],
    );

    const updateVar = (idx: number, patch: Partial<Variation>) =>
        setVariations(
            variations.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
        );
    const removeVar = (idx: number) =>
        setVariations(variations.filter((_, i) => i !== idx));
    const addVar = () => setVariations([...variations, blankVariation()]);

    const cleanVariations = variations
        .filter((v) => v.price > 0 || v.dosage)
        .map((v) => ({
            price: v.price,
            dosage: v.dosage?.trim() || null,
            display_quantity: v.display_quantity?.trim() || null,
            unit: v.unit?.trim() || null,
            note: v.note?.trim() || null,
        }));
    const valid = product.trim().length > 0 && cleanVariations.length > 0;

    const handleSave = () => {
        if (!valid) return;
        onSave({
            product: product.trim(),
            normalized: product.trim().toLowerCase(),
            sku: sku.trim() || null,
            currency,
            categories: categories
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean),
            variations: cleanVariations,
        });
    };

    return (
        <FormCard>
            <Field grow>
                <label>Product name</label>
                <InputBox
                    palette="primary"
                    value={product}
                    placeholder="e.g. Tirzepatide 40mg"
                    onChange={(e) => setProduct(e.currentTarget.value)}
                />
            </Field>

            <FieldRow>
                <Field grow>
                    <label>SKU (optional)</label>
                    <InputBox
                        palette="primary"
                        value={sku}
                        placeholder="e.g. TIRZ-40"
                        onChange={(e) => setSku(e.currentTarget.value)}
                    />
                </Field>
                <Field width={110}>
                    <label>Currency</label>
                    <Select
                        value={currency}
                        onChange={(e) => setCurrency(e.currentTarget.value)}>
                        <option value="USD">USD</option>
                        <option value="CNY">CNY</option>
                    </Select>
                </Field>
            </FieldRow>

            <Field grow>
                <label>Categories (comma-separated)</label>
                <InputBox
                    palette="primary"
                    value={categories}
                    placeholder="e.g. Peptides, GLP-1"
                    onChange={(e) => setCategories(e.currentTarget.value)}
                />
            </Field>

            <Field grow>
                <label>Variations</label>
                <VariationList>
                    {variations.map((v, i) => (
                        <VariationEditRow key={i}>
                            <input
                                className="dosage"
                                placeholder="Dosage"
                                value={v.dosage ?? ""}
                                onInput={(e) =>
                                    updateVar(i, {
                                        dosage: (e.target as HTMLInputElement)
                                            .value,
                                    })
                                }
                            />
                            <input
                                className="price"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Price"
                                value={v.price || ""}
                                onInput={(e) =>
                                    updateVar(i, {
                                        price:
                                            parseFloat(
                                                (e.target as HTMLInputElement)
                                                    .value,
                                            ) || 0,
                                    })
                                }
                            />
                            <input
                                className="qty"
                                placeholder="Quantity, e.g. 1 kit (10 vials)"
                                value={v.display_quantity ?? ""}
                                onInput={(e) =>
                                    updateVar(i, {
                                        display_quantity: (
                                            e.target as HTMLInputElement
                                        ).value,
                                    })
                                }
                            />
                            <input
                                className="unit"
                                placeholder="Unit"
                                value={v.unit ?? ""}
                                onInput={(e) =>
                                    updateVar(i, {
                                        unit: (e.target as HTMLInputElement)
                                            .value,
                                    })
                                }
                            />
                            <IconButton
                                danger
                                title="Remove variation"
                                disabled={variations.length <= 1}
                                onClick={() => removeVar(i)}>
                                <X size={16} />
                            </IconButton>
                        </VariationEditRow>
                    ))}
                </VariationList>
                <div>
                    <Button compact palette="secondary" onClick={addVar}>
                        <Plus size={16} />
                        Add variation
                    </Button>
                </div>
            </Field>

            <FormActions>
                <Button
                    compact
                    palette="accent"
                    disabled={!valid || saving}
                    onClick={handleSave}>
                    {saving ? "Saving…" : "Save product"}
                </Button>
                <Button compact palette="secondary" onClick={onCancel}>
                    Cancel
                </Button>
            </FormActions>
        </FormCard>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    server: Server;
}

export const CatalogManage = observer(({ server }: Props) => {
    const client = useClient();
    const [entries, setEntries] = useState<CatalogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [saveState, setSaveState] = useState<
        "idle" | "saving" | "ok" | "error"
    >("idle");
    const [errMsg, setErrMsg] = useState("");

    const sessionToken =
        typeof client.session === "string"
            ? client.session
            : (client.session as any)?.token ?? "";
    const headers = {
        "x-session-token": sessionToken,
        "Content-Type": "application/json",
    };
    const sid = server._id;

    function loadEntries() {
        setLoading(true);
        fetch(`${BACKEND_API_BASE}/catalog?serverId=${sid}&pageSize=200`, {
            headers,
        })
            .then((r) => r.json())
            .then((res: EntryListResponse) => {
                if (res?.success) setEntries(res.data.items);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }

    useEffect(() => {
        loadEntries();
    }, [sid]);

    async function submit(id: string | null, data: ProductPayload) {
        setSaveState("saving");
        try {
            const r = await fetch(
                id
                    ? `${BACKEND_API_BASE}/catalog/${id}`
                    : `${BACKEND_API_BASE}/catalog`,
                {
                    method: id ? "PUT" : "POST",
                    headers,
                    body: JSON.stringify(
                        id ? data : { ...data, serverId: sid },
                    ),
                },
            );
            const res = await r.json();
            if (!r.ok)
                throw new Error(
                    res?.error ||
                        (id ? "Failed to update" : "Failed to create"),
                );
            setShowNewForm(false);
            setEditingId(null);
            setSaveState("ok");
            setTimeout(() => setSaveState("idle"), 2000);
            loadEntries();
        } catch (e: any) {
            setErrMsg(e.message);
            setSaveState("error");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this product? This cannot be undone.")) return;
        try {
            const r = await fetch(`${BACKEND_API_BASE}/catalog/${id}`, {
                method: "DELETE",
                headers,
            });
            if (!r.ok) throw new Error("Failed to delete");
            loadEntries();
        } catch (e: any) {
            setErrMsg(e.message);
            setSaveState("error");
        }
    }

    const editingEntry = editingId
        ? entries.find((e) => e.id === editingId)
        : null;

    return (
        <Wrapper>
            <HeadRow>
                <div className="meta">
                    <h3>Product Catalog</h3>
                    <p>
                        Products listed here appear in the Compound Finder for
                        every user.
                        {entries.length > 0 && ` ${entries.length} listed.`}
                    </p>
                </div>
                {!showNewForm && (
                    <Button
                        compact
                        palette="accent"
                        onClick={() => {
                            setEditingId(null);
                            setShowNewForm(true);
                        }}>
                        <Plus size={16} />
                        Add product
                    </Button>
                )}
            </HeadRow>

            {saveState !== "idle" && (
                <StatusText error={saveState === "error"}>
                    {saveState === "saving"
                        ? "Saving…"
                        : saveState === "ok"
                        ? "Saved."
                        : `Error: ${errMsg}`}
                </StatusText>
            )}

            {showNewForm && (
                <ProductForm
                    saving={saveState === "saving"}
                    onSave={(data) => submit(null, data)}
                    onCancel={() => setShowNewForm(false)}
                />
            )}

            {loading ? (
                <Centered>
                    <Preloader type="ring" />
                </Centered>
            ) : entries.length === 0 && !showNewForm ? (
                <Empty>
                    <Glyph>
                        <Capsule size={32} />
                    </Glyph>
                    <h4>No products listed yet</h4>
                    <p>
                        Add your first product and it will show up in the
                        Compound Finder, where every user can browse and compare
                        prices.
                    </p>
                    <div className="cta">
                        <Button
                            palette="accent"
                            onClick={() => setShowNewForm(true)}>
                            <Plus size={16} />
                            Add your first product
                        </Button>
                    </div>
                </Empty>
            ) : (
                entries.map((entry) =>
                    editingId === entry.id && editingEntry ? (
                        <ProductForm
                            key={entry.id}
                            initial={editingEntry}
                            saving={saveState === "saving"}
                            onSave={(data) => submit(entry.id, data)}
                            onCancel={() => setEditingId(null)}
                        />
                    ) : (
                        <EntryCard key={entry.id}>
                            <div className="info">
                                <div className="name">{entry.product}</div>
                                <div className="price">
                                    {money(entry.fromPrice, entry.currency)}
                                    {entry.toPrice != null &&
                                        entry.toPrice > entry.fromPrice &&
                                        ` – ${money(
                                            entry.toPrice,
                                            entry.currency,
                                        )}`}{" "}
                                    <span className="currency">
                                        {entry.currency}
                                    </span>
                                </div>
                                <div className="sub">
                                    {entry.variations?.length ?? 0}{" "}
                                    {entry.variations?.length === 1
                                        ? "variation"
                                        : "variations"}
                                    {entry.sku && ` · SKU ${entry.sku}`}
                                </div>
                                {entry.categories?.length > 0 && (
                                    <Tags>
                                        {entry.categories.map((c) => (
                                            <span key={c}>{c}</span>
                                        ))}
                                    </Tags>
                                )}
                            </div>
                            <div className="actions">
                                <Button
                                    compact
                                    palette="secondary"
                                    onClick={() => {
                                        setShowNewForm(false);
                                        setEditingId(entry.id);
                                    }}>
                                    Edit
                                </Button>
                                <IconButton
                                    danger
                                    title="Delete product"
                                    onClick={() => handleDelete(entry.id)}>
                                    <Trash size={16} />
                                </IconButton>
                            </div>
                        </EntryCard>
                    ),
                )
            )}
        </Wrapper>
    );
});
