import { useState, useEffect } from "preact/hooks";
import { clientController } from "../../controllers/client/ClientController";
import type { Community, CommerceCommunity, Payment, Warehouses, Products, OrderTypes } from "./types";
import { PAYMENT_LABELS, WAREHOUSE_LABELS, PRODUCT_LABELS, ORDER_LABELS } from "./types";
import { formatCount } from "./dataUtils";
import {
    Badge, BadgeRow, Stars, StarNum,
    CommunityMeta, MetaItem, JoinBtn,
    Card, CardHead, CardLeft, CardName, CardRight, Chevron,
    CardDivider, CardBody, SectionLabel, InfoLine,
    TableName, TableMeta,
} from "./stylesCommunity";

// ─── Star components ──────────────────────────────────────────────────────────

export function StarRating({ rating }: { rating: number }) {
    const full = Math.round(rating);
    return (
        <>
            <Stars>{"★".repeat(full)}{"☆".repeat(5 - full)}</Stars>
            <StarNum>{rating.toFixed(1)}</StarNum>
        </>
    );
}

export function StarPicker({ rating, onChange }: { rating: number; onChange: (n: number) => void }) {
    return (
        <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span
                    key={n}
                    onClick={() => onChange(n)}
                    style={{
                        fontSize: 22,
                        cursor: "pointer",
                        color: n <= rating ? "var(--warning)" : "var(--block)",
                        transition: "color 0.1s",
                    }}>
                    ★
                </span>
            ))}
        </div>
    );
}

// ─── Badge display components ─────────────────────────────────────────────────

