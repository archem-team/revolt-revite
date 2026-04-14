import { useState } from "preact/hooks";
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
        products: { ...defPr }, guarantees: { ...defGu }, guaranteeTexts: { ...defGuText }, orderTypes: { ...defOr }, notes: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const isCommerce = form.type === "vendor" || form.type === "reseller";

    function handleSubmit(e: Event) {
        e.preventDefault();
        if (!form.name.trim()) { setError("Name is required."); return; }
        if (!form.inviteLink.trim()) { setError("PepChat invite link is required."); return; }
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
                                        <label>Countries Served</label>
                                        <CheckboxGrid>
                                            {(Object.keys(WAREHOUSE_LABELS) as (keyof Warehouses)[]).map((k) => (
                                                <CheckLabel key={k} $checked={form.warehouses[k]}>
                                                    <input type="checkbox" checked={form.warehouses[k]}
                                                        onChange={() => setForm((f) => ({ ...f, warehouses: toggle(f.warehouses, k) }))} />
                                                    {WAREHOUSE_LABELS[k]}
                                                </CheckLabel>
                                            ))}
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
                                <label>Notes (optional)</label>
                                <textarea value={form.notes}
                                    onInput={(e) => setForm((f) => ({ ...f, notes: (e.target as HTMLTextAreaElement).value }))}
                                    placeholder="Describe your community, focus area, etc." />
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
