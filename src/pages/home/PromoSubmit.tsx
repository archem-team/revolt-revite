import { ArrowBack, Plus, Trash, X } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { Server } from "revolt.js";
import styled from "styled-components/macro";

import { useState } from "preact/hooks";

import { Button, Checkbox, InputBox } from "@revoltchat/ui";

import { uploadFile } from "../../controllers/client/jsx/legacy/FileUploads";
import { useClient } from "../../controllers/client/ClientController";
import { API_BASE } from "../directory/types";

interface ItemForm {
    product: string;
    dosage: string;
    price: string;
    unit: string;
    moqKits: string;
    moqTotal: string;
    note: string;
}

const emptyItem = (): ItemForm => ({
    product: "",
    dosage: "",
    price: "",
    unit: "kit",
    moqKits: "",
    moqTotal: "",
    note: "",
});

const MAX_IMAGES = 12;

// Per-field validation errors. Items are keyed by their index in the form.
interface ItemError {
    product?: string;
    price?: string;
}

interface FieldErrors {
    items?: Record<number, ItemError>;
    purityPct?: string;
    volumePct?: string;
    shippingFee?: string;
    freeShippingThreshold?: string;
    endDate?: string;
}

// ─── Styling ──────────────────────────────────────────────────────────────────

const Head = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;

    h3 {
        margin: 0;
        font-size: 18px;
    }

    .back {
        display: flex;
        cursor: pointer;
        color: var(--secondary-foreground);
        &:hover {
            color: var(--foreground);
        }
    }
`;

const Intro = styled.p`
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--secondary-foreground);
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const Label = styled.div`
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--secondary-foreground);
`;

const Divider = styled.div`
    border-top: 1px solid var(--secondary-background);
`;

const Select = styled.select`
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: none;
    border-radius: var(--border-radius);
    background: var(--secondary-background);
    color: var(--foreground);
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
`;

// Read-only equivalent of Select, used when the submitter owns a single
// community — the vendor is fixed, so there is nothing to choose.
const StaticField = styled.div`
    width: 100%;
    height: 40px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    border-radius: var(--border-radius);
    background: var(--secondary-background);
    color: var(--foreground);
    font-size: 0.875rem;
`;

const Grid = styled.div<{ cols?: number }>`
    display: grid;
    grid-template-columns: repeat(${(p) => p.cols ?? 2}, 1fr);
    gap: 8px;

    @media (max-width: 480px) {
        grid-template-columns: 1fr;
    }
`;

const ItemCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 8px;
    background: var(--secondary-background);

    .item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 600;
        color: var(--secondary-foreground);
    }

    .remove {
        display: flex;
        cursor: pointer;
        color: var(--tertiary-foreground);
        &:hover {
            color: var(--error);
        }
    }
`;

const Thumbs = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .thumb {
        position: relative;
        width: 72px;
        height: 72px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--secondary-background);

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .x {
            position: absolute;
            top: 2px;
            right: 2px;
            display: grid;
            place-items: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.6);
            color: #fff;
            cursor: pointer;
        }
    }

    .add {
        width: 72px;
        height: 72px;
        border-radius: 8px;
        border: 1px dashed var(--tertiary-foreground);
        background: transparent;
        color: var(--tertiary-foreground);
        cursor: pointer;
        display: grid;
        place-items: center;

        &:hover {
            color: var(--foreground);
            border-color: var(--foreground);
        }

        &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
    }
`;

const Actions = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
`;

const Status = styled.span<{ ok?: boolean }>`
    font-size: 13px;
    color: ${(p) => (p.ok ? "var(--success)" : "var(--error)")};
`;

const FieldError = styled.span`
    font-size: 12px;
    line-height: 1.4;
    color: var(--error);
`;

const Success = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 32px 0;
    color: var(--secondary-foreground);

    h3 {
        margin: 0;
        color: var(--foreground);
    }
`;

// ─── Component ──────────────────────────────────────────────────────────────────

interface Props {
    servers: Server[];
    onClose: () => void;
}

