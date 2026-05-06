import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Home as HomeIcon } from "@styled-icons/boxicons-solid";
import { ChevronLeft, ChevronRight, Menu } from "@styled-icons/boxicons-regular";
import { Text } from "preact-i18n";
import styled from "styled-components/macro";

import { PageHeader } from "../../components/ui/Header";
import { isTouchscreenDevice } from "../../lib/isTouchscreenDevice";
import { useApplicationState } from "../../mobx/State";
import { SIDEBAR_CHANNELS } from "../../mobx/stores/Layout";
import { useDirectory } from "../directory/useDirectory";
import { CommunityCard, CommunityRow } from "../directory/CommunityCard";
import { ReviewsModal } from "../directory/ReviewsModal";
import { SubmitModal } from "../directory/SubmitModal";
import { COMMERCE_FILTERS, LEGEND } from "../directory/types";

import {
    Page,
    Header,
    DirectoryBadge,
    HeaderSpacer,
    BrandGroup,
    BrandText,
    SidebarToggle,
} from "../directory/stylesLayout";
import { ThemeToggle, NavSubmitGroup, NavSubmitBtn } from "../directory/stylesNav";
import { TabToggle, ToggleTab, Main, FilterWrap, SearchWrap, SearchInput, FilterPills, FilterToggleBtn, MobileBreak, Pill, ClearBtn, LegendToggle, LegendBox, LegendCat } from "../directory/stylesHero";
import { EmptyState, TableWrap, Table, CardGrid } from "../directory/stylesCommunity";
import directoryStyles from "../directory/Directory.module.scss";

