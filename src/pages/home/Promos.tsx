import {
    Calendar,
    MapPin,
    Tag,
    Store,
    Search,
    X,
    Plus,
} from "@styled-icons/boxicons-regular";
import {
    BadgeCheck,
    ChevronRight,
    ChevronDown,
} from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import styled from "styled-components/macro";

import { useEffect, useMemo, useState } from "preact/hooks";

import { Button, InputBox, Preloader } from "@revoltchat/ui";

import { useClient } from "../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../directory/types";
import ImageLightbox from "./ImageLightbox";
import PromoSubmit from "./PromoSubmit";

// ─── Types (mirrors the public Promos API) ──────────────────────────────────

export interface PromoItem {
    product: string;
    dosage?: string | null;
    price: number;
    unit?: string;
    moqKits?: number | null;
    moqTotal?: number | null;
    note?: string | null;
}

export interface Promo {
    id: string;
    vendor: {
        serverId: string | null;
        name: string;
        logo: string | null;
        inviteLink: string | null;
    };
    title: string | null;
    items: PromoItem[];
    images?: string[];
    shippingFee?: number;
    freeShippingThreshold?: number;
    shippingNote?: string | null;
    guarantee?: {
        purityPct?: number | null;
        volumePct?: number | null;
        customsReship?: boolean;
        text?: string | null;
    };
    discountNote?: string;
    warehouse?: string;
    moqNote?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    untilSoldOut?: boolean;
    timelineText?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}

type Sort = "newest" | "endingSoon";

// ─── Caching ──────────────────────────────────────────────────────────────────
// Promos are cached in localStorage per sort, with a short TTL. We render any
// cached copy instantly and revalidate in the background (stale-while-revalidate).

const CACHE_PREFIX = "promos_cache_";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface PromoCache {
    timestamp: number;
    data: Promo[];
}

const safeStorage = {
    get(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch {
            /* quota / private mode — ignore */
        }
    },
};

// ─── Layout ──────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

// Promos vary a lot in content (2 vs 14 products, image or not), so a fixed
// grid would either clip content or leave big empty gaps. Instead we use a
// masonry (CSS multi-column) layout: cards keep their natural height and pack
// tightly top-to-bottom with no wasted space. Single column on mobile, two on
// tablet, three on desktop.
const Grid = styled.div`
    column-count: 1;
    column-gap: 12px;

    @media (min-width: 720px) {
        column-count: 2;
    }

    @media (min-width: 1080px) {
        column-count: 3;
    }
`;

const Toolbar = styled.div`
    display: flex;
    gap: 10px;
    align-items: center;

    @media (max-width: 480px) {
        flex-wrap: wrap;
    }
`;

const SearchWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;

    input {
        padding-left: 42px;
        padding-right: 42px;
    }

    .search-icon {
        position: absolute;
        left: 14px;
        color: var(--tertiary-foreground);
        pointer-events: none;
    }

    .clear {
        position: absolute;
        right: 12px;
        display: flex;
        cursor: pointer;
        color: var(--tertiary-foreground);

        &:hover {
            color: var(--foreground);
        }
    }
`;

const SortSelect = styled.select`
    height: 38px;
    padding: 0 32px 0 12px;
    border: none;
    border-radius: var(--border-radius);
    background-color: var(--secondary-background);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23848484' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    color: var(--foreground);
    font-family: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    flex-shrink: 0;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
`;

const Centered = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--tertiary-foreground);
    font-size: 14px;
    text-align: center;
    margin-top: 48px;
`;

// Engaging empty state for when there are no live promos.
const Empty = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 56px 24px;
    gap: 6px;

    h3 {
        margin: 18px 0 0;
        font-size: 19px;
        color: var(--foreground);
    }

    p {
        margin: 0;
        max-width: 360px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--secondary-foreground);
    }

    .cta {
        margin-top: 18px;
    }