const PromoSubmit = observer(({ servers, onClose }: Props) => {
    const client = useClient();
    const autumn =
        client.configuration?.features.autumn?.url ||
        "https://peptide.chat/autumn";

    const [serverId, setServerId] = useState(servers[0]?._id ?? "");
    const [title, setTitle] = useState("");
    const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
    const [warehouse, setWarehouse] = useState("");
    const [shippingFee, setShippingFee] = useState("");
    const [freeShippingThreshold, setFreeShippingThreshold] = useState("");
    const [shippingNote, setShippingNote] = useState("");
    const [purityPct, setPurityPct] = useState("");
    const [volumePct, setVolumePct] = useState("");
    const [customsReship, setCustomsReship] = useState(false);
    const [guaranteeText, setGuaranteeText] = useState("");
    const [discountNote, setDiscountNote] = useState("");
    const [moqNote, setMoqNote] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [untilSoldOut, setUntilSoldOut] = useState(false);
    const [timelineText, setTimelineText] = useState("");
    const [images, setImages] = useState<string[]>([]);
    const [submitterContact, setSubmitterContact] = useState("");
    const [submitterNote, setSubmitterNote] = useState("");

    const [uploading, setUploading] = useState(false);
    const [state, setState] = useState<"idle" | "saving" | "ok" | "error">(
        "idle",
    );
    const [errMsg, setErrMsg] = useState("");
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const sessionToken =
        typeof client.session === "string"
            ? client.session
            : (client.session as any)?.token ?? "";

    const setItem = (i: number, patch: Partial<ItemForm>) => {
        setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
        );
        // Clear this item's validation errors as the user edits it.
        setFieldErrors((prev) => {
            if (!prev.items?.[i]) return prev;
            const items = { ...prev.items };
            delete items[i];
            return { ...prev, items };
        });
    };

    async function handleImagePick() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.onchange = async () => {
            const files = Array.from(input.files ?? []);
            if (!files.length) return;
            const room = MAX_IMAGES - images.length;
            setUploading(true);
            try {
                const ids: string[] = [];
                for (const file of files.slice(0, room)) {
                    const id = await uploadFile(autumn, "attachments", file);
                    ids.push(id);
                }
                setImages((prev) => [...prev, ...ids]);
            } catch {
                setErrMsg("Image upload failed.");
                setState("error");
            } finally {
                setUploading(false);
            }
        };
        input.click();
    }

    const num = (s: string) => {
        const n = parseFloat(s);
        return isNaN(n) ? undefined : n;
    };

    async function handleSubmit(e: Event) {
        e.preventDefault();
        if (!serverId) {
            setErrMsg("Select a community.");
            setState("error");
            return;
        }
        if (!sessionToken) {
            setErrMsg("No active session.");
            setState("error");
            return;
        }

        // ─── Validate ───────────────────────────────────────────────────────
        const errors: FieldErrors = {};
        const itemErrors: Record<number, ItemError> = {};

        let namedProducts = 0;
        items.forEach((it, i) => {
            const product = it.product.trim();
            const e: ItemError = {};
            if (product) {
                namedProducts++;
                const price = num(it.price);
                if (!it.price.trim() || price == null) {
                    e.price = "Enter a price.";
                } else if (price < 0) {
                    e.price = "Price can't be negative.";
                }
            } else if (
                // A row with details but no name would be silently dropped —
                // flag it so the submitter doesn't lose data unknowingly.
                it.dosage.trim() ||
                it.price.trim() ||
                it.moqKits.trim() ||
                it.moqTotal.trim() ||
                it.note.trim()
            ) {
                e.product = "Add a product name for this item.";
            }
            if (e.product || e.price) itemErrors[i] = e;
        });

        if (namedProducts === 0) {
            itemErrors[0] = {
                ...itemErrors[0],
                product: "Add at least one product.",
            };
        }

        // Percentages must be 0–100.
        const pct = (s: string, key: "purityPct" | "volumePct") => {
            if (!s.trim()) return;
            const n = num(s);
            if (n == null || n < 0 || n > 100)
                errors[key] = "Enter a value between 0 and 100.";
        };
        pct(purityPct, "purityPct");
        pct(volumePct, "volumePct");

        // Money fields can't be negative.
        const nonNeg = (
            s: string,
            key: "shippingFee" | "freeShippingThreshold",
        ) => {
            if (!s.trim()) return;
            const n = num(s);
            if (n == null || n < 0) errors[key] = "Enter 0 or more.";
        };
        nonNeg(shippingFee, "shippingFee");
        nonNeg(freeShippingThreshold, "freeShippingThreshold");

        if (startDate && endDate && endDate < startDate)
            errors.endDate = "End date can't be before the start date.";

        if (Object.keys(itemErrors).length) errors.items = itemErrors;

        if (Object.keys(errors).length) {
            setFieldErrors(errors);
            setErrMsg("Please fix the highlighted fields.");
            setState("error");
            return;
        }
        setFieldErrors({});

        const cleanItems = items
            .filter((it) => it.product.trim())
            .map((it) => ({
                product: it.product.trim(),
                dosage: it.dosage.trim() || undefined,
                price: num(it.price) ?? 0,
                unit: it.unit.trim() || "kit",
                moqKits: num(it.moqKits),
                moqTotal: num(it.moqTotal),
                note: it.note.trim() || undefined,
            }));

        const guarantee =
            num(purityPct) != null ||
            num(volumePct) != null ||
            customsReship ||
            guaranteeText.trim()
                ? {
                      purityPct: num(purityPct),
                      volumePct: num(volumePct),
                      customsReship: customsReship || undefined,
                      text: guaranteeText.trim() || undefined,
                  }
                : undefined;

        const body: Record<string, unknown> = {
            serverId,
            title: title.trim() || undefined,
            items: cleanItems.length ? cleanItems : undefined,
            images: images.length ? images : undefined,
            shippingFee: num(shippingFee),
            freeShippingThreshold: num(freeShippingThreshold),
            shippingNote: shippingNote.trim() || undefined,
            guarantee,
            discountNote: discountNote.trim() || undefined,
            warehouse: warehouse.trim() || undefined,
            moqNote: moqNote.trim() || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            untilSoldOut: untilSoldOut || undefined,
            timelineText: timelineText.trim() || undefined,
            submitterContact: submitterContact.trim() || undefined,
            submitterNote: submitterNote.trim() || undefined,
        };

        setState("saving");
        try {
            const r = await fetch(`${API_BASE}/promos/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Revolt-Token": sessionToken,
                },
                body: JSON.stringify(body),
            });
            const res = await r.json();
            if (!r.ok || !res?.success) {
                throw new Error(res?.error?.message || `HTTP ${r.status}`);
            }
            setState("ok");
        } catch (err: any) {
            setErrMsg(err.message || "Submission failed.");
            setState("error");
        }
    }

    if (state === "ok") {
        return (
            <Success>
                <h3>Promo submitted</h3>
                <span>
                    Your promo is pending review by an admin and will appear
                    here once approved.
                </span>
                <Button palette="accent" onClick={onClose}>
                    Back to promos
                </Button>
            </Success>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <Head>
                <div className="back" onClick={onClose}>
                    <ArrowBack size={22} />
                </div>
                <h3>Submit a promo</h3>
            </Head>
            <Intro>
                Promos are reviewed by an admin before going live. Vendor
                identity and the join link come from the community you select.
            </Intro>

            <Section>
                <Label>Community</Label>
                {servers.length > 1 ? (
                    <Select
                        value={serverId}
                        onChange={(e) => setServerId(e.currentTarget.value)}>
                        {servers.map((s) => (
                            <option key={s._id} value={s._id}>
                                {s.name}
                            </option>
                        ))}
                    </Select>
                ) : (
                    <StaticField>{servers[0]?.name}</StaticField>
                )}
            </Section>

            <Section>
                <Label>Title</Label>
                <InputBox
                    palette="secondary"
                    value={title}
                    maxLength={120}
                    placeholder="e.g. US Warehouse Promo"
                    onChange={(e) => setTitle(e.currentTarget.value)}
                />
            </Section>

            <Divider />

            <Section>
                <Label>Products</Label>
                {items.map((it, i) => (
                    <ItemCard key={i}>
                        <div className="item-head">
                            <span>Item {i + 1}</span>
                            {items.length > 1 && (
                                <div
                                    className="remove"
                                    onClick={() =>
                                        setItems((prev) =>
                                            prev.filter((_, idx) => idx !== i),
                                        )
                                    }>
                                    <Trash size={16} />
                                </div>
                            )}
                        </div>
                        <Grid cols={2}>
                            <InputBox
                                palette="primary"
                                value={it.product}
                                placeholder="Product"
                                onChange={(e) =>
                                    setItem(i, {
                                        product: e.currentTarget.value,
                                    })
                                }
                            />
                            <InputBox
                                palette="primary"
                                value={it.dosage}
                                placeholder="Dosage e.g. 10mg"
                                onChange={(e) =>
                                    setItem(i, {
                                        dosage: e.currentTarget.value,
                                    })
                                }
                            />
                            <InputBox
                                palette="primary"
                                type="number"
                                value={it.price}
                                placeholder="Price (USD)"
                                onChange={(e) =>
                                    setItem(i, { price: e.currentTarget.value })
                                }
                            />
                            <InputBox
                                palette="primary"
                                value={it.unit}
                                placeholder="Unit e.g. kit"
                                onChange={(e) =>
                                    setItem(i, { unit: e.currentTarget.value })
                                }
                            />
                            <InputBox
                                palette="primary"
                                type="number"
                                value={it.moqKits}
                                placeholder="MOQ (kits)"
                                onChange={(e) =>
                                    setItem(i, {
                                        moqKits: e.currentTarget.value,
                                    })
                                }
                            />
                            <InputBox
                                palette="primary"
                                type="number"
                                value={it.moqTotal}
                                placeholder="MOQ ($ total)"
                                onChange={(e) =>
                                    setItem(i, {
                                        moqTotal: e.currentTarget.value,
                                    })
                                }
                            />
                        </Grid>
                        {fieldErrors.items?.[i]?.product && (
                            <FieldError>
                                {fieldErrors.items?.[i]?.product}
                            </FieldError>
                        )}
                        {fieldErrors.items?.[i]?.price && (
                            <FieldError>
                                {fieldErrors.items?.[i]?.price}
                            </FieldError>
                        )}
                        <InputBox
                            palette="primary"
                            value={it.note}
                            placeholder="Note (optional)"
                            onChange={(e) =>
                                setItem(i, { note: e.currentTarget.value })
                            }
                        />
                    </ItemCard>
                ))}
                <Button
                    type="button"
                    compact
                    palette="plain-secondary"
                    onClick={() => setItems((prev) => [...prev, emptyItem()])}>
                    <Plus size={16} />
                    Add product
                </Button>
            </Section>

            <Divider />

            <Section>
                <Label>Shipping</Label>
                <Grid cols={2}>
                    <InputBox
                        palette="secondary"
                        type="number"
                        value={shippingFee}
                        placeholder="Shipping fee (USD)"
                        onChange={(e) =>
                            setShippingFee(e.currentTarget.value)
                        }
                    />
                    <InputBox
                        palette="secondary"
                        type="number"
                        value={freeShippingThreshold}
                        placeholder="Free shipping over (USD)"
                        onChange={(e) =>
                            setFreeShippingThreshold(e.currentTarget.value)
                        }
                    />
                </Grid>
                {fieldErrors.shippingFee && (
                    <FieldError>Shipping fee: {fieldErrors.shippingFee}</FieldError>
                )}
                {fieldErrors.freeShippingThreshold && (
                    <FieldError>
                        Free shipping threshold:{" "}
                        {fieldErrors.freeShippingThreshold}
                    </FieldError>
                )}
                <InputBox
                    palette="secondary"
                    value={shippingNote}
                    maxLength={300}
                    placeholder="Shipping note (optional)"
                    onChange={(e) => setShippingNote(e.currentTarget.value)}
                />
                <InputBox
                    palette="secondary"
                    value={warehouse}
                    maxLength={60}
                    placeholder="Warehouse e.g. US, EU"
                    onChange={(e) => setWarehouse(e.currentTarget.value)}
                />
            </Section>

            <Divider />

            <Section>
                <Label>Guarantee</Label>
                <Grid cols={2}>
                    <InputBox
                        palette="secondary"
                        type="number"
                        value={purityPct}
                        placeholder="Purity %"
                        onChange={(e) => setPurityPct(e.currentTarget.value)}
                    />
                    <InputBox
                        palette="secondary"
                        type="number"
                        value={volumePct}
                        placeholder="Volume %"
                        onChange={(e) => setVolumePct(e.currentTarget.value)}
                    />
                </Grid>
                {fieldErrors.purityPct && (
                    <FieldError>Purity %: {fieldErrors.purityPct}</FieldError>
                )}
                {fieldErrors.volumePct && (
                    <FieldError>Volume %: {fieldErrors.volumePct}</FieldError>
                )}
                <Checkbox
                    value={customsReship}
                    onChange={setCustomsReship}
                    title="Customs reship guarantee"
                />
                <InputBox
                    palette="secondary"
                    value={guaranteeText}
                    placeholder="Guarantee note (optional)"
                    onChange={(e) => setGuaranteeText(e.currentTarget.value)}
                />
            </Section>

            <Divider />

            <Section>
                <Label>Offer details</Label>
                <InputBox
                    palette="secondary"
                    value={discountNote}
                    maxLength={300}
                    placeholder="Discount note e.g. 5% off over $1,000"
                    onChange={(e) => setDiscountNote(e.currentTarget.value)}
                />
                <InputBox
                    palette="secondary"
                    value={moqNote}
                    maxLength={120}
                    placeholder="MOQ note (optional)"
                    onChange={(e) => setMoqNote(e.currentTarget.value)}
                />
            </Section>

            <Divider />

            <Section>
                <Label>Timeline</Label>
                <Grid cols={2}>
                    <InputBox
                        palette="secondary"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.currentTarget.value)}
                    />
                    <InputBox
                        palette="secondary"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.currentTarget.value)}
                    />
                </Grid>
                {fieldErrors.endDate && (
                    <FieldError>{fieldErrors.endDate}</FieldError>
                )}
                <Checkbox
                    value={untilSoldOut}
                    onChange={setUntilSoldOut}
                    title="Until sold out (no fixed end date)"
                />
                <InputBox
                    palette="secondary"
                    value={timelineText}
                    maxLength={200}
                    placeholder="Timeline note (optional)"
                    onChange={(e) => setTimelineText(e.currentTarget.value)}
                />
            </Section>

            <Divider />

            <Section>
                <Label>
                    Images ({images.length}/{MAX_IMAGES})
                </Label>
                <Thumbs>
                    {images.map((id, i) => (
                        <div className="thumb" key={id}>
                            <img src={`${autumn}/attachments/${id}`} />
                            <div
                                className="x"
                                onClick={() =>
                                    setImages((prev) =>
                                        prev.filter((_, idx) => idx !== i),
                                    )
                                }>
                                <X size={12} />
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="add"
                        disabled={uploading || images.length >= MAX_IMAGES}
                        onClick={handleImagePick}>
                        <Plus size={20} />
                    </button>
                </Thumbs>
            </Section>

            <Divider />

            <Section>
                <Label>For the reviewer (not shown publicly)</Label>
                <InputBox
                    palette="secondary"
                    value={submitterContact}
                    maxLength={120}
                    placeholder="Your contact e.g. @telegram_handle"
                    onChange={(e) => setSubmitterContact(e.currentTarget.value)}
                />
                <InputBox
                    palette="secondary"
                    value={submitterNote}
                    maxLength={1000}
                    placeholder="Note to the admin (optional)"
                    onChange={(e) => setSubmitterNote(e.currentTarget.value)}
                />
            </Section>

            <Actions>
                <Button
                    type="submit"
                    palette="accent"
                    disabled={state === "saving" || uploading}>
                    {state === "saving" ? "Submitting…" : "Submit for review"}
                </Button>
                <Button type="button" palette="plain" onClick={onClose}>
                    Cancel
                </Button>
                {state === "error" && <Status>{errMsg}</Status>}
            </Actions>
        </form>
    );
});

export default PromoSubmit;