const Overlay = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    background: var(--background);
`;



const HomeContent = observer(() => {
    const layout = useApplicationState().layout;
    const sidebarVisible = layout.getSectionState(SIDEBAR_CHANNELS, true);

    const {
        tab, search, setSearch, activeFilters, setActiveFilters, sortCol, sortDir,
        loading, loadError, showLegend, setShowLegend, showFilters, setShowFilters,
        reviewModal, setReviewModal, submitOpen, setSubmitOpen,
        submitInitialType, darkMode, setDarkMode,
        filtered, reviews, openSubmit, toggleFilter, handleSort, switchTab,
        reviewCount, handleSubmitReview, handleSubmitListing,
    } = useDirectory();

    const si = (col: "rating" | "name") => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

    useEffect(() => {
        if (!darkMode) {
            setDarkMode(true);
        }
    }, [darkMode, setDarkMode]);

    function toggleSidebar() {
        if (isTouchscreenDevice) {
            document
                .querySelector("#app > div > div > div")
                ?.scrollTo({ behavior: "smooth", left: 0 });
            return;
        }

        layout.toggleSectionState(SIDEBAR_CHANNELS, true);
    }

    return (
        <Page $dark={darkMode} style={{ height: "auto", overflow: "visible" }}>
            <Header>
                <BrandGroup>
                    <SidebarToggle
                        onClick={toggleSidebar}
                        title="Toggle sidebar"
                        aria-label="Toggle sidebar"
                    >
                        {isTouchscreenDevice ? (
                            <Menu size={26} />
                        ) : (
                            <>
                                {sidebarVisible ? (
                                    <>
                                        <ChevronLeft size={26} />
                                        <HomeIcon size={22} />
                                    </>
                                ) : (
                                    <>
                                        <HomeIcon size={22} />
                                        <ChevronRight size={26} />
                                    </>
                                )}
                            </>
                        )}
                    </SidebarToggle>
                    <BrandText>PepChat</BrandText>
                </BrandGroup>
                <DirectoryBadge>Directory</DirectoryBadge>
                <HeaderSpacer />
                <NavSubmitGroup>
                    <NavSubmitBtn onClick={() => openSubmit("vendor")}>+ Vendor</NavSubmitBtn>
                    <NavSubmitBtn onClick={() => openSubmit("reseller")}>+ Reseller</NavSubmitBtn>
                </NavSubmitGroup>
                <ThemeToggle onClick={() => setDarkMode((d) => !d)} title={darkMode ? "Light mode" : "Dark mode"}>
                    {darkMode ? "☀" : "☾"}
                </ThemeToggle>
            </Header>
            <Main>
                <div style={{ marginBottom: "16px" }}>
                    <TabToggle>
                        <ToggleTab $active={tab === "vendors"} onClick={() => switchTab("vendors")}>Vendors</ToggleTab>
                        <ToggleTab $active={tab === "resellers"} onClick={() => switchTab("resellers")}>Resellers</ToggleTab>
                        <ToggleTab $active={tab === "other"} onClick={() => switchTab("other")}>Other</ToggleTab>
                    </TabToggle>
                </div>

                <FilterWrap>
                    <SearchWrap>
                        <span className="icon">🔍</span>
                        <SearchInput
                            value={search}
                            onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
                            placeholder="Search communities..."
                        />
                    </SearchWrap>
                    {tab !== "other" && (
                        <FilterToggleBtn
                            onClick={() => setShowFilters(!showFilters)}
                            $active={showFilters}
                            title="Filters"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V6.58579C21 6.851 20.8946 7.10536 20.7071 7.29289L14.2929 13.7071C14.1054 13.8946 14 14.149 14 14.4142V19.5528C14 19.818 13.8946 20.0724 13.7071 20.2599L10.7071 23.2599C10.3166 23.6505 9.68342 23.6505 9.29289 23.2599C9.10536 23.0724 9 22.818 9 22.5528V14.4142C9 14.149 8.89464 13.8946 8.70711 13.7071L2.29289 7.29289C2.10536 7.10536 2 6.851 2 6.58579V4C2 3.44772 2.44772 3 3 3Z" />
                            </svg>
                        </FilterToggleBtn>
                    )}
                    <MobileBreak />
                    {tab !== "other" && (
                        <FilterPills $showMobile={showFilters}>
                            {COMMERCE_FILTERS.map((f) => (
                                <Pill key={f.key} $active={activeFilters.has(f.key)} onClick={() => toggleFilter(f.key)}>
                                    {f.key === "us" || f.key === "eu" || f.key === "aus"
                                        ? f.label
                                        : `${f.emoji} ${f.label}`}
                                </Pill>
                            ))}
                            {activeFilters.size > 0 && (
                                <ClearBtn onClick={() => setActiveFilters(new Set())}>
                                    ✕ Clear ({activeFilters.size})
                                </ClearBtn>
                            )}
                        </FilterPills>
                    )}
                    <LegendToggle onClick={() => setShowLegend((s) => !s)}>
                        {showLegend ? "Hide Legend" : "? Legend"}
                    </LegendToggle>
                </FilterWrap>

                {showLegend && (
                    <LegendBox>
                        {LEGEND.map((cat) => (
                            <LegendCat key={cat.category}>
                                <h4>{cat.category}</h4>
                                <ul>
                                    {cat.items.map((item) => (
                                        <li key={item.abbr}><span>{item.abbr}</span>{item.label}</li>
                                    ))}
                                </ul>
                            </LegendCat>
                        ))}
                    </LegendBox>
                )}

                {loading ? (
                    <EmptyState>
                        <span className="icon" style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }}>⟳</span>
                        Loading directory…
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </EmptyState>
                ) : loadError ? (
                    <EmptyState>
                        <span className="icon">⚠️</span>
                        Failed to load directory data. Please refresh and try again.
                    </EmptyState>
                ) : filtered.length === 0 ? (
                    <EmptyState>
                        <span className="icon">🔍</span>
                        No communities match your search or filters.
                    </EmptyState>
                ) : (
                    <>
                        <TableWrap className={directoryStyles.desktopTable}>
                            <Table>
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort("rating")}>Rating{si("rating")}</th>
                                        <th onClick={() => handleSort("name")}>Name{si("name")}</th>
                                        {tab !== "other" && (
                                            <>
                                                <th>Payment</th>
                                                <th>Countries</th>
                                                <th>Products</th>
                                                <th>Guarantee</th>
                                                {tab === "resellers" && <th>Order Types</th>}
                                                <th>Free Ship</th>
                                                <th>Ship Time</th>
                                            </>
                                        )}
                                        {tab === "other" && <th>About</th>}
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((c) => (
                                        <CommunityRow
                                            key={c.id}
                                            community={c}
                                            reviewCount={reviewCount(c.id, c.type)}
                                            isReseller={tab === "resellers"}
                                            onReview={() => setReviewModal(c)}
                                        />
                                    ))}
                                </tbody>
                            </Table>
                        </TableWrap>

                        <CardGrid className={directoryStyles.mobileCards}>
                            {filtered.map((c) => (
                                <CommunityCard
                                    key={c.id}
                                    community={c}
                                    reviewCount={reviewCount(c.id, c.type)}
                                    onReview={() => setReviewModal(c)}
                                />
                            ))}
                        </CardGrid>
                    </>
                )}
            </Main>

            {/* ── Modals ── */}
            {reviewModal && (
                <ReviewsModal
                    community={reviewModal}
                    reviews={reviews.filter(
                        (r) => r.vendorId === reviewModal.id && r.vendorType === reviewModal.type,
                    )}
                    onClose={() => setReviewModal(null)}
                    onSubmit={handleSubmitReview}
                />
            )}

            {submitOpen && (
                <SubmitModal
                    onClose={() => setSubmitOpen(false)}
                    onSubmit={handleSubmitListing}
                    initialType={submitInitialType}
                />
            )}
        </Page>
    );
});

const Home: React.FC = () => {
    return (
        <Overlay>
            <PageHeader icon={<HomeIcon size={24} />} withTransparency>
                <Text id="app.navigation.tabs.home" />
            </PageHeader>
            <HomeContent />
        </Overlay>
    );
};

export default Home;
