import styles from "./MarketplaceLogin.module.scss";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { API_URL as BACKEND_API_BASE } from "../../lib/apiUrl";
import { requestCompoundBayRedirect } from "../../lib/compoundBaySso";
import {
    compoundBottleDataUrl,
    compoundBottleLabel,
} from "../../lib/compoundBottle";
import {
    createMarketplaceCheckout,
    createMarketplacePayment,
    createMarketplaceQuote,
    createMarketplaceShippingQuote,
    exchangeMarketplaceIdentity,
    getMarketplacePaymentStatus,
    getMarketplaceProduct,
    isMarketplaceQuoteChangedError,
    MarketplaceAddress,
    MarketplacePayment,
    MarketplaceShippingQuote,
    MarketplaceProduct,
    MarketplaceProductDetail,
    MarketplaceSearchResponse,
    MarketplaceSort,
    searchMarketplace,
} from "../../lib/marketplace";
import { normalizeMarketplaceCart } from "../../lib/marketplaceCart";
import { normalizeCountryCode } from "../../lib/marketplaceFilters";
import { formatExactAmount } from "../../lib/paymentAmount";

const PAGE_SIZE = 24;
const CART_STORAGE_KEY = "compound-bay-marketplace-cart-v1";
const QUOTE_STORAGE_KEY = "compound-bay-marketplace-quote-v1";
const QUOTE_CART_STORAGE_KEY = "compound-bay-marketplace-quote-cart-v1";
const BUYER_STORAGE_KEY = "compound-bay-marketplace-buyer-v1";
const PAYMENT_STORAGE_KEY = "compound-bay-marketplace-payment-v1";
const PRODUCT_RETURN_STORAGE_KEY = "compound-bay-marketplace-product-return-v1";
const PRODUCT_HISTORY_STATE_KEY = "compoundBayMarketplaceProduct";
const SEARCH_EXAMPLES = [
    "Try Reta 15",
    "Try Reta 15 in Australia",
    "Try cheapest BPC-157 with COA",
    "Try fastest Tirzepatide delivered to the UK",
];
const SEARCH_EXAMPLE_INTERVAL_MS = 3_500;
const MAX_AUTOCOMPLETE_SUGGESTIONS = 5;

type CartLine = MarketplaceProduct & {
    quantity: number;
    sellerName: string;
};

function marketplaceProductImageUrl(
    imageUrl: string | null | undefined,
    vendorCode: string,
) {
    if (!imageUrl) return null;

    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

    const storefront = vendorCode.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(storefront)) return null;

    const relativePath = imageUrl.replace(/^\/+/, "");
    const assetPath = relativePath.startsWith("assets/")
        ? relativePath
        : `assets/${relativePath}`;

    return new URL(
        assetPath,
        `https://${storefront}.peptide.chat/`,
    ).toString();
}

function ProductVisual({
    imageUrl,
    productName,
    mass,
    vendorCode,
    vendorName,
    loading,
}: {
    imageUrl?: string | null;
    productName: string;
    mass?: string | null;
    vendorCode: string;
    vendorName: string;
    loading?: "eager" | "lazy";
}) {
    const [failed, setFailed] = useState(false);
    const resolvedImageUrl = marketplaceProductImageUrl(imageUrl, vendorCode);

    useEffect(() => setFailed(false), [resolvedImageUrl]);

    return resolvedImageUrl && !failed ? (
        <>
            <img
                className={styles.productPhotoBackdrop}
                src={resolvedImageUrl}
                alt=""
                aria-hidden="true"
                loading={loading}
                width="640"
                height="480"
            />
            <img
                className={styles.productPhoto}
                src={resolvedImageUrl}
                alt=""
                loading={loading}
                width="640"
                height="480"
                onError={() => setFailed(true)}
            />
        </>
    ) : (
        <img
            src={compoundBottleDataUrl({
                name: productName,
                mass,
                vendorName,
            })}
            alt={compoundBottleLabel(productName, mass)}
            loading={loading}
            width="520"
            height="420"
            data-generated-product-image="true"
        />
    );
}

function cartSignature(lines: CartLine[]) {
    return JSON.stringify(
        lines.map(({ vendorCode, id, quantity }) => ({
            vendorCode,
            id,
            quantity,
        })),
    );
}

function money(value: number, currency: string) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
    }).format(value / 100);
}

function paymentTimeRemaining(expiresAt: string, now: number) {
    const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
        expired: remaining === 0,
        label: [hours, minutes, seconds]
            .map((part) => String(part).padStart(2, "0"))
            .join(":"),
    };
}

