import { useEffect, useState } from "preact/hooks";
import type { SubmitForm, Payment, Warehouses, Products, Guarantees, GuaranteeTexts, OrderTypes } from "./types";
import { PAYMENT_LABELS, WAREHOUSE_LABELS, PRODUCT_LABELS, GUARANTEE_LABELS, GUARANTEE_TEXT_DEFAULTS, ORDER_LABELS } from "./types";
import { defPay, defWh, defPr, defGu, defGuText, defOr, toggle } from "./dataUtils";
import {
    Overlay, ModalBox, DragHandle, ModalHead, ModalClose, ModalBody,
    FormGroup, CheckboxGrid, CheckLabel, TypeToggle, TypeBtn, PrimaryBtn, ErrorMsg,
} from "./stylesModal";

export function SubmitModal({
    onClose, onSubmit, initialType = "vendor",
}: {
    onClose: () => void;
    onSubmit: (f: SubmitForm) => void;
    initialType?: "vendor" | "reseller" | "other";
}) {
    const [form, setForm] = useState<SubmitForm>({
        type: initialType, name: "", inviteLink: "", serverId: "",
        payment: { ...defPay }, warehouses: { ...defWh },
        products: { ...defPr }, guarantees: { ...defGu }, guaranteeTexts: { ...defGuText }, orderTypes: { ...defOr },
        proofs: [], externalLinks: "", coas: "", shortDescription: "", notes: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");
    const [customWarehouse, setCustomWarehouse] = useState("");
    const [showCustomWarehouseInput, setShowCustomWarehouseInput] = useState(false);
    const [availableCustomWarehouses, setAvailableCustomWarehouses] = useState<string[]>([]);
    const [showProofInfo, setShowProofInfo] = useState(false);
    const [isMobileLayout, setIsMobileLayout] = useState(() =>
        typeof window !== "undefined"
            ? window.matchMedia("(max-width: 767px)").matches
            : false,
    );

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobileLayout(mediaQuery.matches);

        update();
        mediaQuery.addEventListener("change", update);

        return () => mediaQuery.removeEventListener("change", update);
    }, []);

    const isCommerce = form.type === "vendor" || form.type === "reseller";

    function addCustomWarehouse() {
        const val = customWarehouse.trim().toUpperCase();
        if (!val) return;

        setAvailableCustomWarehouses((prev) => prev.includes(val) ? prev : [...prev, val]);

        const current: string[] = form.warehouses.custom ?? [];
        if (!current.includes(val)) {
            setForm((f) => ({ ...f, warehouses: { ...f.warehouses, custom: [...current, val] } }));
        }

        setCustomWarehouse("");
        setShowCustomWarehouseInput(false);
    }

    function handleSubmit(e: Event) {
        e.preventDefault();
        if (!form.name.trim()) { setError("Name is required."); return; }
        if (!form.inviteLink.trim()) { setError("PepChat invite link is required."); return; }

        if (isCommerce) {
            if (form.proofs.length === 0) {
                setError("Proof upload is required.");
                return;
            }
            if (!form.shortDescription.trim()) {
                setError("Server description is required.");
                return;
            }
            const words = form.shortDescription.trim().split(/\s+/).length;
            if (words > 10) {
                setError(`Server description must be 10 words or less (currently ${words}).`);
                return;
            }
        }

        onSubmit(form);
        setSubmitted(true);
    }

    return (
        <Overlay onClick={onClose}>
            <ModalBox $wide onClick={(e) => e.stopPropagation()}>
                <DragHandle />
                <ModalHead>
                    <h2>Submit a Community</h2>
                    <ModalClose onClick={onClose}>✕</ModalClose>
                </ModalHead>
                <ModalBody>
                    {submitted ? (
                        <div style={{ textAlign: "center", padding: "36px 0" }}>
                            <div style={{ fontSize: 44, marginBottom: 14 }}>🎉</div>
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Submission Received!</div>
                            <div style={{ color: "var(--secondary-foreground)", fontSize: 13, lineHeight: 1.6 }}>
                                Your community will be reviewed and added shortly.
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <TypeToggle>
                                <TypeBtn type="button" $active={form.type === "vendor"}
                                    onClick={() => setForm((f) => ({ ...f, type: "vendor" }))}>Vendor</TypeBtn>
                                <TypeBtn type="button" $active={form.type === "reseller"}
                                    onClick={() => setForm((f) => ({ ...f, type: "reseller" }))}>Reseller</TypeBtn>
                                <TypeBtn type="button" $active={form.type === "other"}
                                    onClick={() => setForm((f) => ({ ...f, type: "other" }))}>Other</TypeBtn>
                            </TypeToggle>

                            <FormGroup>
                                <label>Community Name *</label>
                                <input type="text" value={form.name}
                                    onInput={(e) => setForm((f) => ({ ...f, name: (e.target as HTMLInputElement).value }))}
                                    placeholder="Your community's name" />
                            </FormGroup>
                            <FormGroup>
                                <label>PepChat Invite Link *</label>
                                <input type="url" value={form.inviteLink}
                                    onInput={(e) => setForm((f) => ({ ...f, inviteLink: (e.target as HTMLInputElement).value }))}
                                    placeholder="https://peptide.chat/invite/code" />
                            </FormGroup>
                            <FormGroup>
                                <label>Revolt Server ID (optional — enables live member stats)</label>
                                <input type="text" value={form.serverId}
                                    onInput={(e) => setForm((f) => ({ ...f, serverId: (e.target as HTMLInputElement).value }))}
                                    placeholder="01JABCDE..." />
                            </FormGroup>

                            {isCommerce && (
                                <>
                                    <FormGroup>
                                        <label>Payment Methods</label>
                                        <CheckboxGrid>
                                            {(Object.keys(PAYMENT_LABELS) as (keyof Payment)[]).map((k) => (
                                                <CheckLabel key={k} $checked={form.payment[k]}>
                                                    <input type="checkbox" checked={form.payment[k]}
                                                        onChange={() => setForm((f) => ({ ...f, payment: toggle(f.payment, k) }))} />
                                                    {PAYMENT_LABELS[k]}
                                                </CheckLabel>
                                            ))}
                                        </CheckboxGrid>
                                    </FormGroup>

                                    <FormGroup>
                                        <label>Warehouse Location(s)</label>
                                        <CheckboxGrid>
                                            {/* Preset chips */}
                                            {(Object.keys(WAREHOUSE_LABELS) as (keyof Warehouses)[]).map((k) => (
                                                <CheckLabel key={k} $checked={!!form.warehouses[k]}>
                                                    <input type="checkbox" checked={!!form.warehouses[k]}
                                                        onChange={() => setForm((f) => ({ ...f, warehouses: toggle(f.warehouses, k) }))} />
                                                    {WAREHOUSE_LABELS[k]}
                                                </CheckLabel>
                                            ))}
                                            {/* Added custom chips */}
                                            {availableCustomWarehouses.map((val) => {
                                                const isChecked = (form.warehouses.custom ?? []).includes(val);
                                                return (
                                                    <CheckLabel key={val} $checked={isChecked}>
                                                        <input type="checkbox" checked={isChecked}
                                                            onChange={() => setForm((f) => {
                                                                const current = f.warehouses.custom ?? [];
                                                                const next = current.includes(val)
                                                                    ? current.filter(v => v !== val)
                                                                    : [...current, val];
                                                                return { ...f, warehouses: { ...f.warehouses, custom: next } };
                                                            })} />
                                                        {val}
                                                    </CheckLabel>
                                                );
                                            })}
                                            {/* Inline "Add Custom" toggle */}
                                            {!showCustomWarehouseInput ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCustomWarehouseInput(true)}
                                                    style={{
                                                        display: "inline-flex", alignItems: "center", gap: 4,
                                                        padding: "4px 10px", borderRadius: 6,
                                                        border: "1px dashed var(--dir-accent)",
                                                        background: "transparent",
                                                        color: "var(--dir-accent)",
                                                        fontSize: 12, fontWeight: 600,
                                                        cursor: "pointer", transition: "all 0.12s",
                                                        letterSpacing: "0.02em", whiteSpace: "nowrap",
                                                        height: "28px", boxSizing: "border-box",
                                                    }}
                                                >+ Add Custom</button>
                                            ) : (
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                    <input
                                                        // eslint-disable-next-line jsx-a11y/no-autofocus
                                                        autoFocus
                                                        type="text"
                                                        value={customWarehouse}
                                                        onInput={(e) => setCustomWarehouse((e.target as HTMLInputElement).value.toUpperCase())}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") { e.preventDefault(); addCustomWarehouse(); }
                                                            if (e.key === "Escape") { setShowCustomWarehouseInput(false); setCustomWarehouse(""); }
                                                        }}
                                                        placeholder="e.g. BR"
                                                        maxLength={10}
                                                        style={{
                                                            width: 68, padding: "0 8px",
                                                            borderRadius: 6,
                                                            border: "1px solid var(--dir-accent)",
                                                            background: "var(--color-surface-alt)",
                                                            color: "var(--color-text-primary)",
                                                            fontSize: 12, fontFamily: "inherit",
                                                            outline: "none", boxSizing: "border-box",
                                                            height: "28px",
                                                            margin: 0,
                                                        }}
                                                    />
                                                    <button type="button" onClick={addCustomWarehouse}
                                                        style={{
                                                            padding: "0 8px", borderRadius: 6,
                                                            border: "none", background: "var(--dir-accent)",
                                                            color: "white", fontSize: 12, fontWeight: 700,
                                                            cursor: "pointer", height: "28px", boxSizing: "border-box",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                        }}>✓</button>
                                                    <button type="button"
                                                        onClick={() => { setShowCustomWarehouseInput(false); setCustomWarehouse(""); }}
                                                        style={{
                                                            padding: "0 8px", borderRadius: 6,
                                                            border: "1px solid var(--block)",
                                                            background: "transparent",
                                                            color: "var(--secondary-foreground)",
                                                            fontSize: 12, cursor: "pointer",
                                                            height: "28px", boxSizing: "border-box",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                        }}>✕</button>
                                                </div>
                                            )}
                                        </CheckboxGrid>
                                    </FormGroup>

                                    <FormGroup>
                                        <label>Products</label>
                                        <CheckboxGrid>
                                            {(Object.keys(PRODUCT_LABELS) as (keyof Products)[]).map((k) => (
                                                <CheckLabel key={k} $checked={form.products[k]}>
                                                    <input type="checkbox" checked={form.products[k]}
                                                        onChange={() => setForm((f) => ({ ...f, products: toggle(f.products, k) }))} />
                                                    {PRODUCT_LABELS[k]}
                                                </CheckLabel>
                                            ))}
                                        </CheckboxGrid>
                                    </FormGroup>
                                    <FormGroup>
                                        <label>Guarantee</label>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {(Object.keys(GUARANTEE_LABELS) as (keyof Guarantees)[]).map((k) => (
                                                <div key={k} style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: 8, alignItems: "center" }}>
                                                    <CheckLabel $checked={form.guarantees[k]}>
                                                        <input type="checkbox" checked={form.guarantees[k]}
                                                            onChange={() => setForm((f) => ({ ...f, guarantees: toggle(f.guarantees, k) }))} />
                                                        {GUARANTEE_LABELS[k]}
                                                    </CheckLabel>
                                                    <input
                                                        type="text"
                                                        value={form.guaranteeTexts[k]}
                                                        onInput={(e) => setForm((f) => ({
                                                            ...f,
                                                            guaranteeTexts: {
                                                                ...f.guaranteeTexts,
                                                                [k]: (e.target as HTMLInputElement).value,
                                                            } as GuaranteeTexts,
                                                        }))}
                                                        placeholder={GUARANTEE_TEXT_DEFAULTS[k]}
                                                        aria-label={`${GUARANTEE_LABELS[k]} guarantee chip text`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </FormGroup>

                                    <FormGroup>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            marginBottom: 6,
                                            position: "relative",
                                            width: "100%",
                                        }}>
                                            <label style={{ margin: 0 }}>PROOF UPLOAD (REQUIRED)</label>
                                            <div
                                                style={{
                                                    position: isMobileLayout ? "static" : "relative",
                                                    display: "inline-flex",
                                                }}
                                                onMouseEnter={() => setShowProofInfo(true)}
                                                onMouseLeave={() => setShowProofInfo(false)}
                                            >
                                                <button
                                                    type="button"
                                                    style={{
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        width: 18, height: 18, borderRadius: "50%",
                                                        background: "var(--dir-accent)",
                                                        color: "white",
                                                        border: "none",
                                                        fontSize: 11, fontWeight: "bold",
                                                        cursor: "pointer", transition: "all 0.12s",
                                                        filter: showProofInfo ? "brightness(1.15)" : "none",
                                                        padding: 0
                                                    }}
                                                    title=""
                                                >
                                                    i
                                                </button>
                                                {showProofInfo && (
                                                    <div style={{
                                                        position: "absolute",
                                                        top: "calc(100% + 8px)",
                                                        left: isMobileLayout ? "50%" : "0",
                                                        right: "auto",
                                                        transform: isMobileLayout ? "translateX(-50%)" : "none",
                                                        width: isMobileLayout
                                                            ? "min(280px, calc(100% - 12px))"
                                                            : "280px",
                                                        maxWidth: isMobileLayout
                                                            ? "calc(100% - 12px)"
                                                            : "280px",
                                                        zIndex: 100,
                                                        fontSize: 12,
                                                        color: "var(--color-text-primary)",
                                                        background: "var(--color-surface-alt)",
                                                        boxShadow: "var(--shadow-lg)",
                                                        border: "1px solid var(--dir-border-card)",
                                                        borderRadius: 6,
                                                        padding: "12px 14px",
                                                        pointerEvents: "none",
                                                        whiteSpace: "normal",
                                                        overflowWrap: "anywhere"
                                                    }}>
                                                        <div style={{ fontWeight: 600, marginBottom: 6 }}>
                                                            Please upload photos or videos showing:
                                                        </div>
                                                        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4, color: "var(--color-text-secondary)", fontWeight: 600 }}>
                                                            <li>A facility or large inventory</li>
                                                            <li>A handwritten sign: <strong>"Company name + PepChat + today's date"</strong></li>
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ position: "relative", display: "inline-block" }}>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*,video/*"
                                                onChange={(e) => {
                                                    const files = Array.from((e.target as HTMLInputElement).files || []);
                                                    setForm(f => ({ ...f, proofs: [...f.proofs, ...files] }));
                                                    // clear input to allow same file selection again if deleted
                                                    (e.target as HTMLInputElement).value = "";
                                                }}
                                                style={{
                                                    position: "absolute",
                                                    left: 0, top: 0, width: "100%", height: "100%",
                                                    opacity: 0, cursor: "pointer"
                                                }}
                                                title="Upload Images / Video"
                                            />
                                            <button type="button" style={{
                                                padding: "4px 10px", borderRadius: 6,
                                                border: "1px solid var(--block)",
                                                background: "var(--color-surface-alt)",
                                                color: "var(--color-text-primary)",
                                                fontSize: 13,
                                                cursor: "pointer",
                                                display: "flex", alignItems: "center", gap: 4
                                            }}>+ Upload Images / Video</button>
                                        </div>
                                        {form.proofs.length > 0 && (
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                                                {form.proofs.map((file, i) => (
                                                    <div key={i} style={{
                                                        fontSize: 12, padding: "4px 8px",
                                                        background: "var(--block)", borderRadius: 4,
                                                        display: "flex", alignItems: "center", gap: 6
                                                    }}>
                                                        <span>{file.name}</span>
                                                        <button type="button" onClick={() => {
                                                            setForm(f => ({
                                                                ...f,
                                                                proofs: f.proofs.filter((_, idx) => idx !== i)
                                                            }));
                                                        }} style={{
                                                            border: "none", background: "none",
                                                            color: "var(--secondary-foreground)", cursor: "pointer",
                                                            fontSize: 12, padding: 0,
                                                            display: "flex", alignItems: "center", justifyContent: "center"
                                                        }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </FormGroup>

                                    <FormGroup>
                                        <label>EXTERNAL LINKS</label>
                                        <input type="text" value={form.externalLinks}
                                            onInput={(e) => setForm((f) => ({ ...f, externalLinks: (e.target as HTMLInputElement).value }))}
                                            placeholder="Website URL" />
                                        <div style={{ fontSize: 12, color: "var(--secondary-foreground)", marginTop: 4 }}>
                                            Website, social media, Made-in-China, Alibaba, or other public profiles
                                        </div>
                                    </FormGroup>

                                    <FormGroup>
                                        <label>COA/S</label>
                                        <input type="text" value={form.coas}
                                            onInput={(e) => setForm((f) => ({ ...f, coas: (e.target as HTMLInputElement).value }))}
                                            placeholder="Janoshik, Peptidetest, Vanguard, Chromate" />
                                        <div style={{ fontSize: 12, color: "var(--secondary-foreground)", marginTop: 4 }}>
                                            Add links to Certificates of Analysis
                                        </div>
                                    </FormGroup>

                                    <FormGroup>
                                        <label>SERVER DESCRIPTION (REQUIRED)</label>
                                        <textarea value={form.shortDescription}
                                            onInput={(e) => setForm((f) => ({ ...f, shortDescription: (e.target as HTMLTextAreaElement).value }))}
                                            placeholder="Brief description, up to 10 words"
                                            rows={2} />
                                    </FormGroup>

                                    {form.type === "reseller" && (
                                        <FormGroup>
                                            <label>Order Types</label>
                                            <CheckboxGrid>
                                                {(Object.keys(ORDER_LABELS) as (keyof OrderTypes)[]).map((k) => (
                                                    <CheckLabel key={k} $checked={form.orderTypes[k]}>
                                                        <input type="checkbox" checked={form.orderTypes[k]}
                                                            onChange={() => setForm((f) => ({ ...f, orderTypes: toggle(f.orderTypes, k) }))} />
                                                        {ORDER_LABELS[k]}
                                                    </CheckLabel>
                                                ))}
                                            </CheckboxGrid>
                                        </FormGroup>
                                    )}
                                </>
                            )}

                            <FormGroup>
                                <label>NOTES (OPTIONAL)</label>
                                <textarea value={form.notes}
                                    onInput={(e) => setForm((f) => ({ ...f, notes: (e.target as HTMLTextAreaElement).value }))}
                                    placeholder="Describe your community, focus area, etc."
                                    rows={3} />
                            </FormGroup>
                            {error && <ErrorMsg>{error}</ErrorMsg>}
                            <PrimaryBtn type="submit">Submit for Review</PrimaryBtn>
                        </form>
                    )}
                </ModalBody>
            </ModalBox>
        </Overlay>
    );
}
