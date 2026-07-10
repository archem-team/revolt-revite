import { Store, X, Plus } from "@styled-icons/boxicons-regular";
import { BadgeCheck, ChevronRight } from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";

import { useEffect, useState } from "preact/hooks";

import { Preloader } from "@revoltchat/ui";

import { useClient } from "../../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../../directory/types";
import { CompoundVisual } from "./CompoundVisual";
import {
    Backdrop,
    Sheet,
    Head,
    VendorBlock,
    ActionIcon,
    VariationTable,
    VariationRow,
    VariationNote,
    Meta,
    Centered,
} from "./modalStyles";
import { FullProduct, VendorInfo, inviteCodeFromLink, money } from "./utils";

export const ProductModal = observer(
    ({
        productId,
        vendors,
        headers,
        onClose,
    }: {
        productId: string;
        vendors: Map<string, VendorInfo>;
        headers: Record<string, string>;
        onClose: () => void;
    }) => {
        const client = useClient();
        const [product, setProduct] = useState<FullProduct | null>(null);
        const [failed, setFailed] = useState(false);
        const [logoFailed, setLogoFailed] = useState(false);

        const autumn =
            client.configuration?.features.autumn?.url ||
            "https://peptide.chat/autumn";

        useEffect(() => {
            let cancelled = false;
            fetch(`${BACKEND_API_BASE}/catalog/${productId}`, { headers })
                .then((r) => r.json())
                .then((res) => {
                    if (cancelled) return;
                    if (res?.success) setProduct(res.data as FullProduct);
                    else setFailed(true);
                })
                .catch(() => !cancelled && setFailed(true));
            return () => {
                cancelled = true;
            };
        }, [productId]);

        // Lock body scroll + close on Escape while open.
        useEffect(() => {
            const prev = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Escape") onClose();
            };
            document.addEventListener("keydown", onKey);
            return () => {
                document.body.style.overflow = prev;
                document.removeEventListener("keydown", onKey);
            };
        }, [onClose]);

        const vendor = product?.serverId
            ? vendors.get(product.serverId)
            : undefined;
        const vendorName = vendor?.name ?? product?.vendorName;
        const logoUrl =
            vendor?.logo && !logoFailed
                ? `${autumn}/icons/${vendor.logo}?max_side=256`
                : null;

        // Prefer entering an already-joined community; otherwise the invite.
        const joined = product?.serverId
            ? client.servers.get(product.serverId)
            : undefined;
        const inviteCode = inviteCodeFromLink(
            product?.inviteLink ?? vendor?.inviteLink,
        );
        const linkTo = joined
            ? `/server/${product?.serverId}`
            : inviteCode
            ? `/invite/${inviteCode}`
            : null;

        return (
            <Backdrop onClick={onClose}>
                <Sheet onClick={(e) => e.stopPropagation()}>
                    {failed ? (
                        <>
                            <Head>
                                <div className="title">
                                    <h3>Product unavailable</h3>
                                </div>
                                <div className="close" onClick={onClose}>
                                    <X size={20} />
                                </div>
                            </Head>
                            <Centered>
                                This product may have been removed. Try
                                refreshing the list.
                            </Centered>
                        </>
                    ) : !product ? (
                        <Centered>
                            <Preloader type="ring" />
                        </Centered>
                    ) : (
                        <>
                            <Head>
                                <div className="title">
                                    <h3>{product.product}</h3>
                                    {product.sku && (
                                        <div className="sku">
                                            SKU {product.sku}
                                        </div>
                                    )}
                                </div>
                                <div className="close" onClick={onClose}>
                                    <X size={20} />
                                </div>
                            </Head>

                            <CompoundVisual
                                compound={product.compound}
                                fallback={product.product}
                                categories={product.categories}
                            />

                            {(vendorName || linkTo) && (
                                <VendorBlock>
                                    {logoUrl ? (
                                        <img
                                            src={logoUrl}
                                            loading="lazy"
                                            onError={() => setLogoFailed(true)}
                                        />
                                    ) : (
                                        <div className="glyph">
                                            <Store size={18} />
                                        </div>
                                    )}
                                    <div className="meta">
                                        <div className="name">
                                            {vendorName ?? "Unknown vendor"}
                                            {product.serverId && (
                                                <BadgeCheck size={14} />
                                            )}
                                        </div>
                                        {vendor && (
                                            <div className="sub">
                                                {vendor.productCount} products
                                                listed
                                            </div>
                                        )}
                                    </div>
                                    {linkTo && (
                                        <ActionIcon
                                            as={Link}
                                            to={linkTo}
                                            title={
                                                joined
                                                    ? "Open community"
                                                    : "Join community"
                                            }>
                                            {joined ? (
                                                <ChevronRight size={20} />
                                            ) : (
                                                <Plus size={20} />
                                            )}
                                        </ActionIcon>
                                    )}
                                </VendorBlock>
                            )}

                            {product.variations.length > 0 && (
                                <VariationTable>
                                    {product.variations.map((v, i) => (
                                        <div key={i}>
                                            <VariationRow>
                                                {v.dosage && (
                                                    <span className="dosage">
                                                        {v.dosage}
                                                    </span>
                                                )}
                                                {v.display_quantity && (
                                                    <span className="qty">
                                                        {v.display_quantity}
                                                    </span>
                                                )}
                                                <span className="price">
                                                    {money(
                                                        v.price,
                                                        product.currency,
                                                    )}
                                                    {v.unit && (
                                                        <span className="unit">
                                                            {" "}
                                                            / {v.unit}
                                                        </span>
                                                    )}
                                                </span>
                                            </VariationRow>
                                            {v.note && (
                                                <VariationNote>
                                                    {v.note}
                                                </VariationNote>
                                            )}
                                        </div>
                                    ))}
                                </VariationTable>
                            )}

                            {product.categories.length > 0 && (
                                <Meta>
                                    {product.categories.map((c) => (
                                        <span key={c}>{c}</span>
                                    ))}
                                </Meta>
                            )}
                        </>
                    )}
                </Sheet>
            </Backdrop>
        );
    },
);
