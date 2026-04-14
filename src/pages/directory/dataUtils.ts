import type {
    Community,
    CommerceCommunity,
    CommunityBase,
    VendorCommunity,
    ResellerCommunity,
    OtherCommunity,
    Review,
    Payment,
    Warehouses,
    Products,
    Guarantees,
    GuaranteeTexts,
    OrderTypes,
    FilterKey,
} from "./types";
import { GUARANTEE_TEXT_DEFAULTS } from "./types";

// ─── CSV Parser ───────────────────────────────────────────────────────────────

export function parseCSV(text: string): Record<string, string>[] {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (lines.length < 2) return [];
    const headers = splitCSVRow(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = splitCSVRow(line);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h.trim()] = values[idx]?.trim() ?? "";
        });
        rows.push(row);
    }
    return rows;
}

function splitCSVRow(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuote && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else inQuote = !inQuote;
        } else if (ch === "," && !inQuote) {
            result.push(cur);
            cur = "";
        } else {
            cur += ch;
        }
    }
    result.push(cur);
    return result;
}

function toBool(v: string): boolean {
    return v === "TRUE" || v === "true" || v === "1";
}
function toNum(v: string): number {
    return parseFloat(v) || 0;
}
function toText(v: string | undefined, fallback: string): string {
    const trimmed = (v ?? "").trim();
    return trimmed || fallback;
}

function mapGuaranteeTexts(
    texts?: Partial<GuaranteeTexts> | null,
): GuaranteeTexts {
    return {
        purity: toText(texts?.purity, GUARANTEE_TEXT_DEFAULTS.purity),
        volume: toText(texts?.volume, GUARANTEE_TEXT_DEFAULTS.volume),
        reship: toText(texts?.reship, GUARANTEE_TEXT_DEFAULTS.reship),
    };
}

export function rowToCommunity(r: Record<string, string>): Community | null {
    const type = r["type"] as "vendor" | "reseller" | "other";
    if (!type || !r["id"]) return null;
    const base: CommunityBase = {
        id: r["id"],
        type,
        name: r["name"] || "",
        logo: r["logo"] || null,
        inviteLink: r["inviteLink"] || "",
        serverId: r["serverId"] || null,
        ageDays: toNum(r["ageDays"]),
        verified: toBool(r["verified"]),
        memberCount: toNum(r["memberCount"]),
        onlineCount: toNum(r["onlineCount"]),
        rating: toNum(r["rating"]),
        notes: r["notes"] || "",
    };
    if (type === "other") return base as OtherCommunity;
    const commerce = {
        ...base,
        payment: {
            cc: toBool(r["cc"]),
            btc: toBool(r["btc"]),
            pp: toBool(r["pp"]),
            zelle: toBool(r["zelle"]),
            venmo: toBool(r["venmo"]),
            bt: toBool(r["bt"]),
            chk: toBool(r["chk"]),
        },
        warehouses: {
            us: toBool(r["us"]),
            eu: toBool(r["eu"]),
            aus: toBool(r["aus"]),
        },
        products: {
            pep: toBool(r["pep"]),
            oil: toBool(r["oil"]),
            tabs: toBool(r["tabs"]),
            raw: toBool(r["raw"]),
            amn: toBool(r["amn"]),
            sup: toBool(r["sup"]),
            aas: toBool(r["aas"]),
        },
        guarantees: {
            purity: toBool(r["guaranteePurity"]),
            volume: toBool(r["guaranteeVolume"]),
            reship: toBool(r["guaranteeReship"]),
        },
        guaranteeTexts: {
            purity: toText(
                r["guaranteePurityText"],
                GUARANTEE_TEXT_DEFAULTS.purity,
            ),
            volume: toText(
                r["guaranteeVolumeText"],
                GUARANTEE_TEXT_DEFAULTS.volume,
            ),
            reship: toText(
                r["guaranteeReshipText"],
                GUARANTEE_TEXT_DEFAULTS.reship,
            ),
        },
        shippingTime: r["shippingTime"] || "",
        freeShipping: toBool(r["freeShipping"]),
        freeShippingThreshold: r["freeShippingThreshold"] || "",
    };
    if (type === "reseller") {
        return {
            ...commerce,
            type: "reseller",
            orderTypes: {
                single: toBool(r["orderSingle"]),
                halfkit: toBool(r["orderHalfkit"]),
                fullkit: toBool(r["orderFullkit"]),
            },
        } as ResellerCommunity;
    }
    return { ...commerce, type: "vendor", orderTypes: null } as VendorCommunity;
}

