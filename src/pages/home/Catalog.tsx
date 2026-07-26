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
    DOSAGE_ALL,
    CatalogItem,
    CatalogResponse,
    CategoryInfo,
    DosageInfo,
    PAGE_SIZE,
    VendorInfo,
    deriveVendorFacetCounts,
    readCache,
    sortDosages,
    useDebounced,
    writeCache,
} from "./catalog/utils";

const Catalog: React.FC = () => {
    const client = useClient();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [dosages, setDosages] = useState<DosageInfo[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [vendorList, setVendorList] = useState<VendorInfo[]>([]);
    const [vendors, setVendors] = useState<Map<string, VendorInfo>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [queryInput, setQueryInput] = useState("");
    const [selectedDosage, setSelectedDosage] = useState(DOSAGE_ALL);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
    const [verified, setVerified] = useState(false);
    const [minRating, setMinRating] = useState(0);
    const [warehouses, setWarehouses] = useState<string[]>([]);
    const [payment, setPayment] = useState<string[]>([]);
    const [freeShipping, setFreeShipping] = useState(false);
    const [guarantees, setGuarantees] = useState<string[]>([]);
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

        facet<DosageInfo[]>("/catalog/dosages", "catalog_dosages", (data) =>
            setDosages(sortDosages(data)),
        );
        facet<CategoryInfo[]>(
            "/catalog/categories",
            "catalog_categories",
            (data) => setCategories(data),
        );
        facet<VendorInfo[]>("/catalog/vendors", "catalog_vendors", (data) => {
            setVendorList(data);
            setVendors(new Map(data.map((v) => [v.serverId, v])));
        });
    }, []);

    // Vendor-attribute facet counts, derived from the enriched vendor list.
    const facetCounts = useMemo(
        () => deriveVendorFacetCounts(vendorList),
        [vendorList],
    );

    // Comma-joined multi-value filters (stable string keys for effect deps).
    const categoriesKey = selectedCategories.join(",");
    const vendorsKey = selectedVendors.join(",");
    const warehousesKey = warehouses.join(",");
    const paymentKey = payment.join(",");
    const guaranteesKey = guarantees.join(",");

    // Reset to the first page whenever a filter changes.
    useEffect(() => {
        setPage(1);
    }, [
        query,
        selectedDosage,
        minPrice,
        maxPrice,
        sort,
        categoriesKey,
        vendorsKey,
        verified,
        minRating,
        warehousesKey,
        paymentKey,
        freeShipping,
        guaranteesKey,
    ]);

    // Fetch a page of products.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);

        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (selectedDosage !== DOSAGE_ALL) params.set("dosage", selectedDosage);
        if (categoriesKey) params.set("category", categoriesKey);
        if (vendorsKey) params.set("serverId", vendorsKey);
        if (verified) params.set("verified", "true");
        if (minRating) params.set("minRating", String(minRating));
        if (warehousesKey) params.set("warehouse", warehousesKey);
        if (paymentKey) params.set("payment", paymentKey);
        if (freeShipping) params.set("freeShipping", "true");
        if (guaranteesKey) params.set("guarantee", guaranteesKey);
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
    }, [
        query,
        selectedDosage,
        minPrice,
        maxPrice,
        sort,
        page,
        retryCount,
        categoriesKey,
        vendorsKey,
        verified,
        minRating,
        warehousesKey,
        paymentKey,
        freeShipping,
        guaranteesKey,
    ]);

    const hasFilters =
        query.trim() !== "" ||
        selectedDosage !== DOSAGE_ALL ||
        selectedCategories.length > 0 ||
        selectedVendors.length > 0 ||
        verified ||
        minRating > 0 ||
        warehouses.length > 0 ||
        payment.length > 0 ||
        freeShipping ||
        guarantees.length > 0 ||
        minPrice !== "" ||
        maxPrice !== "";

    const clearFilters = () => {
        setQueryInput("");
        setSelectedDosage(DOSAGE_ALL);
        setSelectedCategories([]);
        setSelectedVendors([]);
        setVerified(false);
        setMinRating(0);
        setWarehouses([]);
        setPayment([]);
        setFreeShipping(false);
        setGuarantees([]);
        setMinInput("");
        setMaxInput("");
    };

    const filterProps = {
        dosages,
        selected: selectedDosage,
        onSelect: setSelectedDosage,
        categories,
        selectedCategories,
        onToggleCategory: (c: string) =>
            setSelectedCategories((prev) =>
                prev.includes(c)
                    ? prev.filter((x) => x !== c)
                    : [...prev, c],
            ),
        vendors: vendorList,
        selectedVendors,
        onToggleVendor: (id: string) =>
            setSelectedVendors((prev) =>
                prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
            ),
        facetCounts,
        verified,
        onVerified: setVerified,
        minRating,
        onMinRating: setMinRating,
        warehouses,
        onToggleWarehouse: (k: string) =>
            setWarehouses((prev) =>
                prev.includes(k)
                    ? prev.filter((x) => x !== k)
                    : [...prev, k],
            ),
        payment,
        onTogglePayment: (k: string) =>
            setPayment((prev) =>
                prev.includes(k)
                    ? prev.filter((x) => x !== k)
                    : [...prev, k],
            ),
        freeShipping,
        onFreeShipping: setFreeShipping,
        guarantees,
        onToggleGuarantee: (k: string) =>
            setGuarantees((prev) =>
                prev.includes(k)
                    ? prev.filter((x) => x !== k)
                    : [...prev, k],
            ),
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
                            {selectedDosage !== DOSAGE_ALL &&
                                ` at ${selectedDosage}`}
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