`;

// Decorative tag glyph on a soft accent halo, with a couple of orbiting
// price chips to give the empty state some life.
const Glyph = styled.div`
    position: relative;
    width: 96px;
    height: 96px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--accent);
    background: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--accent) 22%, transparent),
        transparent 70%
    );

    &::before {
        content: "";
        position: absolute;
        inset: 18px;
        border-radius: 50%;
        border: 2px dashed
            color-mix(in srgb, var(--accent) 45%, transparent);
        animation: promo-spin 18s linear infinite;
    }

    .float {
        position: absolute;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 7px;
        border-radius: 8px;
        color: var(--accent-contrast, #11171c);
        background: var(--accent);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        animation: promo-bob 3.4s ease-in-out infinite;
    }

    .float.a {
        top: -6px;
        right: -14px;
    }

    .float.b {
        bottom: -2px;
        left: -18px;
        animation-delay: 1.2s;
        background: var(--primary-background);
        color: var(--accent);
    }

    @keyframes promo-spin {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes promo-bob {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-6px);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        &::before,
        .float {
            animation: none;
        }
    }
`;

// ─── Card ─────────────────────────────────────────────────────────────────────

const Card = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border-radius: 10px;
    background: var(--secondary-background);
    /* Masonry layout: keep each card whole within its column and use a bottom
       margin for the vertical gap (column-gap only spaces columns). */
    break-inside: avoid;
    margin-bottom: 12px;
`;

const CardHead = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
`;

const Logo = styled.img`
    width: 38px;
    height: 38px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--primary-background);
`;

const LogoFallback = styled.div`
    width: 38px;
    height: 38px;
    border-radius: 50%;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: var(--primary-background);
    color: var(--tertiary-foreground);
`;

// Compact circular call-to-action in the card header (replaces the old
// full-width footer button). Rendered as an anchor via `as={Link}`.
const ActionIcon = styled.div`
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;

    /* Rendered as an <a> via react-router Link; the global a:link rule
       (color: accent) outweighs the component class, which would tint the
       icon the same red as the background. Force the contrast colour on the
       svg directly so the glyph is visible, and block-display it so it
       centres without inline-baseline offset. */
    & > svg {
        display: block;
        color: var(--accent-contrast, #11171c);
    }

    &:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
    }
`;

const VendorMeta = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;

    .name {
        font-weight: 600;
        font-size: 15px;
        color: var(--foreground);
    }

    .title {
        font-size: 13px;
        color: var(--secondary-foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

const Chip = styled.span<{ accent?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    padding: 5px 8px;
    border-radius: 6px;
    white-space: nowrap;
    color: ${(props) =>
        props.accent ? "var(--accent-contrast, #11171c)" : "var(--foreground)"};
    background: ${(props) =>
        props.accent ? "var(--accent)" : "var(--primary-background)"};
`;

const ItemTable = styled.div`
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    overflow: hidden;
    background: var(--primary-background);
`;

const ItemRow = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 9px 12px;
    font-size: 13px;

    & + & {
        border-top: 1px solid var(--secondary-background);
    }

    .product {
        font-weight: 600;
        color: var(--foreground);
    }

    .dosage {
        color: var(--secondary-foreground);
    }

    .moq {
        color: var(--tertiary-foreground);
        font-size: 12px;
    }

    .price {
        margin-left: auto;
        font-weight: 600;
        color: var(--foreground);
        white-space: nowrap;
    }

    .unit {
        color: var(--tertiary-foreground);
        font-weight: 400;
        font-size: 12px;
    }
`;

const ItemNote = styled.div`
    padding: 0 12px 9px;
    font-size: 12px;
    color: var(--tertiary-foreground);
    background: var(--primary-background);
`;

// Long promos can list a dozen-plus priced variants. Rather than show the
// whole table up front, we collapse to one chip per distinct compound and
// reveal the full pricing on demand so cards stay scannable. Small promos
// (few line items) skip the chip summary and show the table directly.
const COLLAPSE_THRESHOLD = 5;

const ProductSummary = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const CompoundChips = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;

const CompoundChip = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    padding: 7px 10px;
    border-radius: 7px;
    color: var(--foreground);
    background: var(--primary-background);

    .count {
        font-size: 11px;
        font-weight: 600;
        color: var(--tertiary-foreground);
    }
`;

const ItemToggle = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 9px 12px;
    border: none;
    border-top: 1px solid var(--secondary-background);
    background: var(--primary-background);
    color: var(--accent);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        background: var(--secondary-background);
    }

    svg {
        transition: transform 0.15s ease;
    }

    &[data-expanded="true"] svg {
        transform: rotate(180deg);
    }
`;

// Standalone (not table-attached) variant of the toggle, used under the
// compound-chip summary.
const SummaryToggle = styled.button`
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        text-decoration: underline;
    }
`;

const MetaRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;

const NoteText = styled.div`
    font-size: 13px;
    color: var(--secondary-foreground);
    line-height: 1.4;
