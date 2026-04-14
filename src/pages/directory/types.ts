// ─── Types ────────────────────────────────────────────────────────────────────

export interface Payment {
    cc: boolean;
    btc: boolean;
    pp: boolean;
    zelle: boolean;
    venmo: boolean;
    bt: boolean;
    chk: boolean;
}
export interface Warehouses {
    us: boolean;
    eu: boolean;
    aus: boolean;
}
export interface Products {
    pep: boolean;
    oil: boolean;
    tabs: boolean;
    raw: boolean;
    amn: boolean;
    sup: boolean;
    aas: boolean;
}
export interface Guarantees {
    purity: boolean;
    volume: boolean;
    reship: boolean;
}
export type GuaranteeTexts = Record<keyof Guarantees, string>;
export interface OrderTypes {
    single: boolean;
    halfkit: boolean;
    fullkit: boolean;
}

export interface CommunityBase {
    id: string;
    type: "vendor" | "reseller" | "other";
    name: string;
    logo?: string | null;
    inviteLink: string;
    serverId?: string | null;
    ageDays: number;
    verified: boolean;
    memberCount: number;
    onlineCount: number;
    rating: number;
    notes: string;
}

export interface VendorCommunity extends CommunityBase {
    type: "vendor";
    payment: Payment;
    warehouses: Warehouses;
    products: Products;
    guarantees: Guarantees;
    guaranteeTexts?: GuaranteeTexts;
    orderTypes: null;
    shippingTime: string;
    freeShipping: boolean;
    freeShippingThreshold: string;
}

export interface ResellerCommunity extends CommunityBase {
    type: "reseller";
    payment: Payment;
    warehouses: Warehouses;
    products: Products;
    guarantees: Guarantees;
    guaranteeTexts?: GuaranteeTexts;
    orderTypes: OrderTypes;
    shippingTime: string;
    freeShipping: boolean;
    freeShippingThreshold: string;
}

export interface OtherCommunity extends CommunityBase {
    type: "other";
}

export type Community = VendorCommunity | ResellerCommunity | OtherCommunity;
export type CommerceCommunity = VendorCommunity | ResellerCommunity;

export interface Review {
    id: string;
    vendorId: string;
    vendorType: string;
    reviewerName: string;
    rating: number;
    text: string;
    date: string;
}