export function rowToReview(r: Record<string, string>): Review | null {
    if (!r["id"] || !r["vendorId"]) return null;
    return {
        id: r["id"],
        vendorId: r["vendorId"],
        vendorType: r["vendorType"] || "vendor",
        reviewerName: r["reviewerName"] || "Anonymous",
        rating: toNum(r["rating"]) || 5,
        text: r["text"] || "",
        date: r["date"] || "",
    };
}

// ─── Default map values ───────────────────────────────────────────────────────

export const defPay: Payment = {
    cc: false,
    btc: false,
    pp: false,
    zelle: false,
    venmo: false,
    bt: false,
    chk: false,
};
export const defWh: Warehouses = { us: false, eu: false, aus: false };
export const defPr: Products = {
    pep: false,
    oil: false,
    tabs: false,
    raw: false,
    amn: false,
    sup: false,
    aas: false,
};
export const defGu: Guarantees = {
    purity: false,
    volume: false,
    reship: false,
};
export const defGuText: GuaranteeTexts = { ...GUARANTEE_TEXT_DEFAULTS };
export const defOr: OrderTypes = {
    single: false,
    halfkit: false,
    fullkit: false,
};

// ─── API → model mappers ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiToCommunity(c: any): Community {
    const base: CommunityBase = {
        id: c.id,
        type: c.type,
        name: c.name || "",
        logo: c.logo || null,
        inviteLink: c.inviteLink || "",
        serverId: c.serverId || null,
        ageDays: c.ageDays || 0,
        verified: c.verified || false,
        memberCount: c.memberCount || 0,
        onlineCount: c.onlineCount || 0,
        rating: c.rating || 0,
        notes: c.notes || "",
    };
    if (c.type === "other") return base as OtherCommunity;
    const commerce = {
        ...base,
        payment: c.payment ?? { ...defPay },
        warehouses: c.warehouses ?? { ...defWh },
        products: c.products ?? { ...defPr },
        guarantees: c.guarantees ?? { ...defGu },
        guaranteeTexts: mapGuaranteeTexts(c.guaranteeTexts),
        shippingTime: c.shippingTime || "",
        freeShipping: c.freeShipping || false,
        freeShippingThreshold: c.freeShippingThreshold || "",
    };
    if (c.type === "reseller") {
        return {
            ...commerce,
            type: "reseller",
            orderTypes: c.orderTypes ?? { ...defOr },
        } as ResellerCommunity;
    }
    return { ...commerce, type: "vendor", orderTypes: null } as VendorCommunity;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiToReview(r: any): Review {
    return {
        id: r.id,
        vendorId: r.communityId,
        vendorType: r.communityType || "vendor",
        reviewerName: r.reviewerName || "Anonymous",
        rating: r.rating || 5,
        text: r.text || "",
        date: r.date || (r.createdAt ? r.createdAt.split("T")[0] : ""),
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
}

export function matchesFilters(
    c: CommerceCommunity,
    active: Set<FilterKey>,
): boolean {
    if (active.size === 0) return true;
    for (const f of active) {
        if (f === "us" && !c.warehouses.us) return false;
        if (f === "eu" && !c.warehouses.eu) return false;
        if (f === "aus" && !c.warehouses.aus) return false;
        if (f === "cc" && !c.payment.cc) return false;
        if (f === "crypto" && !c.payment.btc) return false;
        if (f === "freeShipping" && !c.freeShipping) return false;
        if (f === "raw" && !c.products.raw) return false;
        if (f === "oil" && !c.products.oil) return false;
        if (f === "aas" && !c.products.aas) return false;
        if (f === "amn" && !c.products.amn) return false;
        if (f === "sup" && !c.products.sup) return false;
    }
    return true;
}

export function toggle<T extends object>(obj: T, key: keyof T): T {
    return { ...obj, [key]: !obj[key] };
}
