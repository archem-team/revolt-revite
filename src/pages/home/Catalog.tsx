import { Search, X } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";

import { useEffect, useMemo, useState } from "preact/hooks";

import { InputBox } from "@revoltchat/ui";

import { useClient } from "../../controllers/client/ClientController";
import { BACKEND_API_BASE } from "../directory/types";
import {
    ErrorState,
    NoDataState,
    NoMatchState,
    SkeletonCards,
} from "./catalog/EmptyStates";
import { CatalogSidebar, MobileFilters } from "./catalog/Filters";
import { ProductCard } from "./catalog/ProductCard";
import { ProductModal } from "./catalog/ProductModal";
import {
    Wrapper,
    Toolbar,
    SearchWrapper,
    SortSelect,
    Body,
    Grid,
    ResultMeta,
    Pagination,
} from "./catalog/layout";
import {
    COMPOUND_ALL,
    CatalogItem,
    CatalogResponse,
    CompoundInfo,
    PAGE_SIZE,
    VendorInfo,
    readCache,
    useDebounced,
    writeCache,
} from "./catalog/utils";

const Catalog: React.FC = () => {
    const client = useClient();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [compounds, setCompounds] = useState<CompoundInfo[]>([]);
    const [vendors, setVendors] = useState<Map<string, VendorInfo>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [queryInput, setQueryInput] = useState("");
    const [selectedCompound, setSelectedCompound] = useState(COMPOUND_ALL);
    const [minInput, setMinInput] = useState("");
    const [maxInput, setMaxInput] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [openId, setOpenId] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // Debounce free-typed filters so we don't refetch per keystroke.
    const query = useDebounced(queryInput, 300);
    const minPrice = useDebounced(minInput, 500);
    const maxPrice = useDebounced(maxInput, 500);

    const autumn =
        client.configuration?.features.autumn?.url ||
        "https://peptide.chat/autumn";

    const sessionToken =
        typeof client.session === "string"
            ? client.session
            : (client.session as any)?.token ?? "";
    const headers = useMemo(
        () => ({ "x-session-token": sessionToken }),
        [sessionToken],
    );

    // Facets: cached copy first, revalidate in the background.
    useEffect(() => {
        const facet = <T,>(
            path: string,
            cacheKey: string,
            apply: (data: T) => void,
        ) => {
            const cached = readCache<T>(cacheKey);
            if (cached) apply(cached.data);
            if (cached?.fresh) return;
            fetch(`${BACKEND_API_BASE}${path}`, { headers })
                .then((r) => r.json())
                .then((res) => {
                    if (res?.success && Array.isArray(res.data)) {
                        apply(res.data);
                        writeCache(cacheKey, res.data);
                    }
                })
                .catch(() => {
                    /* facet fetch is best-effort — keep cached copy */
                });
        };

        facet<CompoundInfo[]>(
            "/catalog/compounds",
            "catalog_compounds",
            setCompounds,
        );
        facet<VendorInfo[]>("/catalog/vendors", "catalog_vendors", (data) =>
            setVendors(new Map(data.map((v) => [v.serverId, v]))),
        );
    }, []);

    // Reset to the first page whenever a filter changes.
    useEffect(() => {
        setPage(1);
    }, [query, selectedCompound, minPrice, maxPrice, sort]);

    // Fetch a page of products.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);

        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (selectedCompound !== COMPOUND_ALL)
            params.set("compound", selectedCompound);
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        params.set("sort", sort);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));

        fetch(`${BACKEND_API_BASE}/catalog?${params}`, { headers })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((res: CatalogResponse) => {
                if (cancelled) return;
                if (!res?.success || !Array.isArray(res.data?.items)) {
                    throw new Error("Unexpected response");
                }
                setItems(res.data.items);
                setTotalPages(res.data.pagination.totalPages);
                setTotal(res.data.pagination.total);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [query, selectedCompound, minPrice, maxPrice, sort, page, retryCount]);

    const hasFilters =
        query.trim() !== "" ||
        selectedCompound !== COMPOUND_ALL ||
        minPrice !== "" ||
        maxPrice !== "";

    const clearFilters = () => {
        setQueryInput("");
        setSelectedCompound(COMPOUND_ALL);
        setMinInput("");
        setMaxInput("");
    };

    const filterProps = {
        compounds,
        selected: selectedCompound,
        onSelect: setSelectedCompound,
        minPrice: minInput,
        maxPrice: maxInput,
        onMinPrice: setMinInput,
        onMaxPrice: setMaxInput,
    };

    return (
        <Wrapper>
            <Toolbar>
                <SearchWrapper>
                    <Search size={18} className="search-icon" />
                    <InputBox
                        palette="secondary"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.currentTarget.value)}
                        placeholder="Search compounds and products…"
                    />
                    {queryInput && (
                        <div
                            className="clear"
                            onClick={() => setQueryInput("")}>
                            <X size={18} />
                        </div>
                    )}
                </SearchWrapper>
                <SortSelect
                    value={sort}
                    onChange={(e) => setSort(e.currentTarget.value)}>
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                </SortSelect>
            </Toolbar>

            <MobileFilters {...filterProps} />

            <Body>
                <CatalogSidebar {...filterProps} />

                <div>
                    {!loading && !error && items.length > 0 && (
                        <ResultMeta>
                            {total.toLocaleString()}{" "}
                            {total === 1 ? "product" : "products"}
                            {selectedCompound !== COMPOUND_ALL &&
                                ` for ${selectedCompound}`}
                        </ResultMeta>
                    )}

                    {loading ? (
                        <Grid>
                            <SkeletonCards />
                        </Grid>
                    ) : error ? (
                        <ErrorState
                            onRetry={() => setRetryCount((c) => c + 1)}
                        />
                    ) : items.length === 0 ? (
                        hasFilters ? (
                            <NoMatchState onClear={clearFilters} />
                        ) : (
                            <NoDataState />
                        )
                    ) : (
                        <>
                            <Grid>
                                {items.map((item) => (
                                    <ProductCard
                                        key={item.id}
                                        item={item}
                                        vendor={
                                            item.serverId
                                                ? vendors.get(item.serverId)
                                                : undefined
                                        }
                                        autumn={autumn}
                                        onOpen={setOpenId}
                                    />
                                ))}
                            </Grid>

                            {totalPages > 1 && (
                                <Pagination>
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}>
                                        Previous
                                    </button>
                                    <span>
                                        Page {page} of {totalPages}
                                    </span>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}>
                                        Next
                                    </button>
                                </Pagination>
                            )}
                        </>
                    )}
                </div>
            </Body>

            {openId && (
                <ProductModal
                    productId={openId}
                    vendors={vendors}
                    headers={headers}
                    onClose={() => setOpenId(null)}
                />
            )}
        </Wrapper>
    );
};

export default observer(Catalog);