function productSummary(value: string) {
    return value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function regularPriceWithTax(product: MarketplaceProduct) {
    return product.regularPriceWithTax ?? product.priceWithTax;
}

function PriceDisplay({
    product,
    quantity = 1,
}: {
    product: MarketplaceProduct;
    quantity?: number;
}) {
    const regular = regularPriceWithTax(product) * quantity;
    const effective = product.priceWithTax * quantity;
    const discount = Math.round(product.promotion?.discountPercentage ?? 0);
    const promoted = Boolean(product.promotion && regular > effective);
    const accessible = promoted
        ? `Sale price ${money(effective, product.currencyCode)}, regular price ${money(
              regular,
              product.currencyCode,
          )}, ${discount}% off`
        : money(effective, product.currencyCode);
    return (
        <span className={styles.priceDisplay} aria-label={accessible}>
            <strong>{money(effective, product.currencyCode)}</strong>
            {promoted ? (
                <>
                    <s aria-hidden="true">
                        {money(regular, product.currencyCode)}
                    </s>
                    <span className={styles.discountBadge} aria-hidden="true">
                        {discount}% off
                    </span>
                </>
            ) : null}
        </span>
    );
}

function priceToMinorUnits(value: string) {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.round(parsed * 100)
        : undefined;
}

function getPriceFilterError(
    minPrice: string,
    maxPrice: string,
    minPriceMinor?: number,
    maxPriceMinor?: number,
) {
    if (minPrice && minPriceMinor === undefined)
        return "Enter a valid minimum price.";
    if (maxPrice && maxPriceMinor === undefined)
        return "Enter a valid maximum price.";
    if (
        minPriceMinor !== undefined &&
        maxPriceMinor !== undefined &&
        minPriceMinor > maxPriceMinor
    ) {
        return "Minimum price cannot exceed maximum price.";
    }
    return "";
}

function readCart() {
    try {
        const saved = window.localStorage.getItem(CART_STORAGE_KEY);
        if (!saved) return [];
        return normalizeMarketplaceCart(JSON.parse(saved)) as CartLine[];
    } catch {
        return [];
    }
}

function readProductReturn() {
    try {
        const saved = window.sessionStorage.getItem(PRODUCT_RETURN_STORAGE_KEY);
        window.sessionStorage.removeItem(PRODUCT_RETURN_STORAGE_KEY);
        if (!saved) return null;
        const product = JSON.parse(saved) as Partial<MarketplaceProduct>;
        return typeof product.id === "string" &&
            typeof product.productId === "string" &&
            typeof product.vendorCode === "string"
            ? (product as MarketplaceProduct)
            : null;
    } catch {
        window.sessionStorage.removeItem(PRODUCT_RETURN_STORAGE_KEY);
        return null;
    }
}

function marketplaceProductPath(product: MarketplaceProduct) {
    return `/products/${encodeURIComponent(
        product.vendorCode,
    )}/${encodeURIComponent(product.productId)}/${encodeURIComponent(
        product.slug || "product",
    )}`;
}

function readMarketplaceProductPath() {
    const match = window.location.pathname.match(
        /^\/products\/([^/]+)\/([^/]+)(?:\/[^/]+)?\/?$/,
    );
    if (!match) return null;
    try {
        return {
            vendorCode: decodeURIComponent(match[1]),
            productId: decodeURIComponent(match[2]),
        };
    } catch {
        return null;
    }
}

export default function MarketplaceLogin({
    pepchatSession,
    requestPepchatSignIn,
    rejectPepchatSession,
    signOutPepchat,
    locale,
    legal,
    logoSrc,
}: {
    pepchatSession?: unknown;
    requestPepchatSignIn: (notice?: string) => Promise<unknown | undefined>;
    rejectPepchatSession: (notice: string) => Promise<unknown | undefined>;
    signOutPepchat: () => Promise<void>;
    locale: ComponentChildren;
    legal: ComponentChildren;
    logoSrc: string;
}) {
    const loggedIn = Boolean(pepchatSession);
    const [query, setQuery] = useState("");
    const [searchRevision, setSearchRevision] = useState(0);
    const [searchFocused, setSearchFocused] = useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [searchExampleIndex, setSearchExampleIndex] = useState(0);
    const [selectedVendor, setSelectedVendor] = useState("");
    const [sort, setSort] = useState<MarketplaceSort>("recommended");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [warehouse, setWarehouse] = useState("");
    const [shipsTo, setShipsTo] = useState("");
    const [hasLabReport, setHasLabReport] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [result, setResult] = useState<MarketplaceSearchResponse | null>(
        null,
    );
    const [pending, setPending] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [selectedProduct, setSelectedProduct] =
        useState<MarketplaceProduct | null>(readProductReturn);
    const [detail, setDetail] = useState<MarketplaceProductDetail | null>(null);
    const [detailPending, setDetailPending] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [checkoutNotice, setCheckoutNotice] = useState("");
    const [checkoutPending, setCheckoutPending] = useState(false);
    const [buyerToken, setBuyerToken] = useState("");
    const [shippingQuote, setShippingQuote] =
        useState<MarketplaceShippingQuote | null>(null);
    const [acceptLegal, setAcceptLegal] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [copiedPaymentField, setCopiedPaymentField] = useState<
        "amount" | "address" | ""
    >("");
    const [checkoutId, setCheckoutId] = useState("");
    const [orderCode, setOrderCode] = useState("");
    const [payment, setPayment] = useState<MarketplacePayment | null>(null);
    const [paymentClock, setPaymentClock] = useState(() => Date.now());
    const [address, setAddress] = useState<MarketplaceAddress>({
        fullName: "",
        streetLine1: "",
        streetLine2: "",
        city: "",
        province: "",
        postalCode: "",
        countryCode: "US",
        phoneNumber: "",
    });
    const productDialogRef = useRef<HTMLDialogElement>(null);
    const cartDialogRef = useRef<HTMLDialogElement>(null);
    const cartHydratedRef = useRef(false);
    const searchImmediatelyRef = useRef(false);
    const minPriceMinor = priceToMinorUnits(minPrice);
    const maxPriceMinor = priceToMinorUnits(maxPrice);
    const filterError = getPriceFilterError(
        minPrice,
        maxPrice,
        minPriceMinor,
        maxPriceMinor,
    );
    const activeFilterCount = [
        minPrice,
        maxPrice,
        warehouse,
        shipsTo,
        hasLabReport,
    ].filter(Boolean).length;
    const filtersChanged = sort !== "recommended" || activeFilterCount > 0;

    useEffect(() => {
        const storedCart = readCart();
        setCart(storedCart);
        const storedBuyerToken =
            window.sessionStorage.getItem(BUYER_STORAGE_KEY) ?? "";
        const quoteMatchesCart =
            window.sessionStorage.getItem(QUOTE_CART_STORAGE_KEY) ===
            cartSignature(storedCart);
        if (quoteMatchesCart) {
            if (storedBuyerToken) setBuyerToken(storedBuyerToken);
        } else {
            window.sessionStorage.removeItem(BUYER_STORAGE_KEY);
            window.sessionStorage.removeItem(QUOTE_STORAGE_KEY);
            window.sessionStorage.removeItem(QUOTE_CART_STORAGE_KEY);
        }
        try {
            const saved = JSON.parse(
                window.sessionStorage.getItem(PAYMENT_STORAGE_KEY) ?? "null",
            ) as {
                checkoutId?: string;
                orderCode?: string;
                payment?: MarketplacePayment;
            } | null;
            if (saved?.checkoutId && saved.payment) {
                setCheckoutId(saved.checkoutId);
                setOrderCode(saved.orderCode ?? "");
                setPayment(saved.payment);
            }
        } catch {
            window.sessionStorage.removeItem(PAYMENT_STORAGE_KEY);
        }
        cartHydratedRef.current = true;
    }, []);

    useEffect(() => {
        let controller: AbortController | undefined;
        const syncProductRoute = () => {
            const route = readMarketplaceProductPath();
            if (!route) {
                productDialogRef.current?.close();
                setSelectedProduct(null);
                setDetail(null);
                return;
            }
            controller?.abort();
            controller = new AbortController();
            void getMarketplaceProduct(
                route.vendorCode,
                route.productId,
                controller.signal,
            )
                .then((next) => {
                    const product = next.variants[0];
                    if (product) setSelectedProduct(product);
                })
                .catch((caught) => {
                    if (
                        caught instanceof DOMException &&
                        caught.name === "AbortError"
                    ) {
                        return;
                    }
                    setError("This shared product could not be loaded.");
                });
        };
        syncProductRoute();
        window.addEventListener("popstate", syncProductRoute);
        return () => {
            controller?.abort();
            window.removeEventListener("popstate", syncProductRoute);
        };
    }, []);

    useEffect(() => {
        const code = new URLSearchParams(window.location.search).get("code");
        const quoteToken = window.sessionStorage.getItem(QUOTE_STORAGE_KEY);
        if (!code || !quoteToken) return;
        const controller = new AbortController();
        setCheckoutPending(true);
        void exchangeMarketplaceIdentity(code, quoteToken, controller.signal)
            .then(({ buyerToken: token }) => {
                window.sessionStorage.setItem(BUYER_STORAGE_KEY, token);
                setBuyerToken(token);
                const clean = new URL(window.location.href);
                clean.searchParams.delete("code");
                window.history.replaceState(null, "", clean.toString());
                setCheckoutNotice(
                    "PepChat identity confirmed. Continue checkout below.",
                );
                setCartOpen(true);
            })
            .catch(() => {
                setCheckoutNotice(
                    "PepChat sign-in expired. Please try checkout again.",
                );
                window.sessionStorage.removeItem(QUOTE_STORAGE_KEY);
                window.sessionStorage.removeItem(QUOTE_CART_STORAGE_KEY);
            })
            .finally(() => setCheckoutPending(false));
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (query || searchFocused) return;
        const interval = window.setInterval(
            () =>
                setSearchExampleIndex(
                    (index) => (index + 1) % SEARCH_EXAMPLES.length,
                ),
            SEARCH_EXAMPLE_INTERVAL_MS,
        );
        return () => window.clearInterval(interval);
    }, [query, searchFocused]);

    useEffect(() => {
        if (!cartHydratedRef.current) return;
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        if (!payment) return;
        setPaymentClock(Date.now());
        const interval = window.setInterval(
            () => setPaymentClock(Date.now()),
            1000,
        );
        return () => window.clearInterval(interval);
    }, [payment?.id]);

    useEffect(() => {
        if (filterError) {
            setPending(false);
            return;
        }
        const controller = new AbortController();
        const delay = searchImmediatelyRef.current ? 0 : query ? 250 : 0;
        searchImmediatelyRef.current = false;
        const timeout = window.setTimeout(() => {
            setPending(true);
            setError("");
            void searchMarketplace(
                {
                    query: query.trim(),
                    vendor: selectedVendor,
                    limit: PAGE_SIZE,
                    sort,
                    minPrice: minPriceMinor,
                    maxPrice: maxPriceMinor,
                    warehouse,
                    shipsTo,
                    hasLabReport,
                },
                controller.signal,
            )
                .then(setResult)
                .catch((caught) => {
                    if (
                        caught instanceof DOMException &&
                        caught.name === "AbortError"
                    ) {
                        return;
                    }
                    setError("The marketplace is temporarily unavailable.");
                })
                .finally(() => {
                    if (!controller.signal.aborted) setPending(false);
                });
        }, delay);
        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [
        query,
        selectedVendor,
        sort,
        minPriceMinor,
        maxPriceMinor,
        warehouse,
        shipsTo,
        hasLabReport,
        filterError,
        searchRevision,
    ]);

    useEffect(() => {
        if (!selectedProduct) return;
        const controller = new AbortController();
        const dialog = productDialogRef.current;
        const handleCancel = (event: Event) => {
            event.preventDefault();
            closeProduct();
        };
        dialog?.addEventListener("cancel", handleCancel);
        setDetail(null);
        setDetailError("");
        setDetailPending(true);
        setSelectedVariantId(selectedProduct.id);
        setQuantity(1);
        dialog?.showModal();
        void getMarketplaceProduct(
            selectedProduct.vendorCode,
            selectedProduct.productId,
            controller.signal,
        )
            .then((next) => {
                setDetail(next);
                if (
                    !next.variants.some(
                        (item) => item.id === selectedProduct.id,
                    )
                ) {
                    setSelectedVariantId(next.variants[0]?.id ?? "");
                }
            })
            .catch((caught) => {
                if (
                    caught instanceof DOMException &&
                    caught.name === "AbortError"
                ) {
                    return;
                }
                setDetailError(
                    "Package options could not be refreshed. You can still add the displayed package.",
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) setDetailPending(false);
            });
        return () => {
            controller.abort();
            dialog?.removeEventListener("cancel", handleCancel);
        };
    }, [selectedProduct]);

    useEffect(() => {
        const restoreProduct = () => {
            const product = readProductReturn();
            if (product) setSelectedProduct(product);
        };
        window.addEventListener("pageshow", restoreProduct);
        return () => window.removeEventListener("pageshow", restoreProduct);
    }, []);

    useEffect(() => {
        const dialog = cartDialogRef.current;
        const handleCancel = (event: Event) => {
            event.preventDefault();
            setCartOpen(false);
        };
        const handleClose = () => setCartOpen(false);
        dialog?.addEventListener("cancel", handleCancel);
        dialog?.addEventListener("close", handleClose);
        if (cartOpen && dialog && !dialog.open) dialog.showModal();
        if (!cartOpen && dialog?.open) dialog.close();
        return () => {
            dialog?.removeEventListener("cancel", handleCancel);
            dialog?.removeEventListener("close", handleClose);
        };
    }, [cartOpen]);

    const vendorName = useMemo(
        () =>
            new Map(
                result?.vendors.map((vendor) => [vendor.code, vendor.name]),
            ),
        [result?.vendors],
    );
    const autocompleteSuggestions = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) return [];

        return [...new Set(result?.autocomplete ?? [])]
            .filter((suggestion) => {
                const normalizedSuggestion = suggestion.toLocaleLowerCase();
                return (
                    normalizedSuggestion !== normalizedQuery &&
                    normalizedSuggestion.includes(normalizedQuery)
                );
            })
            .slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS);
    }, [query, result?.autocomplete]);
    const autocompleteVisible =
        suggestionsOpen && autocompleteSuggestions.length > 0;

    useEffect(() => {
        setActiveSuggestionIndex(-1);
    }, [query, result?.autocomplete]);

    const listedProducts = useMemo(() => {
        const products = new Map<string, MarketplaceProduct>();
        for (const product of result?.products ?? []) {
            const key = `${product.vendorCode}:${product.productId}`;
            const current = products.get(key);
            const preferProduct =
                !current ||
                (sort === "price-desc"
                    ? product.priceWithTax > current.priceWithTax
                    : sort === "delivery-asc"
                    ? (product.deliveryMinDays ?? Number.POSITIVE_INFINITY) <
                          (current.deliveryMinDays ??
                              Number.POSITIVE_INFINITY) ||
                      ((product.deliveryMinDays ?? Number.POSITIVE_INFINITY) ===
                          (current.deliveryMinDays ??
                              Number.POSITIVE_INFINITY) &&
                          (product.deliveryMaxDays ??
                              Number.POSITIVE_INFINITY) <
                              (current.deliveryMaxDays ??
                                  Number.POSITIVE_INFINITY))
                    : product.priceWithTax < current.priceWithTax);
            if (preferProduct) {
                products.set(key, product);
            }
        }
        return [...products.values()];
    }, [result?.products, sort]);
    const displayedProducts = listedProducts.length
        ? listedProducts
        : result?.alternativeProducts ?? [];
    const interpretation = pending ? undefined : result?.interpretedQuery;
    const interpretationChips = interpretation
        ? [
              interpretation.compound,
              interpretation.strength
                  ? `${interpretation.strength.value} ${interpretation.strength.unit}`
                  : null,
              interpretation.package
                  ? `${interpretation.package.value} ${
                        interpretation.package.unit
                    }${interpretation.package.value === 1 ? "" : "s"}`
                  : null,
              interpretation.destination
                  ? `Deliver to ${interpretation.destination}`
                  : null,
              interpretation.warehouse
                  ? `Ships from ${interpretation.warehouse}`
                  : null,
              interpretation.vendor ? `Seller ${interpretation.vendor}` : null,
              interpretation.hasLabReport ? "COA available" : null,
              interpretation.maxPrice != null
                  ? `Up to ${money(interpretation.maxPrice, "USD")}`
                  : null,
              interpretation.minPrice != null
                  ? `From ${money(interpretation.minPrice, "USD")}`
                  : null,
              interpretation.deliveryMaxDays != null
                  ? `Delivery within ${interpretation.deliveryMaxDays} days`
                  : null,
              interpretation.sort === "price-asc"
                  ? "Cheapest first"
                  : interpretation.sort === "delivery-asc"
                  ? "Fastest first"
                  : null,
          ].filter((value): value is string => Boolean(value))
        : [];

    const detailVariants = detail?.variants.length
        ? detail.variants
        : selectedProduct
        ? [selectedProduct]
        : [];
    const selectedVariant =
        detailVariants.find((item) => item.id === selectedVariantId) ??
        detailVariants[0];
    const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
    const cartSubtotal = cart.reduce(
        (sum, line) => sum + line.priceWithTax * line.quantity,
        0,
    );
    const cartRegularSubtotal = cart.reduce(
        (sum, line) => sum + regularPriceWithTax(line) * line.quantity,
        0,
    );
    const cartCurrency = cart[0]?.currencyCode ?? "USD";
    const paymentCountdown = payment
        ? paymentTimeRemaining(payment.expiresAt, paymentClock)
        : null;

    async function loadMore() {
        if (!result?.pagination.hasMore || loadingMore) return;
        setLoadingMore(true);
        setError("");
        try {
            const next = await searchMarketplace({
                query: query.trim(),
                vendor: selectedVendor,
                offset: result.pagination.offset + result.pagination.limit,
                limit: PAGE_SIZE,
                sort,
                minPrice: minPriceMinor,
                maxPrice: maxPriceMinor,
                warehouse,
                shipsTo,
                hasLabReport,
            });
            setResult({
                ...next,
                products: [...result.products, ...next.products],
            });
        } catch {
            setError("More products could not be loaded. Try again.");
        } finally {
            setLoadingMore(false);
        }
    }

    function resetFilters() {
        setSort("recommended");
        setMinPrice("");
        setMaxPrice("");
        setWarehouse("");
        setShipsTo("");
        setHasLabReport(false);
    }

    function closeProduct() {
        productDialogRef.current?.close();
        setSelectedProduct(null);
        setDetail(null);
        if (!readMarketplaceProductPath()) return;
        if (
            window.history.state?.[PRODUCT_HISTORY_STATE_KEY] === true &&
            window.history.length > 1
        ) {
            window.history.back();
        } else {
            window.history.replaceState(null, "", "/");
        }
    }

    function openProduct(product: MarketplaceProduct) {
        const path = marketplaceProductPath(product);
        if (window.location.pathname !== path) {
            window.history.pushState(
                { [PRODUCT_HISTORY_STATE_KEY]: true },
                "",
                path,
            );
        }
        setSelectedProduct(product);
    }

    function followProductLink(event: MouseEvent, product: MarketplaceProduct) {
        if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }
        event.preventDefault();
        openProduct(product);
    }

    function invalidateCheckoutForCartChange() {
        window.sessionStorage.removeItem(QUOTE_STORAGE_KEY);
        window.sessionStorage.removeItem(QUOTE_CART_STORAGE_KEY);
        window.sessionStorage.removeItem(BUYER_STORAGE_KEY);
        setBuyerToken("");
        setShippingQuote(null);
        setAcceptLegal(false);
        setReviewOpen(false);
        setCheckoutNotice("");
    }

    async function refreshCartAfterPriceChange() {
        invalidateCheckoutForCartChange();
        setCartOpen(true);
        let details: MarketplaceProductDetail[];
        try {
            details = await Promise.all(
                [...new Map(cart.map((line) => [
                    `${line.vendorCode}:${line.productId}`,
                    line,
                ])).values()].map((line) =>
                    getMarketplaceProduct(line.vendorCode, line.productId),
                ),
            );
        } catch {
            setCheckoutNotice(
                "Price changed—refresh the marketplace and review your cart before continuing.",
            );
            return;
        }
        const current = new Map(
            details.flatMap((detail) =>
                detail.variants.map((variant) => [
                    `${variant.vendorCode}:${variant.id}`,
                    variant,
                ] as const),
            ),
        );
        setCart((lines) =>
            lines.flatMap((line) => {
                const product = current.get(`${line.vendorCode}:${line.id}`);
                return product
                    ? [{ ...line, ...product, quantity: line.quantity }]
                    : [];
            }),
        );
        setCheckoutNotice("Price changed—review your cart before continuing.");
    }

    function addProductToCart(
        product: MarketplaceProduct,
        productQuantity = 1,
        openCart = false,
        resolvedSellerName?: string,
    ) {
        invalidateCheckoutForCartChange();
        const sellerName =
            resolvedSellerName ??
            vendorName.get(product.vendorCode) ??
            product.vendorCode;
        setCart((lines) => {
            const existing = lines.findIndex(
                (line) =>
                    line.id === product.id &&
                    line.vendorCode === product.vendorCode,
            );
            if (existing === -1) {
                return [
                    ...lines,
                    {
                        ...product,
                        quantity: Math.min(99, productQuantity),
                        sellerName,
                    },
                ];
            }
            return lines.map((line, index) =>
                index === existing
                    ? {
                          ...line,
                          quantity: Math.min(
                              99,
                              line.quantity + productQuantity,
                          ),
                      }
                    : line,
            );
        });
        if (openCart) setCartOpen(true);
    }

    function addToCart(openCart = false) {
        if (!selectedVariant) return;
        addProductToCart(
            selectedVariant,
            quantity,
            openCart,
            detail?.vendor.name,
        );
        closeProduct();
    }

    function updateCartLine(index: number, nextQuantity: number) {
        invalidateCheckoutForCartChange();
        if (nextQuantity < 1) {
            setCart((lines) =>
                lines.filter((_, lineIndex) => lineIndex !== index),
            );
            return;
        }
        setCart((lines) =>
            lines.map((line, lineIndex) =>
                lineIndex === index
                    ? { ...line, quantity: Math.min(99, nextQuantity) }
                    : line,
            ),
        );
    }

    async function beginCheckout() {
        if (checkoutPending || !cart.length) return;
        if (buyerToken) {
            setCheckoutNotice(
                "PepChat identity confirmed. Delivery details are next.",
            );
            return;
        }
        setCheckoutPending(true);
        setCheckoutNotice("Securing current prices…");
        try {
            const quote = await createMarketplaceQuote(
                cart.map((line) => ({
                    vendorCode: line.vendorCode,
                    productId: line.productId,
                    variantId: line.id,
                    quantity: line.quantity,
                })),
            );
            window.sessionStorage.setItem(QUOTE_STORAGE_KEY, quote.quoteToken);
            window.sessionStorage.setItem(
                QUOTE_CART_STORAGE_KEY,
                cartSignature(cart),
            );
            const returnUrl = `${window.location.origin}${window.location.pathname}`;
            let activeSession = pepchatSession;
            if (!activeSession) {
                setCheckoutNotice("Sign in to continue checkout.");
                activeSession = await requestPepchatSignIn(
                    "Your cart is ready. Sign in to continue checkout.",
                );
            }
            if (!activeSession) {
                setCheckoutNotice(
                    "Your cart is saved. Sign in when you are ready to continue.",
                );
                return;
            }

            const exchangeIdentity = async (session: unknown) => {
                const redirect = await requestCompoundBayRedirect({
                    apiBase: BACKEND_API_BASE,
                    session,
                    returnUrl,
                });
                const code = new URL(redirect).searchParams.get("code");
                if (!code)
                    throw new Error(
                        "PepChat returned an invalid marketplace identity.",
                    );
                return exchangeMarketplaceIdentity(code, quote.quoteToken);
            };

            let identity;
            try {
                identity = await exchangeIdentity(activeSession);
            } catch (caught) {
                if (
                    !(caught instanceof Error) ||
                    (caught as Error & { code?: string }).code !==
                        "SESSION_REJECTED"
                ) {
                    throw caught;
                }
                const replacement = await rejectPepchatSession(
                    "Your PepChat session expired. Sign in again to continue checkout.",
                );
                if (!replacement) {
                    setCheckoutNotice(
                        "Your cart is saved. Sign in again to continue checkout.",
                    );
                    return;
                }
                identity = await exchangeIdentity(replacement);
            }

            window.sessionStorage.setItem(
                BUYER_STORAGE_KEY,
                identity.buyerToken,
            );
            setBuyerToken(identity.buyerToken);
            setCheckoutNotice(
                "PepChat identity confirmed. Delivery details are next.",
            );
        } catch (caught) {
            setCheckoutNotice(
                caught instanceof Error
                    ? caught.message
                    : "Checkout could not be started. Please try again.",
            );
        } finally {
            setCheckoutPending(false);
        }
    }

    async function signOut() {
        await signOutPepchat();
        window.sessionStorage.removeItem(BUYER_STORAGE_KEY);
        window.sessionStorage.removeItem(QUOTE_STORAGE_KEY);
        window.sessionStorage.removeItem(QUOTE_CART_STORAGE_KEY);
        setBuyerToken("");
        setShippingQuote(null);
        setAcceptLegal(false);
        setReviewOpen(false);
        setCheckoutNotice("Signed out. Your cart is still here.");
    }

    function updateAddress(field: keyof MarketplaceAddress, value: string) {
        setAddress((current) => ({
            ...current,
            [field]:
                field === "countryCode" ? normalizeCountryCode(value) : value,
        }));
        setShippingQuote(null);
        setAcceptLegal(false);
    }

    async function quoteShipping(event: Event) {
        event.preventDefault();
        const quoteToken = window.sessionStorage.getItem(QUOTE_STORAGE_KEY);
        if (!quoteToken) {
            setCheckoutNotice(
                "Your price quote expired. Start checkout again.",
            );
            setBuyerToken("");
            window.sessionStorage.removeItem(BUYER_STORAGE_KEY);
            window.sessionStorage.removeItem(QUOTE_CART_STORAGE_KEY);
            return;
        }
        setCheckoutPending(true);
        setCheckoutNotice("Checking every seller's shipping options…");
        try {
            const next = await createMarketplaceShippingQuote(
                quoteToken,
                address,
            );
            setShippingQuote(next);
            setCheckoutNotice("Shipping confirmed for every seller.");
        } catch (caught) {
            if (isMarketplaceQuoteChangedError(caught)) {
                await refreshCartAfterPriceChange();
                return;
            }
            setCheckoutNotice(
                "This address is incomplete or one seller cannot ship there. Check the details and try again.",
            );
        } finally {
            setCheckoutPending(false);
        }
    }

    async function placeOrder() {
        if (!shippingQuote || !acceptLegal || checkoutPending) return;
        setCheckoutPending(true);
        setCheckoutNotice("Creating your order…");
        try {
            const checkout = await createMarketplaceCheckout({
                buyerToken,
                shippingQuoteToken: shippingQuote.shippingQuoteToken,
                deliveryAddress: address,
                idempotencyKey: crypto.randomUUID(),
            });
            const next = await createMarketplacePayment(
                checkout.id,
                buyerToken,
            );
            window.sessionStorage.setItem(
                PAYMENT_STORAGE_KEY,
                JSON.stringify({
                    checkoutId: checkout.id,
                    orderCode: checkout.orderCode,
                    paymentId: next.payment.id,
                    accessToken: next.payment.accessToken,
                    payment: next.payment,
                }),
            );
            setCheckoutId(checkout.id);
            setOrderCode(checkout.orderCode);
            setPayment(next.payment);
            setReviewOpen(false);
            setCheckoutNotice(
                "Order created. Send the exact amount shown below.",
            );
        } catch (caught) {
            if (isMarketplaceQuoteChangedError(caught)) {
                await refreshCartAfterPriceChange();
                return;
            }
            setCheckoutNotice(
                `${
                    caught instanceof Error
                        ? caught.message
                        : "The order could not be created"
                }. No payment was requested; please try again.`,
            );
        } finally {
            setCheckoutPending(false);
        }
    }

    async function refreshPayment() {
        if (!payment || !checkoutId || checkoutPending) return;
        setCheckoutPending(true);
        try {
            const saved = JSON.parse(
                window.sessionStorage.getItem(PAYMENT_STORAGE_KEY) ?? "{}",
            ) as { accessToken?: string };
            if (!saved.accessToken)
                throw new Error("Missing payment recovery token");
            const next = await getMarketplacePaymentStatus(
                checkoutId,
                payment.id,
                saved.accessToken,
            );
            setPayment(next.payment);
            setCheckoutNotice(`Payment status: ${next.payment.status}.`);
            if (["settled", "completed"].includes(next.payment.status)) {
                setCart([]);
            }
        } catch {
            setCheckoutNotice(
                "Payment status could not be refreshed. Try again shortly.",
            );
        } finally {
            setCheckoutPending(false);
        }
    }

    async function copyPaymentValue(
        field: "amount" | "address",
        value: string,
    ) {
        await navigator.clipboard.writeText(value);
        setCopiedPaymentField(field);
        window.setTimeout(() => setCopiedPaymentField(""), 1800);
    }

    function selectAutocompleteSuggestion(suggestion: string) {
        setPending(true);
        setQuery(suggestion);
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
        searchImmediatelyRef.current = true;
        setSearchRevision((revision) => revision + 1);
    }

    return (
        <div className={styles.marketplace} data-marketplace-state="enabled">
            <header className={styles.header}>
                <a className={styles.wordmark} href="#marketplace-results">
                    <span className={styles.logoPlate}>
                        <img
                            className={styles.logoIcon}
                            src="/assets/logo.svg"
                            alt=""
                            width="17"
                            height="17"
                            draggable={false}
                        />
                        <img
                            className={styles.logoWordmark}
                            src={logoSrc}
                            alt="PepChat"
                            width="96"
                            height="20"
                            draggable={false}
                        />
                    </span>
                </a>
                <div className={styles.headerActions}>
                    <div className={styles.locale}>{locale}</div>
                    <button
                        className={styles.cartButton}
                        type="button"
                        onClick={() => setCartOpen(true)}
                        aria-label={`Cart, ${cartCount} items`}>
                        Cart <span>{cartCount}</span>
                    </button>
                    {cartCount ? (
                        <button
                            className={styles.headerCheckout}
                            type="button"
                            disabled={checkoutPending}
                            onClick={() => {
                                setCartOpen(true);
                                void beginCheckout();
                            }}>
                            {checkoutPending ? "Checking…" : "Checkout"}
                        </button>
                    ) : null}
                    <button
                        className={styles.signInButton}
                        type="button"
                        onClick={() =>
                            loggedIn
                                ? void signOut()
                                : void requestPepchatSignIn()
                        }>
                        {loggedIn ? "Sign out" : "Sign in"}
                    </button>
                </div>
            </header>

            <div className={styles.shell}>
                <main className={styles.catalogue}>
                    <section className={styles.intro}>
                        <div>
                            <p className={styles.kicker}>
                                Verified seller marketplace
                            </p>
                            <h1>Find the compound. Choose the seller.</h1>
                        </div>
                        <p>
                            Compare approved sellers and buy through one
                            marketplace checkout. Every order stays here.
                        </p>
                    </section>

                    <section
                        className={styles.searchArea}
                        aria-labelledby="marketplace-search-label">
                        <label
                            id="marketplace-search-label"
                            htmlFor="marketplace-search">
                            Search every catalogue
                        </label>
                        <form
                            className={styles.searchRow}
                            role="search"
                            aria-busy={pending}
                            onSubmit={(event) => {
                                event.preventDefault();
                                setPending(true);
                                searchImmediatelyRef.current = true;
                                setSearchRevision((revision) => revision + 1);
                            }}>
                            <div className={styles.searchControl}>
                                <input
                                    id="marketplace-search"
                                    type="search"
                                    value={query}
                                    placeholder={
                                        SEARCH_EXAMPLES[searchExampleIndex]
                                    }
                                    autoComplete="off"
                                    role="combobox"
                                    aria-autocomplete="list"
                                    aria-expanded={autocompleteVisible}
                                    aria-controls="marketplace-search-suggestions"
                                    aria-activedescendant={
                                        autocompleteVisible &&
                                        activeSuggestionIndex >= 0
                                            ? `marketplace-search-suggestion-${activeSuggestionIndex}`
                                            : undefined
                                    }
                                    aria-describedby="marketplace-search-status"
                                    onFocus={() => {
                                        setSearchFocused(true);
                                        setSuggestionsOpen(true);
                                    }}
                                    onBlur={() => {
                                        setSearchFocused(false);
                                        setSuggestionsOpen(false);
                                        setActiveSuggestionIndex(-1);
                                    }}
                                    onInput={(event) => {
                                        setPending(true);
                                        setSuggestionsOpen(true);
                                        setActiveSuggestionIndex(-1);
                                        setQuery(
                                            (
                                                event.currentTarget as HTMLInputElement
                                            ).value,
                                        );
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setSuggestionsOpen(false);
                                            setActiveSuggestionIndex(-1);
                                            return;
                                        }
                                        if (
                                            event.key === "ArrowDown" ||
                                            event.key === "ArrowUp"
                                        ) {
                                            if (!autocompleteSuggestions.length)
                                                return;
                                            event.preventDefault();
                                            setSuggestionsOpen(true);
                                            setActiveSuggestionIndex((index) =>
                                                event.key === "ArrowDown"
                                                    ? (index + 1) %
                                                      autocompleteSuggestions.length
                                                    : index <= 0
                                                    ? autocompleteSuggestions.length -
                                                      1
                                                    : index - 1,
                                            );
                                            return;
                                        }
                                        if (
                                            event.key === "Enter" &&
                                            autocompleteVisible &&
                                            activeSuggestionIndex >= 0
                                        ) {
                                            event.preventDefault();
                                            selectAutocompleteSuggestion(
                                                autocompleteSuggestions[
                                                    activeSuggestionIndex
                                                ],
                                            );
                                        }
                                    }}
                                />
                                {pending ? (
                                    <span
                                        className={styles.searchSpinner}
                                        aria-hidden="true"
                                    />
                                ) : null}
                                {autocompleteVisible ? (
                                    <ul
                                        className={styles.autocompleteList}
                                        id="marketplace-search-suggestions"
                                        role="listbox"
                                        aria-label="Search suggestions"
                                        aria-busy={pending}
                                        data-state={
                                            pending
                                                ? "loading"
                                                : error
                                                ? "error"
                                                : "success"
                                        }>
                                        {autocompleteSuggestions.map(
                                            (suggestion, index) => (
                                                <li
                                                    className={
                                                        styles.autocompleteOption
                                                    }
                                                    id={`marketplace-search-suggestion-${index}`}
                                                    key={suggestion}
                                                    role="option"
                                                    aria-selected={
                                                        index ===
                                                        activeSuggestionIndex
                                                    }
                                                    onMouseDown={(event) =>
                                                        event.preventDefault()
                                                    }
                                                    onClick={() =>
                                                        selectAutocompleteSuggestion(
                                                            suggestion,
                                                        )
                                                    }>
                                                    <span>{suggestion}</span>
                                                    <small>Search</small>
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                ) : null}
                            </div>
                            {query ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery("");
                                        setSuggestionsOpen(false);
                                        setActiveSuggestionIndex(-1);
                                    }}>
                                    Clear
                                </button>
                            ) : null}
                        </form>
                        <p
                            className={styles.searchStatus}
                            id="marketplace-search-status"
                            role="status"
                            aria-live="polite">
                            {pending
                                ? "Searching seller catalogues…"
                                : `${
                                      result?.pagination.totalItems ?? 0
                                  } available packages`}
                        </p>
                        {interpretationChips.length ? (
                            <div
                                className={styles.interpretation}
                                aria-label="Search interpreted as">
                                <span>Searching for</span>
                                {interpretationChips.map((chip) => (
                                    <strong key={chip}>{chip}</strong>
                                ))}
                            </div>
                        ) : null}
                        {interpretation?.assumptions.map((assumption) => (
                            <small
                                className={styles.assumption}
                                key={assumption}>
                                {assumption}
                            </small>
                        ))}
                    </section>

                    <section
                        className={styles.filters}
                        data-loading={pending || undefined}
                        data-error={Boolean(filterError) || undefined}
                        aria-label="Sort and filter marketplace products">
                        <div className={styles.filterBar}>
                            <label
                                className={`${styles.filterField} ${styles.sortField}`}>
                                Sort by
                                <select
                                    value={sort}
                                    onChange={(event) =>
                                        setSort(
                                            (
                                                event.currentTarget as HTMLSelectElement
                                            ).value as MarketplaceSort,
                                        )
                                    }>
                                    <option value="recommended">
                                        Recommended
                                    </option>
                                    <option value="price-asc">
                                        Price: low to high
                                    </option>
                                    <option value="price-desc">
                                        Price: high to low
                                    </option>
                                    <option value="delivery-asc">
                                        Fastest delivery
                                    </option>
                                    <option value="newest">Newest</option>
                                </select>
                            </label>
                            <button
                                className={styles.filterToggle}
                                type="button"
                                aria-expanded={filtersOpen}
                                aria-controls="marketplace-filter-tray"
                                onClick={() => setFiltersOpen((open) => !open)}>
                                <span>Filters</span>
                                {activeFilterCount ? (
                                    <strong>{activeFilterCount}</strong>
                                ) : (
                                    <small>Price, location, COA</small>
                                )}
                                <i aria-hidden="true" />
                            </button>
                            <button
                                className={styles.resetFilters}
                                type="button"
                                disabled={!filtersChanged}
                                onClick={resetFilters}>
                                Reset
                            </button>
                        </div>
                        {filtersOpen ? (
                            <div
                                className={styles.filterTray}
                                id="marketplace-filter-tray">
                                <label className={styles.filterField}>
                                    Min price
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={minPrice}
                                        placeholder="Any"
                                        onInput={(event) =>
                                            setMinPrice(
                                                (
                                                    event.currentTarget as HTMLInputElement
                                                ).value,
                                            )
                                        }
                                    />
                                </label>
                                <label className={styles.filterField}>
                                    Max price
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={maxPrice}
                                        placeholder="Any"
                                        onInput={(event) =>
                                            setMaxPrice(
                                                (
                                                    event.currentTarget as HTMLInputElement
                                                ).value,
                                            )
                                        }
                                    />
                                </label>
                                <label className={styles.filterField}>
                                    Warehouse
                                    <select
                                        value={warehouse}
                                        onChange={(event) =>
                                            setWarehouse(
                                                (
                                                    event.currentTarget as HTMLSelectElement
                                                ).value,
                                            )
                                        }>
                                        <option value="">All warehouses</option>
                                        {result?.facets?.warehouses.map(
                                            (value) => (
                                                <option
                                                    key={value}
                                                    value={value}>
                                                    {value}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>
                                <label className={styles.filterField}>
                                    Ships to
                                    <input
                                        type="text"
                                        value={shipsTo}
                                        autoComplete="country"
                                        placeholder="US"
                                        aria-describedby="ships-to-hint"
                                        onInput={(event) =>
                                            setShipsTo(
                                                normalizeCountryCode(
                                                    (
                                                        event.currentTarget as HTMLInputElement
                                                    ).value,
                                                ),
                                            )
                                        }
                                    />
                                    <small id="ships-to-hint">
                                        Two-letter country code
                                    </small>
                                </label>
                                <label className={styles.checkFilter}>
                                    <input
                                        type="checkbox"
                                        checked={hasLabReport}
                                        onChange={(event) =>
                                            setHasLabReport(
                                                (
                                                    event.currentTarget as HTMLInputElement
                                                ).checked,
                                            )
                                        }
                                    />
                                    COA available
                                </label>
                            </div>
                        ) : null}
                        {activeFilterCount && !filtersOpen ? (
                            <div
                                className={styles.activeFilters}
                                aria-label="Active filters">
                                {minPrice ? (
                                    <button
                                        type="button"
                                        aria-label={`Remove minimum price ${minPrice}`}
                                        onClick={() => setMinPrice("")}>
                                        Min ${minPrice} <span>×</span>
                                    </button>
                                ) : null}
                                {maxPrice ? (
                                    <button
                                        type="button"
                                        aria-label={`Remove maximum price ${maxPrice}`}
                                        onClick={() => setMaxPrice("")}>
                                        Max ${maxPrice} <span>×</span>
                                    </button>
                                ) : null}
                                {warehouse ? (
                                    <button
                                        type="button"
                                        aria-label={`Remove warehouse ${warehouse}`}
                                        onClick={() => setWarehouse("")}>
                                        From {warehouse} <span>×</span>
                                    </button>
                                ) : null}
                                {shipsTo ? (
                                    <button
                                        type="button"
                                        aria-label={`Remove destination ${shipsTo}`}
                                        onClick={() => setShipsTo("")}>
                                        To {shipsTo} <span>×</span>
                                    </button>
                                ) : null}
                                {hasLabReport ? (
                                    <button
                                        type="button"
                                        aria-label="Remove COA filter"
                                        onClick={() => setHasLabReport(false)}>
                                        COA <span>×</span>
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                        {filterError ? (
                            <p className={styles.filterError} role="alert">
                                {filterError}
                            </p>
                        ) : null}
                    </section>

                    <nav
                        className={styles.sellers}
                        aria-label="Filter by seller">
                        <button
                            type="button"
                            aria-pressed={!selectedVendor}
                            onClick={() => setSelectedVendor("")}>
                            All sellers
                        </button>
                        {result?.vendors.map((vendor, index) => (
                            <button
                                type="button"
                                key={vendor.code}
                                aria-pressed={selectedVendor === vendor.code}
                                onClick={() => setSelectedVendor(vendor.code)}>
                                <span>{index < 2 ? `0${index + 1}` : "•"}</span>
                                {vendor.name}
                                <small>{vendor.productCount}</small>
                            </button>
                        ))}
                    </nav>

                    <section
                        className={styles.results}
                        id="marketplace-results"
                        aria-busy={pending}>
                        {error ? (
                            <div className={styles.notice} role="alert">
                                <strong>Catalogues did not load.</strong>
                                <span>{error}</span>
                            </div>
                        ) : null}
                        {!pending &&
                        !error &&
                        displayedProducts.length === 0 ? (
                            <div className={styles.notice}>
                                <strong>No matching packages.</strong>
                                <span>
                                    Try a compound name, seller, dosage, or SKU.
                                </span>
                            </div>
                        ) : null}
                        {!pending && result?.suggestions?.length ? (
                            <div
                                className={styles.searchSuggestion}
                                role="status">
                                {result.suggestions[0].message}
                            </div>
                        ) : null}
                        <div className={styles.grid}>
                            {displayedProducts.map((product) => {
                                const cartIndex = cart.findIndex(
                                    (line) =>
                                        line.id === product.id &&
                                        line.vendorCode === product.vendorCode,
                                );
                                const cartLine = cart[cartIndex];
                                return (
                                    <article
                                        className={styles.productCard}
                                        key={`${product.vendorCode}:${product.productId}`}>
                                    <a
                                        className={styles.productVisual}
                                        href={marketplaceProductPath(product)}
                                        aria-label={`View ${product.productName} details`}
                                        onClick={(event) =>
                                            followProductLink(event, product)
                                        }>
                                        <ProductVisual
                                            imageUrl={product.imageUrl}
                                            productName={product.productName}
                                            mass={
                                                product.dosage ?? product.name
                                            }
                                            vendorName={
                                                vendorName.get(
                                                    product.vendorCode,
                                                ) ?? product.vendorCode
                                            }
                                            vendorCode={product.vendorCode}
                                            loading="lazy"
                                        />
                                    </a>
                                    <div className={styles.productCopy}>
                                        <p className={styles.vendorBadge}>
                                            <span aria-hidden="true">✓</span>
                                            Sold by{" "}
                                            {vendorName.get(
                                                product.vendorCode,
                                            ) ?? product.vendorCode}
                                        </p>
                                        <h2>
                                            <a
                                                href={marketplaceProductPath(
                                                    product,
                                                )}
                                                onClick={(event) =>
                                                    followProductLink(
                                                        event,
                                                        product,
                                                    )
                                                }>
                                                {product.productName}
                                            </a>
                                        </h2>
                                        <p className={styles.variantName}>
                                            From {product.name}
                                        </p>
                                        {product.description ? (
                                            <p
                                                className={
                                                    styles.cardDescription
                                                }>
                                                {productSummary(
                                                    product.description,
                                                )}
                                            </p>
                                        ) : null}
                                        <div className={styles.productMeta}>
                                            <PriceDisplay product={product} />
                                            <span>
                                                {product.warehouse ||
                                                    "Warehouse confirmed at checkout"}
                                            </span>
                                            {product.shippingEta ? (
                                                <span>
                                                    Est. delivery:{" "}
                                                    {product.shippingEta}
                                                </span>
                                            ) : null}
                                            {product.labReportUrl ? (
                                                <span>COA available</span>
                                            ) : null}
                                        </div>
                                        {product.matchReasons?.length ? (
                                            <p className={styles.matchReasons}>
                                                {product.matchReasons.join(
                                                    " · ",
                                                )}
                                            </p>
                                        ) : null}
                                        <div className={styles.productActions}>
                                            {cartLine ? (
                                                <div
                                                    className={
                                                        styles.cardQuantity
                                                    }
                                                    aria-label={`${product.name} quantity`}>
                                                    <button
                                                        type="button"
                                                        aria-label={`Decrease ${product.name} quantity`}
                                                        onClick={() =>
                                                            updateCartLine(
                                                                cartIndex,
                                                                cartLine.quantity -
                                                                    1,
                                                            )
                                                        }>
                                                        −
                                                    </button>
                                                    <strong>
                                                        {cartLine.quantity}
                                                    </strong>
                                                    <button
                                                        type="button"
                                                        aria-label={`Increase ${product.name} quantity`}
                                                        onClick={() =>
                                                            updateCartLine(
                                                                cartIndex,
                                                                cartLine.quantity +
                                                                    1,
                                                            )
                                                        }>
                                                        +
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className={
                                                        styles.primaryCardAction
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        addProductToCart(product)
                                                    }>
                                                    Add to cart
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    </article>
                                );
                            })}
                        </div>
                        {result?.pagination.hasMore ? (
                            <button
                                className={styles.loadMore}
                                type="button"
                                disabled={loadingMore}
                                onClick={() => void loadMore()}>
                                {loadingMore ? "Loading…" : "Load more"}
                            </button>
                        ) : null}
                    </section>
                </main>
            </div>

            <footer className={styles.marketplaceFooter}>{legal}</footer>

            {selectedProduct ? (
                <dialog
                    className={styles.productDialog}
                    ref={productDialogRef}
                    aria-labelledby="marketplace-product-title"
                    onClick={(event) => {
                        if (event.currentTarget === event.target)
                            closeProduct();
                    }}>
                    <button
                        className={styles.dialogClose}
                        type="button"
                        aria-label="Close product details"
                        onClick={closeProduct}>
                        ×
                    </button>
                    <div className={styles.detailLayout}>
                        <div className={styles.detailVisual} aria-hidden="true">
                            <ProductVisual
                                imageUrl={
                                    detail?.product.imageUrl ??
                                    selectedProduct.imageUrl
                                }
                                productName={selectedProduct.productName}
                                mass={
                                    selectedVariant?.dosage ??
                                    selectedVariant?.name ??
                                    selectedProduct.dosage ??
                                    selectedProduct.name
                                }
                                vendorName={
                                    detail?.vendor.name ??
                                    vendorName.get(
                                        selectedProduct.vendorCode,
                                    ) ??
                                    selectedProduct.vendorCode
                                }
                                vendorCode={selectedProduct.vendorCode}
                                loading="eager"
                            />
                        </div>
                        <div className={styles.detailCopy}>
                            <p className={styles.vendorBadge}>
                                <span aria-hidden="true">✓</span>
                                Sold by{" "}
                                {detail?.vendor.name ??
                                    vendorName.get(
                                        selectedProduct.vendorCode,
                                    ) ??
                                    selectedProduct.vendorCode}
                            </p>
                            <h2 id="marketplace-product-title">
                                {detail?.product.name ??
                                    selectedProduct.productName}
                            </h2>
                            <p className={styles.description}>
                                {detail?.product.description ||
                                    selectedProduct.description ||
                                    "Package details are confirmed by the seller."}
                            </p>
                            {detailPending ? (
                                <p
                                    className={styles.detailStatus}
                                    role="status">
                                    Refreshing package options…
                                </p>
                            ) : null}
                            {detailError ? (
                                <p className={styles.detailStatus} role="alert">
                                    {detailError}
                                </p>
                            ) : null}
                            <fieldset className={styles.packageOptions}>
                                <legend>Choose a package</legend>
                                {detailVariants.map((variant, index) => (
                                    <label key={variant.id}>
                                        <input
                                            autoFocus={index === 0}
                                            type="radio"
                                            name="marketplace-package"
                                            value={variant.id}
                                            checked={
                                                selectedVariant?.id ===
                                                variant.id
                                            }
                                            onChange={() =>
                                                setSelectedVariantId(variant.id)
                                            }
                                        />
                                        <span>
                                            <strong>{variant.name}</strong>
                                            <small>{variant.sku}</small>
                                        </span>
                                        <PriceDisplay product={variant} />
                                    </label>
                                ))}
                            </fieldset>
                            {selectedVariant?.promotion?.publicMessage ? (
                                <p className={styles.promotionMessage}>
                                    {selectedVariant.promotion.publicMessage}
                                </p>
                            ) : null}
                            <div className={styles.purchaseRow}>
                                <label>
                                    Quantity
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={quantity}
                                        onInput={(event) =>
                                            setQuantity(
                                                Math.max(
                                                    1,
                                                    Math.min(
                                                        99,
                                                        Number(
                                                            (
                                                                event.currentTarget as HTMLInputElement
                                                            ).value,
                                                        ) || 1,
                                                    ),
                                                ),
                                            )
                                        }
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => addToCart(false)}>
                                    Add to cart
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addToCart(true)}>
                                    Buy now
                                </button>
                            </div>
                            {detail?.product.labReportUrl ??
                            selectedProduct.labReportUrl ? (
                                <a
                                    className={styles.coaLink}
                                    href={
                                        detail?.product.labReportUrl ??
                                        selectedProduct.labReportUrl ??
                                        ""
                                    }
                                    target="_self"
                                    rel="noreferrer"
                                    onClick={() =>
                                        window.sessionStorage.setItem(
                                            PRODUCT_RETURN_STORAGE_KEY,
                                            JSON.stringify(selectedProduct),
                                        )
                                    }>
                                    View lab report
                                </a>
                            ) : null}
                        </div>
                    </div>
                </dialog>
            ) : null}

            <dialog
                className={`${styles.cartDialog} ${
                    buyerToken ? styles.checkoutDialog : ""
                }`}
                ref={cartDialogRef}
                aria-labelledby="marketplace-cart-title"
                onClick={(event) => {
                    if (event.currentTarget === event.target)
                        setCartOpen(false);
                }}>
                <button
                    className={styles.dialogClose}
                    type="button"
                    aria-label="Close cart"
                    onClick={() => setCartOpen(false)}>
                    ×
                </button>
                <div className={styles.cartHeader}>
                    <p className={styles.kicker}>Secure checkout</p>
                    <h2 id="marketplace-cart-title">
                        {payment
                            ? "Payment pending"
                            : buyerToken
                            ? "Shipping and payment"
                            : "Your marketplace cart"}
                    </h2>
                    <p>
                        {payment
                            ? "Send the exact amount on the stated network before the payment window closes."
                            : buyerToken
                            ? "Confirm delivery across every seller, then review everything before a payment is created."
                            : "One cart, with fulfillment tracked by seller."}
                    </p>
                </div>
                {cart.length ? (
                    <div className={styles.cartLines}>
                        {cart.map((line, index) => (
                            <article key={`${line.vendorCode}:${line.id}`}>
                                <div>
                                    <p>Sold by {line.sellerName}</p>
                                    <h3>{line.productName}</h3>
                                    <span>{line.name}</span>
                                </div>
                                <div className={styles.lineControls}>
                                    <button
                                        type="button"
                                        aria-label={`Decrease ${line.productName} quantity`}
                                        onClick={() =>
                                            updateCartLine(
                                                index,
                                                line.quantity - 1,
                                            )
                                        }>
                                        −
                                    </button>
                                    <span
                                        aria-label={`Quantity ${line.quantity}`}>
                                        {line.quantity}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={`Increase ${line.productName} quantity`}
                                        onClick={() =>
                                            updateCartLine(
                                                index,
                                                line.quantity + 1,
                                            )
                                        }>
                                        +
                                    </button>
                                </div>
                                <PriceDisplay
                                    product={line}
                                    quantity={line.quantity}
                                />
                                <button
                                    className={styles.removeLine}
                                    type="button"
                                    onClick={() => updateCartLine(index, 0)}>
                                    Remove
                                </button>
                            </article>
                        ))}
                        <div className={styles.cartTotal}>
                            <span>Items subtotal</span>
                            <span className={styles.cartSubtotalPrice}>
                                <strong>{money(cartSubtotal, cartCurrency)}</strong>
                                {cartRegularSubtotal > cartSubtotal ? (
                                    <s>{money(cartRegularSubtotal, cartCurrency)}</s>
                                ) : null}
                            </span>
                            <small>Shipping is calculated at checkout.</small>
                        </div>
                        {!buyerToken ? (
                            <button
                                className={styles.checkoutButton}
                                type="button"
                                autoFocus
                                disabled={checkoutPending}
                                onClick={beginCheckout}>
                                {checkoutPending
                                    ? "Preparing checkout…"
                                    : "Continue securely"}
                            </button>
                        ) : payment ? (
                            <section
                                className={styles.paymentInstructions}
                                aria-labelledby="marketplace-payment-title">
                                <p className={styles.kicker}>
                                    SECURE PAYMENT STATUS · ORDER {orderCode}
                                </p>
                                <h3 id="marketplace-payment-title">
                                    Payment pending
                                </h3>
                                <p>
                                    Complete this payment before it expires. We
                                    will update the order after the network
                                    confirms it.
                                </p>
                                <div
                                    className={styles.paymentCountdown}
                                    role="timer"
                                    aria-label={
                                        paymentCountdown?.expired
                                            ? "Payment window ended"
                                            : "Time left to pay"
                                    }>
                                    <span>
                                        {paymentCountdown?.expired
                                            ? "PAYMENT WINDOW ENDED"
                                            : "TIME LEFT TO PAY"}
                                    </span>
                                    <strong>{paymentCountdown?.label}</strong>
                                    <small>Hours · minutes · seconds</small>
                                </div>
                                <section
                                    className={styles.exactPaymentAmount}
                                    aria-label="Exact amount to send">
                                    <p>EXACT AMOUNT TO SEND</p>
                                    <div>
                                        <strong>
                                            {formatExactAmount(
                                                payment.payAmount,
                                            )}{" "}
                                            {payment.payCurrency}
                                        </strong>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void copyPaymentValue(
                                                    "amount",
                                                    payment.payAmount,
                                                )
                                            }>
                                            {copiedPaymentField === "amount"
                                                ? "Exact amount copied ✓"
                                                : "Copy exact amount"}
                                        </button>
                                    </div>
                                    <p>
                                        <strong>
                                            Send exactly the amount shown.
                                        </strong>{" "}
                                        Do not round it; the additional decimals
                                        identify your order.
                                    </p>
                                </section>
                                <dl>
                                    <dt>Order</dt>
                                    <dd>{orderCode}</dd>
                                    <dt>Network</dt>
                                    <dd>{payment.network.toUpperCase()}</dd>
                                    <dt>Status</dt>
                                    <dd>{payment.status}</dd>
                                    <dt>Confirmations</dt>
                                    <dd>
                                        {payment.confirmations} /{" "}
                                        {payment.requiredConfirmations}
                                    </dd>
                                </dl>
                                <div className={styles.paymentAddress}>
                                    <span>Payment address</span>
                                    <code>{payment.payAddress}</code>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void copyPaymentValue(
                                                "address",
                                                payment.payAddress,
                                            )
                                        }>
                                        {copiedPaymentField === "address"
                                            ? "Address copied ✓"
                                            : "Copy address"}
                                    </button>
                                </div>
                                <p className={styles.paymentWarning}>
                                    Send only {payment.payCurrency} on the
                                    stated network. A different asset or network
                                    may be unrecoverable.
                                </p>
                                <button
                                    className={styles.primaryCheckoutAction}
                                    type="button"
                                    disabled={checkoutPending}
                                    onClick={() => void refreshPayment()}>
                                    {checkoutPending
                                        ? "Checking…"
                                        : "Refresh payment status"}
                                </button>
                            </section>
                        ) : (
                            <form
                                className={styles.checkoutForm}
                                onSubmit={(event) => void quoteShipping(event)}>
                                <div className={styles.checkoutTitle}>
                                    <p className={styles.kicker}>
                                        ONE-PAGE CHECKOUT
                                    </p>
                                    <h3>Delivery details</h3>
                                    <p>
                                        Shipping is checked with every seller.
                                        Exact payment details appear only after
                                        your final review.
                                    </p>
                                </div>
                                <div className={styles.checkoutMain}>
                                    <fieldset className={styles.checkoutFields}>
                                        <legend>Shipping address</legend>
                                        {(
                                            [
                                                ["fullName", "Full name", "name"],
                                                [
                                                    "streetLine1",
                                                    "Street address",
                                                    "address-line1",
                                                ],
                                                [
                                                    "streetLine2",
                                                    "Apartment, suite, etc. (optional)",
                                                    "address-line2",
                                                ],
                                                ["city", "City", "address-level2"],
                                                [
                                                    "province",
                                                    "State / province",
                                                    "address-level1",
                                                ],
                                                [
                                                    "postalCode",
                                                    "Postal code",
                                                    "postal-code",
                                                ],
                                                [
                                                    "countryCode",
                                                    "Country code",
                                                    "country",
                                                ],
                                                ["phoneNumber", "Phone number", "tel"],
                                            ] as const
                                        ).map(([field, label, autoComplete]) => (
                                            <label key={field}>
                                                <span>
                                                    {label}
                                                    {field !== "streetLine2" ? (
                                                        <b aria-hidden="true"> *</b>
                                                    ) : null}
                                                </span>
                                                <input
                                                    required={field !== "streetLine2"}
                                                    value={address[field] ?? ""}
                                                    autoComplete={autoComplete}
                                                    maxLength={
                                                        field === "countryCode"
                                                            ? undefined
                                                            : 120
                                                    }
                                                    onInput={(event) =>
                                                        updateAddress(
                                                            field,
                                                            (
                                                                event.currentTarget as HTMLInputElement
                                                            ).value,
                                                        )
                                                    }
                                                />
                                            </label>
                                        ))}
                                        <button
                                            className={styles.primaryCheckoutAction}
                                            type="submit"
                                            disabled={checkoutPending}>
                                            {checkoutPending
                                                ? "Checking shipping…"
                                                : shippingQuote
                                                ? "Recalculate shipping"
                                                : "Calculate shipping"}
                                        </button>
                                    </fieldset>
                                    <aside
                                        className={styles.checkoutSummary}
                                        aria-label="Order summary">
                                        <p className={styles.kicker}>
                                            ORDER SUMMARY
                                        </p>
                                        <ul>
                                            {cart.map((line) => (
                                                <li
                                                    key={`${line.vendorCode}:${line.id}`}>
                                                    <span>
                                                        {line.productName} ×{" "}
                                                        {line.quantity}
                                                        <small>
                                                            Sold by {line.sellerName}
                                                        </small>
                                                    </span>
                                                    <strong>
                                                        {money(
                                                            line.priceWithTax *
                                                                line.quantity,
                                                            line.currencyCode,
                                                        )}
                                                    </strong>
                                                </li>
                                            ))}
                                        </ul>
                                        <div>
                                            <span>Total</span>
                                            <strong>
                                                {money(
                                                    shippingQuote?.totalWithTax ??
                                                        cartSubtotal,
                                                    shippingQuote?.currencyCode ??
                                                        cartCurrency,
                                                )}
                                            </strong>
                                        </div>
                                    </aside>
                                </div>
                                {shippingQuote ? (
                                    <fieldset className={styles.shippingReview}>
                                        <legend>Final confirmation</legend>
                                        <span>Items subtotal</span>
                                        <strong>
                                            {money(
                                                shippingQuote.subtotal,
                                                shippingQuote.currencyCode,
                                            )}
                                        </strong>
                                        <span>Shipping</span>
                                        <strong>
                                            {money(
                                                shippingQuote.shippingWithTax,
                                                shippingQuote.currencyCode,
                                            )}
                                        </strong>
                                        <span>Order total</span>
                                        <strong>
                                            {money(
                                                shippingQuote.totalWithTax,
                                                shippingQuote.currencyCode,
                                            )}
                                        </strong>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={acceptLegal}
                                                onChange={(event) =>
                                                    setAcceptLegal(
                                                        (
                                                            event.currentTarget as HTMLInputElement
                                                        ).checked,
                                                    )
                                                }
                                            />
                                            I accept the marketplace terms and
                                            seller policies.
                                        </label>
                                        <button
                                            className={styles.primaryCheckoutAction}
                                            type="button"
                                            disabled={
                                                !acceptLegal || checkoutPending
                                            }
                                            onClick={() => setReviewOpen(true)}>
                                            Review order
                                        </button>
                                        <p>
                                            No payment is created until you
                                            confirm the next screen.
                                        </p>
                                    </fieldset>
                                ) : null}
                            </form>
                        )}
                        {reviewOpen && shippingQuote ? (
                            <div
                                className={styles.reviewBackdrop}
                                role="presentation"
                                onMouseDown={(event) => {
                                    if (event.target === event.currentTarget)
                                        setReviewOpen(false);
                                }}>
                                <section
                                    className={styles.orderReview}
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="marketplace-review-title">
                                    <header>
                                        <div>
                                            <p className={styles.kicker}>
                                                FINAL REVIEW
                                            </p>
                                            <h3 id="marketplace-review-title">
                                                Review your order
                                            </h3>
                                            <p>
                                                No payment has been created.
                                                Confirm the details below before
                                                continuing.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            aria-label="Close order review"
                                            disabled={checkoutPending}
                                            onClick={() => setReviewOpen(false)}>
                                            ×
                                        </button>
                                    </header>
                                    <dl className={styles.reviewFacts}>
                                        <div>
                                            <dt>Contact</dt>
                                            <dd>
                                                <strong>{address.fullName}</strong>
                                                <span>{address.phoneNumber}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Ship to</dt>
                                            <dd>
                                                <span>{address.streetLine1}</span>
                                                {address.streetLine2 ? (
                                                    <span>{address.streetLine2}</span>
                                                ) : null}
                                                <span>
                                                    {address.city}, {address.province}{" "}
                                                    {address.postalCode}
                                                </span>
                                                <span>{address.countryCode}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Delivery</dt>
                                            <dd>
                                                <strong>
                                                    Every seller confirmed
                                                </strong>
                                                <span>
                                                    Shipping across this marketplace
                                                    cart
                                                </span>
                                                <span>
                                                    {money(
                                                        shippingQuote.shippingWithTax,
                                                        shippingQuote.currencyCode,
                                                    )}
                                                </span>
                                            </dd>
                                        </div>
                                        <div className={styles.reviewPaymentFact}>
                                            <dt>Payment</dt>
                                            <dd>
                                                <strong>Secure crypto payment</strong>
                                                <span>
                                                    Exact amount, wallet address,
                                                    network, and expiry appear next.
                                                </span>
                                            </dd>
                                        </div>
                                    </dl>
                                    <section className={styles.reviewItems}>
                                        <h4>Items</h4>
                                        <ul>
                                            {cart.map((line) => (
                                                <li
                                                    key={`${line.vendorCode}:${line.id}`}>
                                                    <span>
                                                        {line.productName} ×{" "}
                                                        {line.quantity}
                                                    </span>
                                                    <strong>
                                                        {money(
                                                            line.priceWithTax *
                                                                line.quantity,
                                                            line.currencyCode,
                                                        )}
                                                    </strong>
                                                </li>
                                            ))}
                                        </ul>
                                        <div>
                                            <span>Total</span>
                                            <strong>
                                                {money(
                                                    shippingQuote.totalWithTax,
                                                    shippingQuote.currencyCode,
                                                )}
                                            </strong>
                                        </div>
                                    </section>
                                    <p className={styles.reviewSuccess}>
                                        Shipping confirmed and marketplace terms
                                        accepted.
                                    </p>
                                    <div className={styles.reviewActions}>
                                        <button
                                            type="button"
                                            disabled={checkoutPending}
                                            onClick={() => setReviewOpen(false)}>
                                            Edit details
                                        </button>
                                        <button
                                            type="button"
                                            disabled={checkoutPending}
                                            onClick={() => void placeOrder()}>
                                            {checkoutPending
                                                ? "Creating secure payment…"
                                                : "Create secure payment"}
                                        </button>
                                    </div>
                                </section>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className={styles.emptyCart}>
                        <strong>Your cart is empty.</strong>
                        <span>Open a product to choose a package.</span>
                        <button
                            type="button"
                            autoFocus
                            onClick={() => setCartOpen(false)}>
                            Browse products
                        </button>
                    </div>
                )}
                {checkoutNotice ? (
                    <p className={styles.checkoutNotice} role="status">
                        {checkoutNotice}
                    </p>
                ) : null}
            </dialog>
        </div>
    );
}