export interface SubmitForm {
    type: "vendor" | "reseller" | "other";
    name: string;
    inviteLink: string;
    serverId: string;
    payment: Payment;
    warehouses: Warehouses;
    products: Products;
    guarantees: Guarantees;
    guaranteeTexts: GuaranteeTexts;
    orderTypes: OrderTypes;
    notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_LABELS: Record<keyof Payment, string> = {
    cc: "CC",
    btc: "BTC",
    pp: "PP",
    zelle: "ZL",
    venmo: "VM",
    bt: "BT",
    chk: "CHK",
};
export const WAREHOUSE_LABELS: Record<keyof Warehouses, string> = {
    us: "US",
    eu: "EU",
    aus: "AUS",
};
export const PRODUCT_LABELS: Record<keyof Products, string> = {
    pep: "PEP",
    oil: "OIL",
    tabs: "TABS",
    raw: "RAW",
    amn: "AMN",
    sup: "SUP",
    aas: "AAS",
};
export const GUARANTEE_LABELS: Record<keyof Guarantees, string> = {
    purity: "Purity",
    volume: "Volume",
    reship: "Re-Ship",
};
export const GUARANTEE_TEXT_DEFAULTS: GuaranteeTexts = {
    purity: "Re-ship/Replacement or refund if purity is below 99%",
    volume: "Re-ship/Replacement or refund if fill volume is below 90%",
    reship: "Re-ship/Replacement or refund if seized by customs",
};
export const GUARANTEE_HINTS: Record<keyof Guarantees, string> = {
    purity: "Re-ship/Replacement or refund if purity is below 99%",
    volume: "Re-ship/Replacement or refund if fill volume is below 90%",
    reship: "Re-ship/Replacement or refund if seized by customs",
};
export const ORDER_LABELS: Record<keyof OrderTypes, string> = {
    single: "1V",
    halfkit: "½K",
    fullkit: "FK",
};

export type FilterKey =
    | "us"
    | "eu"
    | "aus"
    | "cc"
    | "crypto"
    | "freeShipping"
    | "raw"
    | "oil"
    | "aas"
    | "amn"
    | "sup";

export const COMMERCE_FILTERS: {
    key: FilterKey;
    label: string;
    emoji: string;
}[] = [
    { key: "us", label: "US", emoji: "🇺🇸" },
    { key: "eu", label: "EU", emoji: "🇪🇺" },
    { key: "aus", label: "AU", emoji: "🇦🇺" },
    { key: "cc", label: "Credit Card", emoji: "💳" },
    { key: "crypto", label: "Crypto", emoji: "₿" },
    { key: "freeShipping", label: "Free Ship", emoji: "📦" },
    { key: "raw", label: "Raws", emoji: "🧪" },
    { key: "oil", label: "Oils", emoji: "💧" },
    { key: "aas", label: "AAS", emoji: "⚗️" },
    { key: "amn", label: "Aminos", emoji: "🔬" },
    { key: "sup", label: "Supplies", emoji: "🛒" },
];

export const LEGEND = [
    {
        category: "Payment",
        items: [
            { abbr: "CC", label: "Credit Card" },
            { abbr: "BTC", label: "Bitcoin / Crypto" },
            { abbr: "PP", label: "PayPal" },
            { abbr: "ZL", label: "Zelle" },
            { abbr: "VM", label: "Venmo" },
            { abbr: "BT", label: "Bank Transfer" },
            { abbr: "CHK", label: "Check" },
        ],
    },
    {
        category: "Countries",
        items: [
            { abbr: "US", label: "United States" },
            { abbr: "EU", label: "Europe" },
            { abbr: "AUS", label: "Australia" },
        ],
    },
    {
        category: "Products",
        items: [
            { abbr: "PEP", label: "Peptides" },
            { abbr: "OIL", label: "Oils" },
            { abbr: "TABS", label: "Tablets" },
            { abbr: "RAW", label: "Raw Powder" },
            { abbr: "AMN", label: "Amino Acids" },
            { abbr: "SUP", label: "Supplies" },
            { abbr: "AAS", label: "Anabolic-Androgenic Steroids" },
        ],
    },
    {
        category: "Guarantee",
        items: [
            {
                abbr: "Purity",
                label: "Re-ship/Replacement or refund if purity is below 99%",
            },
            {
                abbr: "Volume",
                label: "Re-ship/Replacement or refund if fill volume is below 90%",
            },
            {
                abbr: "Re-Ship",
                label: "Re-ship guarantee: Re-ship/Replacement or refund if seized by customs",
            },
        ],
    },
    {
        category: "Order Types",
        items: [
            { abbr: "1V", label: "Single Vial" },
            { abbr: "½K", label: "Half Kit" },
            { abbr: "FK", label: "Full Kit" },
        ],
    },
];

// ─── Sheet URLs ───────────────────────────────────────────────────────────────

export const SHEET_COMMUNITIES =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRIOkigL7Zu8jsYMF0AKu8CAw1az-8EFiAhHCrXBzSASrhQDocU-U5mezf2u08uO_imVvWvmi3rH-NX/pub?gid=0&single=true&output=csv";
export const SHEET_REVIEWS =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRIOkigL7Zu8jsYMF0AKu8CAw1az-8EFiAhHCrXBzSASrhQDocU-U5mezf2u08uO_imVvWvmi3rH-NX/pub?gid=1967322747&single=true&output=csv";

// ─── Live API ─────────────────────────────────────────────────────────────────

export const API_BASE = "https://manageapi.peptide.chat/api";
