import styles from "./MarketplaceLogin.module.scss";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import {
    getMarketplaceProduct,
    MarketplaceProduct,
    MarketplaceProductDetail,
    MarketplaceSearchResponse,
    MarketplaceSort,
    searchMarketplace,
} from "../../lib/marketplace";

const PAGE_SIZE = 24;
const CART_STORAGE_KEY = "compound-bay-marketplace-cart-v1";

type CartLine = MarketplaceProduct & {
    quantity: number;
    sellerName: string;
};

function money(value: number, currency: string) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
    }).format(value / 100);
}

function priceToMinorUnits(value: string) {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.round(parsed * 100)
        : undefined;
}

function readCart() {
    try {
        const saved = window.localStorage.getItem(CART_STORAGE_KEY);
        if (!saved) return [];
        const lines = JSON.parse(saved) as CartLine[];
        return Array.isArray(lines) ? lines : [];
    } catch {
        return [];
    }
}

export default function MarketplaceLogin({
    authentication,
    locale,
    legal,
    logoSrc,
}: {
    authentication: ComponentChildren;
    locale: ComponentChildren;
    legal: ComponentChildren;
    logoSrc: string;
}) {
    const [query, setQuery] = useState("");
    const [selectedVendor, setSelectedVendor] = useState("");
    const [sort, setSort] = useState<MarketplaceSort>("recommended");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [warehouse, setWarehouse] = useState("");
    const [shipsTo, setShipsTo] = useState("");
    const [hasLabReport, setHasLabReport] = useState(false);
    const [result, setResult] = useState<MarketplaceSearchResponse | null>(
        null,
    );
    const [pending, setPending] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [selectedProduct, setSelectedProduct] =
        useState<MarketplaceProduct | null>(null);
    const [detail, setDetail] = useState<MarketplaceProductDetail | null>(null);
    const [detailPending, setDetailPending] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [checkoutNotice, setCheckoutNotice] = useState("");
    const authRef = useRef<HTMLElement>(null);
    const productDialogRef = useRef<HTMLDialogElement>(null);
    const cartDialogRef = useRef<HTMLDialogElement>(null);
    const cartHydratedRef = useRef(false);
    const minPriceMinor = priceToMinorUnits(minPrice);
    const maxPriceMinor = priceToMinorUnits(maxPrice);
    const filterError =
        minPrice && minPriceMinor === undefined
            ? "Enter a valid minimum price."
            : maxPrice && maxPriceMinor === undefined
            ? "Enter a valid maximum price."
            : minPriceMinor !== undefined &&
              maxPriceMinor !== undefined &&
              minPriceMinor > maxPriceMinor
            ? "Minimum price cannot exceed maximum price."
            : "";

    useEffect(() => {
        setCart(readCart());
        cartHydratedRef.current = true;
    }, []);

    useEffect(() => {
        if (!cartHydratedRef.current) return;
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        if (filterError) {
            setPending(false);
            return;
        }
        const controller = new AbortController();
        const timeout = window.setTimeout(
            () => {
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
            },
            query ? 250 : 0,
        );
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
    const cartCurrency = cart[0]?.currencyCode ?? "USD";

    async function loadMore() {
        if (!result?.pagination.hasMore || loadingMore) return;
        setLoadingMore(true);
        setError("");
        try {
            const next = await searchMarketplace({
                query: query.trim(),
                vendor: selectedVendor,
                offset: result.pagination.offset + result.products.length,
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

    function focusAuthentication() {
        authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => {
            authRef.current
                ?.querySelector<HTMLElement>("input, button, a")
                ?.focus();
        }, 180);
    }

    function closeProduct() {
        productDialogRef.current?.close();
        setSelectedProduct(null);
        setDetail(null);
    }

    function addToCart(openCart = false) {
        if (!selectedVariant) return;
        const sellerName =
            detail?.vendor.name ??
            vendorName.get(selectedVariant.vendorCode) ??
            selectedVariant.vendorCode;
        setCart((lines) => {
            const existing = lines.findIndex(
                (line) =>
                    line.id === selectedVariant.id &&
                    line.vendorCode === selectedVariant.vendorCode,
            );
            if (existing === -1) {
                return [...lines, { ...selectedVariant, quantity, sellerName }];
            }
            return lines.map((line, index) =>
                index === existing
                    ? {
                          ...line,
                          quantity: Math.min(99, line.quantity + quantity),
                      }
                    : line,
            );
        });
        closeProduct();
        if (openCart) setCartOpen(true);
    }

    function updateCartLine(index: number, nextQuantity: number) {
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

    function beginCheckout() {
        setCartOpen(false);
        setCheckoutNotice(
            "Your marketplace cart is saved. Sign in to continue to checkout.",
        );
        focusAuthentication();
    }

    return (
        <div className={styles.marketplace} data-marketplace-state="enabled">
            <header className={styles.header}>
                <a className={styles.wordmark} href="#marketplace-results">
                    <span className={styles.logoPlate}>
                        <img src={logoSrc} alt="PepChat" draggable={false} />
                    </span>
                </a>
                <div className={styles.headerActions}>
                    <div className={styles.locale}>{locale}</div>
                    <button
                        className={styles.cartButton}
                        type="button"
                        onClick={() => setCartOpen(true)}
                        aria-label={`Open cart with ${cartCount} items`}>
                        Cart <span>{cartCount}</span>
                    </button>
                    <button
                        className={styles.signInButton}
                        type="button"
                        onClick={focusAuthentication}>
                        Sign in
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
                        <div className={styles.searchRow}>
                            <input
                                id="marketplace-search"
                                type="search"
                                value={query}
                                placeholder="Try semaglutide, BPC-157, or a SKU"
                                autoComplete="off"
                                onInput={(event) =>
                                    setQuery(
                                        (
                                            event.currentTarget as HTMLInputElement
                                        ).value,
                                    )
                                }
                            />
                            {query ? (
                                <button
                                    type="button"
                                    onClick={() => setQuery("")}>
                                    Clear
                                </button>
                            ) : null}
                        </div>
                        <p role="status">
                            {pending
                                ? "Searching approved sellers…"
                                : `${
                                      result?.pagination.totalItems ?? 0
                                  } available packages`}
                        </p>
                    </section>

                    <section
                        className={styles.filters}
                        aria-label="Sort and filter marketplace products">
                        <label className={styles.filterField}>
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
                                <option value="recommended">Recommended</option>
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
                                {result?.facets?.warehouses.map((value) => (
                                    <option key={value} value={value}>
                                        {value}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.filterField}>
                            Ships to
                            <input
                                type="text"
                                value={shipsTo}
                                maxLength={2}
                                autoComplete="country"
                                placeholder="US"
                                aria-describedby="ships-to-hint"
                                onInput={(event) =>
                                    setShipsTo(
                                        (
                                            event.currentTarget as HTMLInputElement
                                        ).value
                                            .replace(/[^a-z]/gi, "")
                                            .toUpperCase(),
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
                        <button
                            className={styles.resetFilters}
                            type="button"
                            disabled={
                                sort === "recommended" &&
                                !minPrice &&
                                !maxPrice &&
                                !warehouse &&
                                !shipsTo &&
                                !hasLabReport
                            }
                            onClick={resetFilters}>
                            Reset filters
                        </button>
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
                        {!pending && !error && listedProducts.length === 0 ? (
                            <div className={styles.notice}>
                                <strong>No matching packages.</strong>
                                <span>
                                    Try a compound name, seller, dosage, or SKU.
                                </span>
                            </div>
                        ) : null}
                        <div className={styles.grid}>
                            {listedProducts.map((product) => (
                                <article
                                    className={styles.productCard}
                                    key={`${product.vendorCode}:${product.productId}`}>
                                    <div
                                        className={styles.productVisual}
                                        aria-hidden="true">
                                        {product.imageUrl ? (
                                            <img
                                                src={product.imageUrl}
                                                alt=""
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span>
                                                {product.productName
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.productCopy}>
                                        <p className={styles.vendorBadge}>
                                            <span aria-hidden="true">✓</span>
                                            Sold by{" "}
                                            {vendorName.get(
                                                product.vendorCode,
                                            ) ?? product.vendorCode}
                                        </p>
                                        <h2>{product.productName}</h2>
                                        <p className={styles.variantName}>
                                            From {product.name}
                                        </p>
                                        <div className={styles.productMeta}>
                                            <strong>
                                                {money(
                                                    product.priceWithTax,
                                                    product.currencyCode,
                                                )}
                                            </strong>
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
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedProduct(product)
                                            }>
                                            View details
                                        </button>
                                    </div>
                                </article>
                            ))}
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

                <aside
                    className={styles.authentication}
                    ref={authRef}
                    aria-label="PepChat sign in">
                    <div>
                        <p className={styles.authKicker}>PepChat account</p>
                        {checkoutNotice ? (
                            <p className={styles.checkoutNotice} role="status">
                                {checkoutNotice}
                            </p>
                        ) : null}
                        {authentication}
                    </div>
                    <div className={styles.legal}>{legal}</div>
                </aside>
            </div>

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
                            {detail?.product.imageUrl ??
                            selectedProduct.imageUrl ? (
                                <img
                                    src={
                                        detail?.product.imageUrl ??
                                        selectedProduct.imageUrl ??
                                        ""
                                    }
                                    alt=""
                                />
                            ) : (
                                <span>
                                    {selectedProduct.productName
                                        .slice(0, 2)
                                        .toUpperCase()}
                                </span>
                            )}
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
                                        <b>
                                            {money(
                                                variant.priceWithTax,
                                                variant.currencyCode,
                                            )}
                                        </b>
                                    </label>
                                ))}
                            </fieldset>
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
                                    target="_blank"
                                    rel="noreferrer">
                                    View lab report
                                </a>
                            ) : null}
                        </div>
                    </div>
                </dialog>
            ) : null}

            <dialog
                className={styles.cartDialog}
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
                    <h2 id="marketplace-cart-title">Your marketplace cart</h2>
                    <p>One cart, with fulfillment tracked by seller.</p>
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
                                <strong>
                                    {money(
                                        line.priceWithTax * line.quantity,
                                        line.currencyCode,
                                    )}
                                </strong>
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
                            <strong>{money(cartSubtotal, cartCurrency)}</strong>
                            <small>Shipping is calculated at checkout.</small>
                        </div>
                        <button
                            className={styles.checkoutButton}
                            type="button"
                            autoFocus
                            onClick={beginCheckout}>
                            Sign in to checkout
                        </button>
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
            </dialog>
        </div>
    );
}
