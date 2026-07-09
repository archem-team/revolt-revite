import { Search, X, Store, SortAlt } from "@styled-icons/boxicons-regular";
import { BadgeCheck } from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import styled from "styled-components/macro";
import { useEffect, useMemo, useState } from "preact/hooks";
import { InputBox, Preloader } from "@revoltchat/ui";
import { useClient } from "../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../directory/types";

// ─── Types ───────────────────────────────────────────────────────────

interface CatalogItem {
    id: string;
    serverId?: string | null;
    vendorName?: string | null;
    product: string;
    normalized?: string | null;
    fromPrice: number;
    toPrice?: number | null;
    currency: string;
    categories: string[];
    createdAt: string;
}

interface CatalogResponse {
    success: boolean;
    data: {
        items: CatalogItem[];
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };
}

interface VendorInfo {
    serverId: string;
    name: string;
    logo?: string | null;
    inviteLink?: string | null;
    productCount: number;
    categories: string[];
}

interface CategoryInfo {
    category: string;
    count: number;
    vendorCount: number;
}

// ─── Styled Components ────────────────────────────────────────────────

const PageWrap = styled.div`
    padding: 0 16px 32px;
    max-width: 1200px;
    margin: 0 auto;
`;

const SearchRow = styled.div`
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: center;
`;

const SearchField = styled.div`
    position: relative;
    flex: 1;
    min-width: 200px;
    input { padding-left: 38px; padding-right: 32px; }
    .icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--tertiary-foreground); }
    .clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--tertiary-foreground); display: flex; }
`;

const SortSelect = styled.select`
    padding: 8px 12px; border-radius: 6px; border: 1px solid var(--tertiary-foreground);
    background: var(--secondary-background); color: var(--foreground); font-size: 13px; cursor: pointer;
`;

const Layout = styled.div`
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 24px;
    @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const Sidebar = styled.div`
    @media (max-width: 768px) { display: none; }
`;

const SidebarTitle = styled.div`
    font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--secondary-foreground); margin-bottom: 12px;
`;

const CategoryChip = styled.div<{ active: boolean }>`
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-bottom: 4px;
    background: ${p => p.active ? "var(--accent)" : "var(--secondary-background)"};
    color: ${p => p.active ? "white" : "var(--foreground)"};
    transition: background 0.15s;
    &:hover { background: ${p => p.active ? "var(--accent)" : "var(--tertiary-background)"}; }
    span { font-size: 11px; color: ${p => p.active ? "rgba(255,255,255,0.7)" : "var(--tertiary-foreground)"}; }
`;

const PriceFilter = styled.div`
    display: flex; gap: 8px; margin-bottom: 16px;
    input { width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--tertiary-foreground);
        background: var(--secondary-background); color: var(--foreground); font-size: 12px; box-sizing: border-box; }
`;

const ProductGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
`;

const ProductCard = styled.div`
    background: var(--secondary-background);
    border-radius: 10px;
    padding: 16px;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    border: 1px solid transparent;
    &:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); border-color: var(--accent); }
`;

const ProductName = styled.div`
    font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--foreground);
`;

const VendorLabel = styled.div`
    font-size: 12px; color: var(--accent); margin-bottom: 8px; display: flex; align-items: center; gap: 4px;
`;

const PriceDisplay = styled.div`
    font-size: 18px; font-weight: 700; color: var(--foreground);
    small { font-size: 12px; font-weight: 400; color: var(--secondary-foreground); }
`;

const Categories = styled.div`
    display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;
    span { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--tertiary-background); color: var(--secondary-foreground); }
`;

const Pagination = styled.div`
    display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 24px;
    button { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--tertiary-foreground);
        background: var(--secondary-background); color: var(--foreground); cursor: pointer; font-size: 13px;
        &:disabled { opacity: 0.4; cursor: default; }
        &:hover:not(:disabled) { background: var(--accent); color: white; border-color: var(--accent); } }
    span { font-size: 13px; color: var(--secondary-foreground); }
`;

const LoaderWrap = styled.div`
    display: flex; align-items: center; justify-content: center; padding: 64px 0;
`;

const EmptyState = styled.div`
    text-align: center; padding: 64px 0; color: var(--tertiary-foreground); font-size: 14px;
`;

const BadgeRow = styled.div`
    display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;
`;

const Badge = styled.span`
    font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--accent); color: white;
`;

const CATEGORY_ALL = "all";