`;

const Gallery = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;

    .hero {
        width: 100%;
        height: clamp(150px, 28vw, 220px);
        border-radius: 8px;
        object-fit: cover;
        cursor: zoom-in;
        background: var(--primary-background);
    }

    .thumbs {
        display: flex;
        gap: 6px;
        overflow-x: auto;

        img {
            width: 52px;
            height: 52px;
            border-radius: 6px;
            object-fit: cover;
            flex-shrink: 0;
            cursor: pointer;
            background: var(--primary-background);
        }
    }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number | undefined) =>
    typeof n === "number"
        ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : undefined;

const isUrl = (s: string) => /^https?:\/\//i.test(s);

function inviteCodeFromLink(link: string | null): string | null {
    if (!link) return null;
    const m = link.match(/\/invite\/([^/?#]+)/);
    return m?.[1] ?? null;
}

function timeline(p: Promo): string | null {
    if (p.untilSoldOut) return "Until sold out";
    if (p.endDate) {
        const d = new Date(p.endDate);
        if (!isNaN(d.getTime()))
            return `Ends ${d.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            })}`;
    }
    if (p.timelineText) return p.timelineText;
    return null;
}

// ─── Card component ────────────────────────────────────────────────────────────

const PromoCard = observer(
    ({
        promo,
        onOpenImage,
    }: {
        promo: Promo;
        onOpenImage: (src: string) => void;
    }) => {
    const client = useClient();
    const [expanded, setExpanded] = useState(false);
    // Vendor logo ids can reference files missing from this environment's
    // autumn (e.g. staging seeded from prod data), so a failed load falls
    // back to the store glyph instead of a broken image.
    const [logoFailed, setLogoFailed] = useState(false);
    const autumn =
        client.configuration?.features.autumn?.url ||
        "https://peptide.chat/autumn";

    const resolveImage = (ref: string) =>
        isUrl(ref) ? ref : `${autumn}/attachments/${ref}`;

    const logoUrl = promo.vendor.logo
        ? `${autumn}/icons/${promo.vendor.logo}?max_side=256`
        : null;

    // Prefer entering an already-joined community; otherwise offer the invite.
    const joined = promo.vendor.serverId
        ? client.servers.get(promo.vendor.serverId)
        : undefined;
    const inviteCode = inviteCodeFromLink(promo.vendor.inviteLink);
    const linkTo = joined
        ? `/server/${promo.vendor.serverId}`
        : inviteCode
        ? `/invite/${inviteCode}`
        : null;

    const g = promo.guarantee;
    const when = timeline(promo);

    return (
        <Card>
            <CardHead>
                {logoUrl && !logoFailed ? (
                    <Logo
                        src={logoUrl}
                        loading="lazy"
                        onError={() => setLogoFailed(true)}
                    />
                ) : (
                    <LogoFallback>
                        <Store size={22} />
                    </LogoFallback>
                )}
                <VendorMeta>
                    <span className="name">{promo.vendor.name}</span>
                    {promo.title && (
                        <span className="title">{promo.title}</span>
                    )}
                </VendorMeta>
                {linkTo && (
                    <ActionIcon
                        as={Link}
                        to={linkTo}
                        title={
                            joined ? "Open community" : "Join community"
                        }>
                        {joined ? (
                            <ChevronRight size={20} />
                        ) : (
                            <Plus size={20} />
                        )}
                    </ActionIcon>
                )}
            </CardHead>

            {promo.items.length > 0 &&
                (() => {
                    // One entry per distinct compound, preserving first-seen
                    // order, with a count of priced variants.
                    const compounds: { name: string; count: number }[] = [];
                    const index = new Map<string, number>();
                    for (const it of promo.items) {
                        const name = it.product;
                        const at = index.get(name);
                        if (at === undefined) {
                            index.set(name, compounds.length);
                            compounds.push({ name, count: 1 });
                        } else {
                            compounds[at].count++;
                        }
                    }

                    const collapsible =
                        promo.items.length > COLLAPSE_THRESHOLD;

                    // Collapsed: compact chip summary of the compounds.
                    if (collapsible && !expanded) {
                        return (
                            <ProductSummary>
                                <CompoundChips>
                                    {compounds.map((c) => (
                                        <CompoundChip key={c.name}>
                                            {c.name}
                                            {c.count > 1 && (
                                                <span className="count">
                                                    ×{c.count}
                                                </span>
                                            )}
                                        </CompoundChip>
                                    ))}
                                </CompoundChips>
                                <SummaryToggle
                                    onClick={() => setExpanded(true)}>
                                    {`Show all ${promo.items.length} prices`}
                                    <ChevronDown size={14} />
                                </SummaryToggle>
                            </ProductSummary>
                        );
                    }

                    // Expanded (or short promo): full pricing table.
                    return (
                        <ItemTable>
                            {promo.items.map((it, i) => {
                                const moq =
                                    it.moqKits || it.moqTotal
                                        ? `MOQ ${[
                                              it.moqKits
                                                  ? `${it.moqKits} kits`
                                                  : null,
                                              it.moqTotal
                                                  ? money(it.moqTotal)
                                                  : null,
                                          ]
                                              .filter(Boolean)
                                              .join(" / ")}`
                                        : null;
                                return (
                                    <div key={i}>
                                        <ItemRow>
                                            <span className="product">
                                                {it.product}
                                            </span>
                                            {it.dosage && (
                                                <span className="dosage">
                                                    {it.dosage}
                                                </span>
                                            )}
                                            {moq && (
                                                <span className="moq">
                                                    {moq}
                                                </span>
                                            )}
                                            <span className="price">
                                                {money(it.price)}
                                                <span className="unit">
                                                    {" "}
                                                    / {it.unit || "kit"}
                                                </span>
                                            </span>
                                        </ItemRow>
                                        {it.note && (
                                            <ItemNote>{it.note}</ItemNote>
                                        )}
                                    </div>
                                );
                            })}
                            {collapsible && (
                                <ItemToggle
                                    data-expanded={true}
                                    onClick={() => setExpanded(false)}>
                                    Show less
                                    <ChevronDown size={14} />
                                </ItemToggle>
                            )}
                        </ItemTable>
                    );
                })()}

            <MetaRow>
                {promo.warehouse && (
                    <Chip>
                        <MapPin size={12} />
                        {promo.warehouse}
                    </Chip>
                )}
                {typeof promo.shippingFee === "number" && (
                    <Chip>
                        {promo.shippingFee === 0
                            ? "Free shipping"
                            : `Shipping ${money(promo.shippingFee)}`}
                    </Chip>
                )}
                {typeof promo.freeShippingThreshold === "number" && (
                    <Chip>Free over {money(promo.freeShippingThreshold)}</Chip>
                )}
                {g?.purityPct != null && (
                    <Chip>
                        <BadgeCheck size={12} />
                        {g.purityPct}% purity
                    </Chip>
                )}
                {g?.volumePct != null && (
                    <Chip>
                        <BadgeCheck size={12} />
                        {g.volumePct}% volume
                    </Chip>
                )}
                {g?.customsReship && (
                    <Chip>
                        <BadgeCheck size={12} />
                        Customs reship
                    </Chip>
                )}
                {when && (
                    <Chip>
                        <Calendar size={12} />
                        {when}
                    </Chip>
                )}
            </MetaRow>

            {(promo.discountNote ||
                promo.shippingNote ||
                promo.moqNote ||
                g?.text) && (
                <NoteText>
                    {[promo.discountNote, promo.shippingNote, promo.moqNote, g?.text]
                        .filter(Boolean)
                        .join(" · ")}
                </NoteText>
            )}

            {promo.images && promo.images.length > 0 && (
                <Gallery>
                    <img
                        className="hero"
                        src={resolveImage(promo.images[0])}
                        loading="lazy"
                        onClick={() =>
                            onOpenImage(resolveImage(promo.images![0]))
                        }
                    />
                    {promo.images.length > 1 && (
                        <div className="thumbs">
                            {promo.images.slice(1).map((src, i) => (
                                <img
                                    key={i}
                                    src={resolveImage(src)}
                                    loading="lazy"
                                    onClick={() =>
                                        onOpenImage(resolveImage(src))
                                    }
                                />
                            ))}
                        </div>
                    )}
                </Gallery>
            )}

        </Card>
    );
});

// ─── Page ────────────────────────────────────────────────────────────────────

const Promos: React.FC = () => {
    const client = useClient();
    const [promos, setPromos] = useState<Promo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sort, setSort] = useState<Sort>("newest");
    const [query, setQuery] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [lightbox, setLightbox] = useState<string | null>(null);

    // Servers the current user owns can have a promo submitted for them.
    // Computed inline (not memoised) so MobX observer re-renders pick up
    // servers that finish loading after mount.
    const ownedServers = [...client.servers.values()].filter(
        (s) => s.owner === client.user?._id,
    );

    useEffect(() => {
        let cancelled = false;
        const key = CACHE_PREFIX + sort;
        let hadCache = false;
        let fresh = false;

        // Show any cached promos immediately.
        try {
            const raw = safeStorage.get(key);
            if (raw) {
                const parsed: PromoCache = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.data)) {
                    setPromos(parsed.data);
                    setLoading(false);
                    hadCache = true;
                    fresh = Date.now() - parsed.timestamp < CACHE_TTL;
                }
            }
        } catch {
            /* corrupt cache — ignore and refetch */
        }

        // Skip the network entirely while the cache is still fresh.
        if (!fresh) {
            if (!hadCache) {
                setLoading(true);
                setError(null);
            }

            const sessionToken =
                typeof client.session === "string"
                    ? client.session
                    : (client.session as any)?.token ?? "";

            fetch(`${BACKEND_API_BASE}/promos?sort=${sort}&pageSize=100`, {
                headers: { "x-session-token": sessionToken },
            })
                .then((r) => r.json())
                .then((res) => {
                    if (cancelled) return;
                    if (!res?.success || !Array.isArray(res.data?.items)) {
                        throw new Error("Unexpected response");
                    }
                    const items = res.data.items as Promo[];
                    setPromos(items);
                    setLoading(false);
                    safeStorage.set(
                        key,
                        JSON.stringify({ timestamp: Date.now(), data: items }),
                    );
                })
                .catch(() => {
                    if (cancelled) return;
                    // Keep showing stale cache on failure; only surface an
                    // error when we have nothing to display.
                    if (!hadCache) {
                        setError(
                            "Failed to load promos. Please try again later.",
                        );
                        setLoading(false);
                    }
                });
        }

        return () => {
            cancelled = true;
        };
    }, [sort]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return promos;
        return promos.filter(
            (p) =>
                p.vendor.name?.toLowerCase().includes(q) ||
                p.title?.toLowerCase().includes(q) ||
                p.items.some((it) => it.product?.toLowerCase().includes(q)),
        );
    }, [promos, query]);

    if (submitting) {
        return (
            <Wrapper>
                <PromoSubmit
                    servers={ownedServers}
                    onClose={() => setSubmitting(false)}
                />
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <Toolbar>
                <SearchWrapper>
                    <Search size={18} className="search-icon" />
                    <InputBox
                        palette="secondary"
                        value={query}
                        onChange={(e) => setQuery(e.currentTarget.value)}
                        placeholder="Search promos…"
                    />
                    {query && (
                        <div className="clear" onClick={() => setQuery("")}>
                            <X size={18} />
                        </div>
                    )}
                </SearchWrapper>
                <SortSelect
                    value={sort}
                    onChange={(e) =>
                        setSort(e.currentTarget.value as Sort)
                    }>
                    <option value="newest">Newest</option>
                    <option value="endingSoon">Ending soon</option>
                </SortSelect>
                {ownedServers.length > 0 && (
                    <Button
                        compact
                        palette="accent"
                        onClick={() => setSubmitting(true)}>
                        <Tag size={16} />
                        Submit
                    </Button>
                )}
            </Toolbar>

            {loading ? (
                <Centered>
                    <Preloader type="ring" />
                </Centered>
            ) : error ? (
                <Centered>{error}</Centered>
            ) : filtered.length === 0 ? (
                query ? (
                    <Empty>
                        <Glyph>
                            <Search size={40} />
                        </Glyph>
                        <h3>Nothing matches “{query.trim()}”</h3>
                        <p>
                            Try a different product, vendor, or warehouse, or
                            clear the search to see every live promo.
                        </p>
                        <div className="cta">
                            <Button
                                compact
                                palette="secondary"
                                onClick={() => setQuery("")}>
                                Clear search
                            </Button>
                        </div>
                    </Empty>
                ) : (
                    <Empty>
                        <Glyph>
                            <span className="float a">-20%</span>
                            <span className="float b">$78</span>
                            <Tag size={40} />
                        </Glyph>
                        <h3>No live promos right now</h3>
                        <p>
                            {ownedServers.length > 0
                                ? "Be the first to post one. Submit a promo for your community and it’ll show up here once an admin approves it."
                                : "Vendors haven’t posted any deals yet. Check back soon. Fresh promos land here as communities publish them."}
                        </p>
                        {ownedServers.length > 0 && (
                            <div className="cta">
                                <Button
                                    palette="accent"
                                    onClick={() => setSubmitting(true)}>
                                    <Tag size={16} />
                                    Submit your promo
                                </Button>
                            </div>
                        )}
                    </Empty>
                )
            ) : (
                <Grid>
                    {filtered.map((p) => (
                        <PromoCard
                            key={p.id}
                            promo={p}
                            onOpenImage={setLightbox}
                        />
                    ))}
                </Grid>
            )}

            {lightbox && (
                <ImageLightbox
                    src={lightbox}
                    onClose={() => setLightbox(null)}
                />
            )}
        </Wrapper>
    );
};

export default observer(Promos);
