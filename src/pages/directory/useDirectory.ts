import { useState, useMemo, useEffect } from "preact/hooks";
import type { Community, CommerceCommunity, Review, FilterKey, SubmitForm } from "./types";
import { API_BASE, SHEET_COMMUNITIES, SHEET_REVIEWS } from "./types";
import { parseCSV, rowToCommunity, rowToReview, apiToCommunity, apiToReview, matchesFilters } from "./dataUtils";

export function useDirectory() {
    const [tab, setTab] = useState<"vendors" | "resellers" | "other">("vendors");
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
    const [sortCol, setSortCol] = useState<"rating" | "name">("rating");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [reviews, setReviews] = useState<Review[]>([]);
    /** Live mode: review counts from GET reviews pagination (list is empty until a modal fetch). */
    const [reviewTotals, setReviewTotals] = useState<Record<string, number>>({});
    const [allCommunities, setAllCommunities] = useState<Community[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showLegend, setShowLegend] = useState(false);
    const [reviewModal, setReviewModal] = useState<Community | null>(null);
    const [submitOpen, setSubmitOpen] = useState(false);
    const [submitInitialType, setSubmitInitialType] = useState<"vendor" | "reseller" | "other">("vendor");
    const [darkMode, setDarkMode] = useState(false);

    const useLive = useMemo(() => new URLSearchParams(window.location.search).has("live"), []);

    // Load communities (+ reviews for sheet mode)
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);

        if (useLive) {
            fetch(`${API_BASE}/directory/communities?limit=100`)
                .then((r) => r.json())
                .then((json) => {
                    if (cancelled) return;
                    setAllCommunities((json.data ?? []).map(apiToCommunity));
                })
                .catch((err) => { if (!cancelled) setLoadError(String(err)); })
                .finally(() => { if (!cancelled) setLoading(false); });
        } else {
            Promise.all([
                fetch(SHEET_COMMUNITIES).then((r) => r.text()),
                fetch(SHEET_REVIEWS).then((r) => r.text()),
            ])
                .then(([commCSV, revCSV]) => {
                    if (cancelled) return;
                    const communities = parseCSV(commCSV).map(rowToCommunity).filter(Boolean) as Community[];
                    const reviewList = parseCSV(revCSV).map(rowToReview).filter(Boolean) as Review[];
                    setAllCommunities(communities);
                    setReviews(reviewList);
                })
                .catch((err) => { if (!cancelled) setLoadError(String(err)); })
                .finally(() => { if (!cancelled) setLoading(false); });
        }

        return () => { cancelled = true; };
    }, [useLive]);

    // Live mode: load per-listing review totals (rating comes from communities; counts need reviews meta)
    useEffect(() => {
        if (!useLive || allCommunities.length === 0) return;
        let cancelled = false;
        Promise.all(
            allCommunities.map((c) =>
                fetch(
                    `${API_BASE}/directory/communities/reviews?communityId=${encodeURIComponent(c.id)}&pageSize=1`,
                )
                    .then((r) => r.json())
                    .then((json) => {
                        const total = json.meta?.pagination?.total;
                        const n = typeof total === "number" ? total : (json.data?.length ?? 0);
                        return { key: `${c.id}:${c.type}`, n };
                    })
                    .catch(() => ({ key: `${c.id}:${c.type}`, n: 0 })),
            ),
        ).then((rows) => {
            if (cancelled) return;
            const next: Record<string, number> = {};
            for (const { key, n } of rows) next[key] = n;
            setReviewTotals(next);
        });
        return () => { cancelled = true; };
    }, [useLive, allCommunities]);

    // In live mode: fetch reviews for a community when its modal opens
    useEffect(() => {
        if (!useLive || !reviewModal) return;
        let cancelled = false;
        fetch(`${API_BASE}/directory/communities/reviews?communityId=${reviewModal.id}&pageSize=50`)
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                const incoming = (json.data ?? []).map(apiToReview);
                setReviews((prev) => [
                    ...prev.filter((r) => r.vendorId !== reviewModal.id),
                    ...incoming,
                ]);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [useLive, reviewModal?.id]);

    function openSubmit(type: "vendor" | "reseller" | "other") {
        setSubmitInitialType(type);
        setSubmitOpen(true);
    }

    function toggleFilter(key: FilterKey) {
        setActiveFilters((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    function handleSort(col: "rating" | "name") {
        if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortCol(col); setSortDir(col === "rating" ? "desc" : "asc"); }
    }

    function switchTab(t: typeof tab) {
        setTab(t);
        setSearch("");
        setActiveFilters(new Set());
    }

    const tabType = tab === "vendors" ? "vendor" : tab === "resellers" ? "reseller" : "other";

    const filtered = useMemo(() => {
        const list = allCommunities.filter((c) => c.type === tabType);
        return list
            .filter((c) => {
                const q = search.toLowerCase();
                return !q || c.name.toLowerCase().includes(q);
            })
            .filter((c) => {
                if (tab === "other" || activeFilters.size === 0) return true;
                return matchesFilters(c as CommerceCommunity, activeFilters);
            })
            .sort((a, b) => {
                const cmp = sortCol === "rating" ? a.rating - b.rating : a.name.localeCompare(b.name);
                return sortDir === "asc" ? cmp : -cmp;
            });
    }, [allCommunities, tab, tabType, search, activeFilters, sortCol, sortDir]);

    const reviewCount = (id: string, type: string) => {
        const key = `${id}:${type}`;
        const loaded = reviews.filter((r) => r.vendorId === id && r.vendorType === type).length;
        return Math.max(reviewTotals[key] ?? 0, loaded);
    };

    function handleSubmitReview(rev: Omit<Review, "id" | "date">) {
        if (useLive) {
            fetch(`${API_BASE}/directory/communities/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    communityId: rev.vendorId,
                    communityType: rev.vendorType,
                    reviewerName: rev.reviewerName,
                    rating: rev.rating,
                    text: rev.text,
                }),
            }).catch(() => {});
        } else {
            setReviews((prev) => [
                ...prev,
                { ...rev, id: `u${Date.now()}`, date: new Date().toISOString().split("T")[0] },
            ]);
        }
    }

    function handleSubmitListing(form: SubmitForm) {
        if (useLive) {
            fetch(`${API_BASE}/directory/communities/submissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: form.type,
                    name: form.name,
                    inviteLink: form.inviteLink,
                    serverId: form.serverId || undefined,
                    payment: form.payment,
                    warehouses: form.warehouses,
                    products: form.products,
                    guarantees: form.guarantees,
                    orderTypes: form.orderTypes,
                    notes: form.notes || undefined,
                }),
            }).catch(() => {});
        } else {
            const key = "pepchat_pending_submissions";
            const existing = JSON.parse(localStorage.getItem(key) || "[]");
            existing.push({ ...form, submittedAt: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(existing));
        }
    }

    return {
        tab, search, setSearch, activeFilters, setActiveFilters, sortCol, sortDir,
        loading, loadError, showLegend, setShowLegend,
        reviewModal, setReviewModal, submitOpen, setSubmitOpen,
        submitInitialType, darkMode, setDarkMode,
        filtered, reviews, openSubmit, toggleFilter, handleSort, switchTab,
        reviewCount, handleSubmitReview, handleSubmitListing,
    };
}