export function PaymentBadges({ payment }: { payment: Payment }) {
    return (
        <BadgeRow>
            {(Object.keys(PAYMENT_LABELS) as (keyof Payment)[]).map((k) =>
                payment[k] ? <Badge key={k} $v="accent">{PAYMENT_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

export function CountryBadges({ warehouses }: { warehouses: Warehouses }) {
    return (
        <BadgeRow>
            {(Object.keys(WAREHOUSE_LABELS) as (keyof Warehouses)[]).map((k) =>
                warehouses[k] ? <Badge key={k} $v="green">{WAREHOUSE_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

export function ProductBadges({ products }: { products: Products }) {
    return (
        <BadgeRow>
            {(Object.keys(PRODUCT_LABELS) as (keyof Products)[]).map((k) =>
                products[k] ? <Badge key={k} $v="purple">{PRODUCT_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

export function OrderBadges({ orderTypes }: { orderTypes: OrderTypes }) {
    return (
        <BadgeRow>
            {(Object.keys(ORDER_LABELS) as (keyof OrderTypes)[]).map((k) =>
                orderTypes[k] ? <Badge key={k} $v="orange">{ORDER_LABELS[k]}</Badge> : null,
            )}
        </BadgeRow>
    );
}

// ─── Community stats (live + fallback) ───────────────────────────────────────

function useLiveStats(community: Community): { memberCount: number; onlineCount: number } {
    const [live, setLive] = useState<{ memberCount: number; onlineCount: number } | null>(null);

    useEffect(() => {
        if (!community.serverId) return;
        const client = clientController.getReadyClient();
        if (!client) return;
        let cancelled = false;
        client.api.get(`/servers/${community.serverId}` as any)
            .then((server: any) => {
                if (cancelled) return;
                const memberCount = server?.members ?? server?.member_count ?? null;
                const onlineCount = server?.online ?? null;
                if (memberCount !== null) {
                    setLive({ memberCount, onlineCount: onlineCount ?? community.onlineCount });
                }
            })
            .catch(() => {/* fall through to stored fallback */});
        return () => { cancelled = true; };
    }, [community.serverId]);

    return live ?? { memberCount: community.memberCount, onlineCount: community.onlineCount };
}

// ─── Community Card ───────────────────────────────────────────────────────────

export function CommunityCard({
    community, reviewCount, onReview,
}: {
    community: Community; reviewCount: number; onReview: () => void;
}) {
    const [open, setOpen] = useState(false);
    const stats = useLiveStats(community);
    const isCommerce = community.type === "vendor" || community.type === "reseller";
    const c = community as CommerceCommunity;

    return (
        <Card>
            <CardHead onClick={() => setOpen((o) => !o)}>
                <CardLeft>
                    <CardName>
                        {community.name}
                        {community.verified && (
                            <span style={{ fontSize: 11, color: "#00b4d8", fontWeight: 700, marginLeft: 5 }}>✓</span>
                        )}
                    </CardName>
                    <CommunityMeta>
                        <MetaItem>{community.ageDays}d</MetaItem>
                        <MetaItem style={{ color: "var(--secondary-foreground)" }}>·</MetaItem>
                        <MetaItem>{formatCount(stats.memberCount)}</MetaItem>
                        <MetaItem style={{ color: "var(--secondary-foreground)" }}>·</MetaItem>
                        <MetaItem style={{ color: "var(--success)" }}>● {formatCount(stats.onlineCount)}</MetaItem>
                        <JoinBtn href={community.inviteLink} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}>
                            Join →
                        </JoinBtn>
                    </CommunityMeta>
                </CardLeft>
                <CardRight>
                    <div onClick={(e) => { e.stopPropagation(); onReview(); }}
                        style={{ cursor: "pointer" }} title="Open reviews">
                        <StarRating rating={community.rating} />
                        <div style={{ fontSize: 10, color: "var(--tertiary-foreground)", textAlign: "right", marginTop: 1 }}>
                            {reviewCount} review{reviewCount !== 1 ? "s" : ""}
                        </div>
                    </div>
                    {isCommerce && <CountryBadges warehouses={c.warehouses} />}
                    <Chevron $open={open}>▾</Chevron>
                </CardRight>
            </CardHead>

            {open && <CardDivider />}

            <CardBody $open={open}>
                {isCommerce && (
                    <>
                        <SectionLabel>Payment</SectionLabel>
                        <PaymentBadges payment={c.payment} />
                        <SectionLabel>Products</SectionLabel>
                        <ProductBadges products={c.products} />
                        {community.type === "reseller" && c.orderTypes && (
                            <>
                                <SectionLabel>Order Types</SectionLabel>
                                <OrderBadges orderTypes={c.orderTypes} />
                            </>
                        )}
                        <SectionLabel>Shipping</SectionLabel>
                        <InfoLine><strong>Time</strong> · {c.shippingTime}</InfoLine>
                        {c.freeShipping && (
                            <InfoLine>
                                <Badge $v="green">Free Shipping</Badge>
                                {c.freeShippingThreshold && (
                                    <span style={{ fontSize: 11, marginLeft: 6, color: "var(--tertiary-foreground)" }}>
                                        over {c.freeShippingThreshold}
                                    </span>
                                )}
                            </InfoLine>
                        )}
                    </>
                )}
                {community.notes && (
                    <>
                        <SectionLabel>Notes</SectionLabel>
                        <InfoLine>{community.notes}</InfoLine>
                    </>
                )}
            </CardBody>
        </Card>
    );
}

// ─── Community Table Row ──────────────────────────────────────────────────────

export function CommunityRow({
    community, reviewCount, isReseller, onReview,
}: {
    community: Community; reviewCount: number; isReseller: boolean; onReview: () => void;
}) {
    const stats = useLiveStats(community);
    const isCommerce = community.type === "vendor" || community.type === "reseller";
    const c = community as CommerceCommunity;

    return (
        <tr>
            <td onClick={onReview} style={{ cursor: "pointer", whiteSpace: "nowrap" }} title="Open reviews">
                <StarRating rating={community.rating} />
                <div style={{ fontSize: 10, color: "var(--tertiary-foreground)", marginTop: 3 }}>
                    {reviewCount} review{reviewCount !== 1 ? "s" : ""}
                </div>
            </td>
            <td style={{ minWidth: 180 }}>
                <TableName>
                    {community.name}
                    {community.verified && <span className="verified">✓</span>}
                </TableName>
                <TableMeta>
                    <span>{community.ageDays}d</span>
                    <span className="sep">·</span>
                    <span>{formatCount(stats.memberCount)} members</span>
                    <span className="sep">·</span>
                    <span className="online">● {formatCount(stats.onlineCount)}</span>
                    <JoinBtn href={community.inviteLink} target="_blank" rel="noreferrer"
                        style={{ fontSize: 10, padding: "2px 9px", marginLeft: 4 }}>
                        Join
                    </JoinBtn>
                </TableMeta>
            </td>
            {isCommerce ? (
                <>
                    <td><PaymentBadges payment={c.payment} /></td>
                    <td><CountryBadges warehouses={c.warehouses} /></td>
                    <td><ProductBadges products={c.products} /></td>
                    {isReseller && <td>{c.orderTypes ? <OrderBadges orderTypes={c.orderTypes} /> : <span style={{ color: "var(--tertiary-foreground)" }}>—</span>}</td>}
                    <td>
                        {c.freeShipping
                            ? <Badge $v="green">✓ {c.freeShippingThreshold || "Yes"}</Badge>
                            : <span style={{ color: "var(--tertiary-foreground)" }}>—</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--secondary-foreground)" }}>{c.shippingTime}</td>
                </>
            ) : (
                <td colSpan={isReseller ? 6 : 5} style={{ color: "var(--tertiary-foreground)", fontSize: 12, fontStyle: "italic" }}>
                    General community
                </td>
            )}
        </tr>
    );
}
