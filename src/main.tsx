const marketplaceHost =
    document.documentElement.dataset.marketplaceHost === "true" ||
    window.location.hostname === "market.peptide.chat" ||
    (import.meta.env.DEV &&
        new URLSearchParams(window.location.search).has("marketplace-preview"));

// Keep the public marketplace off the chat application's critical path. The
// chat entry pulls in the realtime client, stores, error replay, animations,
// audio, and every app-wide style. None of that is required to browse or buy.
if (marketplaceHost) {
    void import("./marketplaceMain");
} else {
    // Keep Vite from combining both conditional imports into one preload list.
    // A zero-delay task is imperceptible on chat and prevents its dependency
    // graph from being fetched on the marketplace host.
    window.setTimeout(() => void import("./chatMain"), 0);
}
