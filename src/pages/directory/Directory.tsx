import { observer } from "mobx-react-lite";
import { clientController } from "../../controllers/client/ClientController";
import wideSVG from "/assets/wide.svg";
import styles from "./Directory.module.scss";

import { useDirectory } from "./useDirectory";
import { CommunityCard, CommunityRow } from "./CommunityCard";
import { ReviewsModal } from "./ReviewsModal";
import { SubmitModal } from "./SubmitModal";
import { COMMERCE_FILTERS, LEGEND } from "./types";

import { Page, Header, LogoImg, DirectoryBadge, HeaderSpacer, HeaderNav, NavBtn, DesktopAuthGroup, MobileAuthBtn } from "./stylesLayout";
import { Hero, HeroInner, HeroTitle, HeroSub, TabToggle, ToggleTab, Main, SectionHeader, FilterWrap, SearchWrap, SearchInput, FilterPills, Pill, ClearBtn, LegendToggle, LegendBox, LegendCat } from "./stylesHero";
import { EmptyState, TableWrap, Table, CardGrid } from "./stylesCommunity";
import { Footer, FooterLinks, BottomNav, BottomTab, FAB, ThemeToggle, NavDivider, NavSubmitGroup, NavSubmitBtn } from "./stylesNav";

function Directory() {
    const {
        tab, search, setSearch, activeFilters, setActiveFilters, sortCol, sortDir,
        loading, loadError, showLegend, setShowLegend,
        reviewModal, setReviewModal, submitOpen, setSubmitOpen,
        submitInitialType, darkMode, setDarkMode,
        filtered, reviews, openSubmit, toggleFilter, handleSort, switchTab,
        reviewCount, handleSubmitReview, handleSubmitListing,
    } = useDirectory();

    const si = (col: "rating" | "name") => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    const loggedIn = clientController.isLoggedIn();
    const sectionTitle = tab === "vendors" ? "Vendor Communities" : tab === "resellers" ? "Reseller Communities" : "Other Communities";

    return (
        <Page $dark={darkMode}>
            {/* ── Header ── */}
            <Header>
                <LogoImg src={wideSVG} alt="PepChat" draggable={false} />
                <DirectoryBadge>Directory</DirectoryBadge>
                <HeaderSpacer />
                <NavSubmitGroup>
                    <NavSubmitBtn onClick={() => openSubmit("vendor")}>+ Vendor</NavSubmitBtn>
                    <NavSubmitBtn onClick={() => openSubmit("reseller")}>+ Reseller</NavSubmitBtn>
                </NavSubmitGroup>
                <NavDivider />
                <ThemeToggle onClick={() => setDarkMode((d) => !d)} title={darkMode ? "Light mode" : "Dark mode"}>
                    {darkMode ? "☀" : "☾"}
                </ThemeToggle>
                <NavDivider />
                <HeaderNav>
                    {loggedIn ? (
                        <NavBtn href="/" $primary>Open Chat</NavBtn>
                    ) : (
                        <>
                            <DesktopAuthGroup>
                                <NavBtn href="/login">Log In</NavBtn>
                                <NavBtn href="/login/create" $primary>Register</NavBtn>
                            </DesktopAuthGroup>
                            <MobileAuthBtn href="/login">Login</MobileAuthBtn>
                        </>
                    )}
                </HeaderNav>
            </Header>

            {/* ── Hero ── */}
            <Hero>
                <HeroInner>
                    <HeroTitle>PepChat <span>Discovery</span></HeroTitle>
                    <HeroSub>
                        Community-curated directory of trusted peptide communities.
                        Compare vendors, resellers, and general communities in one place.
                    </HeroSub>
                    <TabToggle>
                        <ToggleTab $active={tab === "vendors"} onClick={() => switchTab("vendors")}>Vendors</ToggleTab>
                        <ToggleTab $active={tab === "resellers"} onClick={() => switchTab("resellers")}>Resellers</ToggleTab>
                        <ToggleTab $active={tab === "other"} onClick={() => switchTab("other")}>Other</ToggleTab>
                    </TabToggle>
                </HeroInner>
            </Hero>

            {/* ── Main ── */}
            <Main>
                <SectionHeader>
                    <h2>{sectionTitle}</h2>
                    {!loading && !loadError && (
                        <span className="count">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}</span>
                    )}
                </SectionHeader>

                <FilterWrap>
                    <SearchWrap>
                        <span className="icon">🔍</span>
                        <SearchInput
                            value={search}
                            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                            placeholder="Search communities..."
                        />
                    </SearchWrap>
                    {tab !== "other" && (
                        <FilterPills>
                            {COMMERCE_FILTERS.map((f) => (
                                <Pill key={f.key} $active={activeFilters.has(f.key)} onClick={() => toggleFilter(f.key)}>
                                    {f.emoji} {f.label}
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
                        <TableWrap className={styles.desktopTable}>
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

                        <CardGrid className={styles.mobileCards}>
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

            {/* ── Footer ── */}
            <Footer>
                <div>
                    <LogoImg src={wideSVG} alt="PepChat" draggable={false} style={{ marginBottom: 8 }} />
                    <p className="disclaimer">
                        Information is community-maintained and may not be current.
                        Not affiliated with or endorsing any listed community.
                    </p>
                </div>
                <FooterLinks>
                    {loggedIn ? (
                        <a href="/" style={{ color: "inherit", textDecoration: "none" }}>Open Chat</a>
                    ) : (
                        <>
                            <a href="/login" style={{ color: "inherit", textDecoration: "none" }}>Log In</a>
                            <a href="/login/create" style={{ color: "inherit", textDecoration: "none" }}>Register</a>
                        </>
                    )}
                </FooterLinks>
            </Footer>

            <BottomNav className={styles.mobileNav}>
                <BottomTab $active={tab === "vendors"} onClick={() => switchTab("vendors")}>Vendors</BottomTab>
                <BottomTab $active={tab === "resellers"} onClick={() => switchTab("resellers")}>Resellers</BottomTab>
                <BottomTab $active={tab === "other"} onClick={() => switchTab("other")}>Other</BottomTab>
            </BottomNav>

            <FAB onClick={() => setSubmitOpen(true)}>+</FAB>

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
}

export default observer(Directory);
