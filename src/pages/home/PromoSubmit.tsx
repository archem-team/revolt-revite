import { ArrowBack, Plus, Trash, X } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { Server } from "revolt.js";
import styled from "styled-components/macro";

import { useState } from "preact/hooks";

import { Button, Checkbox, InputBox } from "@revoltchat/ui";

// FILE-UPLOAD (commented out) — uncomment to re-enable direct file upload to CDN:
// import { uploadFile } from "../../controllers/client/jsx/legacy/FileUploads";

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

const ImageHint = styled.p`
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--secondary-foreground);

    strong {
        color: var(--foreground);
    }
`;

const ImageUrlRow = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;

    /* stretch the input, keep button fixed */
    & > *:first-child {
        flex: 1;
    }
`;

const Thumbs = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;

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

    // FILE-UPLOAD (commented out) — autumn CDN base URL, needed by uploadFile:
    // const autumn =
    //     client.configuration?.features.autumn?.url ||
    //     "https://peptide.chat/autumn";

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
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [submitterContact, setSubmitterContact] = useState("");
    const [submitterNote, setSubmitterNote] = useState("");

    // FILE-UPLOAD (commented out) — tracks in-progress CDN upload:
    // const [uploading, setUploading] = useState(false);

    const [state, setState] = useState<"idle" | "saving" | "ok" | "error">(
        "idle",
    );
    const [errMsg, setErrMsg] = useState("");

    const sessionToken =
        typeof client.session === "string"
            ? client.session
            : (client.session as any)?.token ?? "";

    const setItem = (i: number, patch: Partial<ItemForm>) =>
        setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
        );

    function addImageUrl() {
        const url = imageUrlInput.trim();
        if (!url) return;
        if (images.length >= MAX_IMAGES) {
            setErrMsg(`Maximum ${MAX_IMAGES} images allowed.`);
            setState("error");
            return;
        }
        if (!/^https?:\/\//i.test(url)) {
            setErrMsg("Please enter a valid image URL starting with http:// or https://");
            setState("error");
            return;
        }
        setImages((prev) => [...prev, url]);
        setImageUrlInput("");
        // Clear any previous URL error when a valid one is added
        if (state === "error") setState("idle");
    }

    // FILE-UPLOAD (commented out) — picks a local file and uploads it to Autumn CDN.
    // To re-enable: uncomment this function, the `uploading` state above, the
    // `autumn` variable above, and the upload button in the Images section below.
    // async function handleImagePick() {
    //     const input = document.createElement("input");
    //     input.type = "file";
    //     input.accept = "image/*";
    //     input.multiple = true;
    //     input.onchange = async () => {
    //         const files = Array.from(input.files ?? []);
    //         if (!files.length) return;
    //         const room = MAX_IMAGES - images.length;
    //         setUploading(true);
    //         try {
    //             const ids: string[] = [];
    //             for (const file of files.slice(0, room)) {
    //                 const id = await uploadFile(autumn, "attachments", file);
    //                 ids.push(id);
    //             }
    //             setImages((prev) => [...prev, ...ids]);
    //         } catch {
    //             setErrMsg("Image upload failed.");
    //             setState("error");
    //         } finally {
    //             setUploading(false);
    //         }
    //     };
    //     input.click();
    // }

    const num = (s: string) => {
        const n = parseFloat(s);
        return isNaN(n) ? undefined : n;
    };

    async function handleSubmit(e: Event) {
        e.preventDefault();
        if (!serverId) {
            setErrMsg("Select a server.");
            setState("error");
            return;
        }
        if (!sessionToken) {
            setErrMsg("No active session.");
            setState("error");
            return;
        }

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
                <Select
                    value={serverId}
                    onChange={(e) => setServerId(e.currentTarget.value)}>
                    {servers.map((s) => (
                        <option key={s._id} value={s._id}>
                            {s.name}
                        </option>
                    ))}
                </Select>
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
                <ImageHint>
                    <>
                    Paste image links below (e.g. right-click an image in a PepChat message → <em>Copy image address</em>). Up to {MAX_IMAGES} images.
                    </>
                </ImageHint>
                <ImageUrlRow>
                    <InputBox
                        palette="secondary"
                        value={imageUrlInput}
                        placeholder="Paste image link from a PepChat message…"
                        disabled={images.length >= MAX_IMAGES}
                        onChange={(e) =>
                            setImageUrlInput(e.currentTarget.value)
                        }
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addImageUrl();
                            }
                        }}
                    />
                    <Button
                        type="button"
                        compact
                        palette="secondary"
                        disabled={
                            !imageUrlInput.trim() ||
                            images.length >= MAX_IMAGES
                        }
                        onClick={addImageUrl}>
                        <>
                            <Plus size={16} />
                            Add
                        </>
                    </Button>
                </ImageUrlRow>
                {images.length > 0 && (
                    <Thumbs>
                        {images.map((url, i) => (
                            <div className="thumb" key={i}>
                                <img src={url} />
                                <div
                                    className="x"
                                    onClick={() =>
                                        setImages((prev) =>
                                            prev.filter(
                                                (_, idx) => idx !== i,
                                            ),
                                        )
                                    }>
                                    <X size={12} />
                                </div>
                            </div>
                        ))}
                        {/* FILE-UPLOAD (commented out) — dashed "+" button to pick & upload a local file.
                            To re-enable: uncomment the button below and the handleImagePick function above.
                        <button
                            type="button"
                            className="add"
                            disabled={uploading || images.length >= MAX_IMAGES}
                            onClick={handleImagePick}>
                            <Plus size={20} />
                        </button>
                        */}
                    </Thumbs>
                )}
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
                {/* FILE-UPLOAD (commented out): to also block submit during upload,
                    change the line below to: disabled={state === "saving" || uploading} */}
                <Button
                    type="submit"
                    palette="accent"
                    disabled={state === "saving"}>
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