const Catalog: React.FC = () => {
    const client = useClient();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [selectedCat, setSelectedCat] = useState(CATEGORY_ALL);
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const sessionToken = typeof client.session === "string"
        ? client.session : (client.session as any)?.token ?? "";
    const headers = { "x-session-token": sessionToken };

    // Fetch categories once
    useEffect(() => {
        fetch(`${BACKEND_API_BASE}/catalog/categories`, { headers })
            .then(r => r.json())
            .then(res => { if (res?.success) setCategories(res.data); })
            .catch(() => {});
    }, []);

    // Fetch products
    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (selectedCat !== CATEGORY_ALL) params.set("category", selectedCat);
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        if (sort) params.set("sort", sort);
        params.set("page", String(page));
        params.set("pageSize", "24");

        fetch(`${BACKEND_API_BASE}/catalog?${params}`, { headers })
            .then(r => r.json())
            .then((res: CatalogResponse) => {
                if (res?.success) {
                    setItems(res.data.items);
                    setTotalPages(res.data.pagination.totalPages);
                    setTotal(res.data.pagination.total);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [query, selectedCat, minPrice, maxPrice, sort, page]);

    // Reset page on filter change
    useEffect(() => { setPage(1); }, [query, selectedCat, minPrice, maxPrice, sort]);

    return (
        <PageWrap>
            <h2 style={{ marginBottom: 16, fontSize: 22 }}>Compound Finder</h2>
            <p style={{ fontSize: 13, color: "var(--secondary-foreground)", marginBottom: 16 }}>
                Browse peptides and products from all vendors. {total > 0 && `${total} products found.`}
            </p>

            <SearchRow>
                <SearchField>
                    <Search size={16} className="icon" />
                    <InputBox palette="secondary" value={query}
                        onChange={e => setQuery(e.currentTarget.value)}
                        placeholder="Search products…" />
                    {query && <div className="clear" onClick={() => setQuery("")}><X size={16} /></div>}
                </SearchField>
                <SortSelect value={sort} onChange={e => setSort(e.currentTarget.value)}>
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    <option value="price_asc">Lowest Price</option>
                    <option value="price_desc">Highest Price</option>
                </SortSelect>
            </SearchRow>

            <Layout>
                <Sidebar>
                    <SidebarTitle>Categories</SidebarTitle>
                    <CategoryChip active={selectedCat === CATEGORY_ALL} onClick={() => setSelectedCat(CATEGORY_ALL)}>
                        All {total > 0 && <span>({total})</span>}
                    </CategoryChip>
                    {categories.map(c => (
                        <CategoryChip key={c.category} active={selectedCat === c.category}
                            onClick={() => setSelectedCat(c.category)}>
                            {c.category} <span>({c.count})</span>
                        </CategoryChip>
                    ))}

                    <div style={{ marginTop: 20 }}>
                        <SidebarTitle>Price Range</SidebarTitle>
                        <PriceFilter>
                            <input type="number" placeholder="Min $"
                                value={minPrice} onInput={e => setMinPrice((e.target as HTMLInputElement).value)} />
                            <input type="number" placeholder="Max $"
                                value={maxPrice} onInput={e => setMaxPrice((e.target as HTMLInputElement).value)} />
                        </PriceFilter>
                    </div>
                </Sidebar>

                <div>
                    {loading ? (
                        <LoaderWrap><Preloader type="ring" /></LoaderWrap>
                    ) : items.length === 0 ? (
                        <EmptyState>No products found. Try adjusting filters.</EmptyState>
                    ) : (
                        <>
                            <ProductGrid>
                                {items.map(item => (
                                    <ProductCard key={item.id}>
                                        <ProductName>{item.product}</ProductName>
                                        <VendorLabel>
                                            {item.vendorName ? <><Store size={14} /> {item.vendorName}</> : "Unknown vendor"}
                                        </VendorLabel>
                                        <PriceDisplay>
                                            ${item.fromPrice}
                                            {item.toPrice != null && item.toPrice > item.fromPrice && (
                                                <> — ${item.toPrice}</>
                                            )}
                                            <small> / {item.currency}</small>
                                        </PriceDisplay>
                                        <Categories>
                                            {item.categories.map(c => <span key={c}>{c}</span>)}
                                        </Categories>
                                    </ProductCard>
                                ))}
                            </ProductGrid>

                            {totalPages > 1 && (
                                <Pagination>
                                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                                    <span>Page {page} of {totalPages}</span>
                                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
                                </Pagination>
                            )}
                        </>
                    )}
                </div>
            </Layout>
        </PageWrap>
    );
};

export default observer(Catalog);
