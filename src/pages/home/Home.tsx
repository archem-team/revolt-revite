import { Search, X } from "@styled-icons/boxicons-regular";
import { Lock, MessageAdd } from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import styled from "styled-components/macro";

import styles from "./Home.module.scss";
import { Text } from "preact-i18n";

import { CategoryButton, InputBox, Preloader } from "@revoltchat/ui";

import { PageHeader } from "../../components/ui/Header";
import { useClient } from "../../controllers/client/ClientController";
import { isTouchscreenDevice } from "../../lib/isTouchscreenDevice";
import Promos from "./Promos";
import { BACKEND_API_BASE } from "../directory/types";

const Overlay = styled.div`
    display: grid;
    height: 100%;
    overflow-y: scroll;

    > * {
        grid-area: 1 / 1;
    }

    .content {
        z-index: 1;
    }

    h3 {
        padding-top: 1rem;
    }
`;

const DisabledWrapper = styled.div`
    opacity: 0.5;
    pointer-events: none;
    margin-bottom: -10px;
`;

interface Server {
    id: string;
    name: string;
    description: string;
    inviteCode: string;
    disabled: boolean;
    new: boolean;
    showcolor: string;
    sortorder: number;
    logo?: string;
}

interface CachedData {
    timestamp: number;
    data: Server[];
}

// Add a styled component for the new text color
const NewServerWrapper = styled.div`
    color: #fadf4f;
    display: contents;

    a {
        color: #fadf4f;
    }
`;

// Dynamic color wrapper component
const ColorWrapper = styled.div<{ color: string }>`
    color: ${props => props.color};
    display: contents;

    a {
        color: ${props => props.color};
    }
`;

// Logo ids can reference files missing from this environment's autumn (e.g.
// staging seeded from prod data), so a failed load falls back to the state
// glyph instead of a broken image.
function ServerIcon({
    logo,
    size,
    fallback,
}: {
    logo: string;
    size: number;
    fallback: React.ReactNode;
}) {
    const [failed, setFailed] = useState(false);

    if (failed) return <>{fallback}</>;

    return (
        <img
            src={logo}
            onError={() => setFailed(true)}
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
            }}
        />
    );
}

// Holds the avatar so we can overlay a state badge in its corner.
const AvatarWrap = styled.div`
    position: relative;
    flex-shrink: 0;
    display: flex;
`;

// Small corner badge (e.g. lock) layered over the brand logo.
const LockBadge = styled.div`
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--secondary-header);
    display: grid;
    place-items: center;
    color: var(--foreground);
`;

// Search field sitting above the directory grid. Mirrors the site's input
// styling (secondary background, accent focus ring) and stays full-width on
// narrow screens while capping to the grid width on desktop.
const SearchWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 650px;
    margin: 0 auto 20px;

    input {
        padding-left: 42px;
        padding-right: 42px;
    }

    .search-icon {
        position: absolute;
        left: 14px;
        color: var(--tertiary-foreground);
        pointer-events: none;
    }

    .clear {
        position: absolute;
        right: 12px;
        display: flex;
        cursor: pointer;
        color: var(--tertiary-foreground);
        transition: color 0.1s ease-in-out;

        &:hover {
            color: var(--foreground);
        }
    }
`;

const NoResults = styled.div`
    color: var(--tertiary-foreground);
    font-size: 14px;
    text-align: center;
    margin-bottom: 30px;
`;

// Tab strip living in the page header, letting the user switch between the
// community directory ("Home") and the upcoming promos surface.
const TabBar = styled.div`
    display: flex;
    align-items: stretch;
    gap: 24px;
    height: 100%;
`;

const Tab = styled.div<{ active: boolean }>`
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
    color: ${(props) =>
        props.active ? "var(--foreground)" : "var(--tertiary-foreground)"};
    transition: color 0.1s ease-in-out;

    &:hover {
        color: var(--foreground);
    }

    &::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 2px;
        border-radius: 2px;
        background: var(--accent);
        opacity: ${(props) => (props.active ? 1 : 0)};
        transition: opacity 0.1s ease-in-out;
    }
`;

// Small accent "NEW" pill shown on the Promos tab.
const NewChip = styled.span`
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 3px 6px;
    border-radius: 6px;
    color: var(--accent-contrast, #11171c);
    background: var(--accent);
`;


// Holds the circular loader in the content area while the directory loads,
// so the header and search bar above it stay mounted.
const LoaderWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-top: 48px;
`;

const CACHE_KEY = "server_list_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Safe localStorage wrapper
const safeStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("Failed to read from localStorage:", e);
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn("Failed to write to localStorage:", e);
        }
    },
};

const Home: React.FC = () => {
    const client = useClient();
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState<string>("");

    // Drive the active tab from the URL (?tab=promos) rather than local state,
    // so a refresh or navigating into a community (e.g. via a promo's join
    // button) and pressing back both restore the Promos view instead of
    // dropping the user back on Home.
    const history = useHistory();
    const location = useLocation();
    const tab: "home" | "promos" =
        new URLSearchParams(location.search).get("tab") === "promos"
            ? "promos"
            : "home";
    const setTab = (next: "home" | "promos") =>
        history.replace(next === "promos" ? "/?tab=promos" : "/");

    // On mobile the overlapping panels default to the sidebar; when landing on
    // the Promos tab (e.g. after a refresh), bring the content panel into view
    // so the user sees the promos rather than the channel list. Deferred to the
    // next frame so the panel container has laid out before we scroll it.
    useEffect(() => {
        if (!isTouchscreenDevice || tab !== "promos") return;
        const raf = requestAnimationFrame(() => {
            const panels = document.querySelector("#app > div > div > div");
            // No right panel on home, so the max scroll position lands on the
            // main (content) panel.
            panels?.scrollTo({ left: panels.scrollWidth, behavior: "auto" });
        });
        return () => cancelAnimationFrame(raf);
    }, [tab]);

    // Filter by name or description, case-insensitive.
    const filteredServers = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return servers;
        return servers.filter(
            (s) =>
                s.name?.toLowerCase().includes(q) ||
                s.description?.toLowerCase().includes(q),
        );
    }, [servers, query]);

    const cacheAndSetServers = (data: Server[]) => {
        // Sort the servers by sortorder before caching
        const sortedData = [...data].sort(
            (a, b) => (a.sortorder || 0) - (b.sortorder || 0),
        );

        const cacheData: CachedData = {
            timestamp: Date.now(),
            data: sortedData,
        };

        safeStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        setServers(sortedData);
        setLoading(false);
    };

    const fetchAndCacheData = async () => {
        // Both directory endpoints are now served by the Rust backend
        // (BACKEND_API_BASE, absolute URL — bypasses the dev `/api` proxy) and
        // require auth via the `x-session-token` header.
        const sessionToken =
            typeof client.session === "string"
                ? client.session
                : (client.session as any)?.token ?? "";
        const authHeaders = { "x-session-token": sessionToken };

        const serversUrl = `${BACKEND_API_BASE}/directory/servers`;
        // The backend clamps pageSize to a max of 100 and ignores the legacy
        // `limit` param, so fetch every page to get all communities for the
        // logo merge below (preserves the old limit=200 "fetch everything").
        const fetchAllCommunities = async () => {
            const first = await fetch(
                `${BACKEND_API_BASE}/directory/communities?pageSize=100`,
                { headers: authHeaders },
            );
            if (!first.ok) return [];
            const firstJson = await first.json();
            const items = (list: any) =>
                Array.isArray(list) ? list : list?.items ?? [];
            const all = items(firstJson.data);
            const totalPages =
                firstJson.meta?.pagination?.totalPages ?? 1;
            for (let page = 2; page <= totalPages; page++) {
                const res = await fetch(
                    `${BACKEND_API_BASE}/directory/communities?pageSize=100&page=${page}`,
                    { headers: authHeaders },
                );
                if (!res.ok) break;
                const json = await res.json();
                all.push(...items(json.data));
            }
            return all;
        };

        try {
            const [serversRes, communitiesList] = await Promise.all([
                fetch(serversUrl, { headers: authHeaders }),
                fetchAllCommunities(),
            ]);

            if (!serversRes.ok) {
                throw new Error(`Servers request failed with status ${serversRes.status}`);
            }

            const serversJson = await serversRes.json();
            if (!serversJson?.success || !Array.isArray(serversJson.data)) {
                throw new Error("Unexpected servers response shape");
            }

            let servers: Server[] = serversJson.data;

            // Merge logos from communities API
            {
                const logoByServerId: Record<string, string> = {};
                for (const c of communitiesList) {
                    if (c.serverId && c.logo) {
                        logoByServerId[c.serverId] = c.logo;
                    }
                }

                const autumnUrl = client.configuration?.features.autumn?.url ||
                    "https://peptide.chat/autumn";

                servers = servers.map((s) => {
                    const logoId = logoByServerId[s.id];
                    return logoId
                        ? { ...s, logo: `${autumnUrl}/icons/${logoId}?max_side=256` }
                        : s;
                });

            }

            cacheAndSetServers(servers);
        } catch (err) {
            console.error("Failed to load the community directory:", err);
            setError("Failed to load communities. Please try again later.");
            setLoading(false);
        }
    };

    useEffect(() => {
        const getCachedOrFetchData = async () => {
            try {
                const cachedData = safeStorage.getItem(CACHE_KEY);

                if (cachedData) {
                    const parsed: CachedData = JSON.parse(cachedData);
                    const isExpired =
                        Date.now() - parsed.timestamp > CACHE_DURATION;

                    if (!isExpired && Array.isArray(parsed.data)) {
                        setServers(parsed.data);
                        setLoading(false);
                        return;
                    }
                }
            } catch (err) {
                console.warn("Error reading cache:", err);
                // Continue to fetch fresh data if cache read fails
            }

            await fetchAndCacheData();
        };

        getCachedOrFetchData();
    }, []);

    useEffect(() => {
        for (const s of servers) {
            if (s.logo) new Image().src = s.logo;
        }
    }, [servers]);

    const renderServerButton = (server: Server) => {
        const isServerJoined = client.servers.get(server.id);
        const linkTo = isServerJoined
            ? `/server/${server.id}`
            : `/invite/${server.inviteCode}`;

        // Brand identity (logo) lives in the icon slot, independent of state.
        // Prefer the directory logo, then the joined server's own icon.
        let avatarUrl: string | undefined = server.logo;
        if (!avatarUrl && isServerJoined) {
            avatarUrl =
                isServerJoined.generateIconURL({ max_side: 256 }) ?? undefined;
        }

        const fallbackGlyph = server.disabled ? (
            <Lock size={32} />
        ) : (
            <MessageAdd size={32} />
        );

        const avatar = avatarUrl ? (
            <ServerIcon logo={avatarUrl} size={32} fallback={fallbackGlyph} />
        ) : (
            fallbackGlyph
        );

        // Keep the logo for locked servers, but mark it with a corner lock badge.
        const icon =
            server.disabled && avatarUrl ? (
                <AvatarWrap>
                    {avatar}
                    <LockBadge>
                        <Lock size={10} />
                    </LockBadge>
                </AvatarWrap>
            ) : (
                avatar
            );

        // Right-side action encodes the user's relationship to the server:
        // locked → lock, joined → enter (chevron), otherwise → join (+).
        const action = server.disabled ? (
            <Lock size={20} />
        ) : isServerJoined ? (
            "chevron"
        ) : (
            <MessageAdd size={20} />
        );

        const buttonContent = (
            <CategoryButton
                action={action}
                icon={icon}
                description={server.description}>
                {server.name}
            </CategoryButton>
        );

        let content = server.disabled ? (
            <DisabledWrapper>{buttonContent}</DisabledWrapper>
        ) : (
            <Link to={linkTo}>{buttonContent}</Link>
        );

        if (server.showcolor && server.showcolor.trim()) {
            content = <ColorWrapper color={server.showcolor}>{content}</ColorWrapper>;
        } else if (server.new) {
            content = <NewServerWrapper>{content}</NewServerWrapper>;
        }

        return content;
    };

    return (
        <div className={styles.home}>
            <Overlay>
                <div className="content">
                    <PageHeader icon={<></>} withTransparency>
                        <TabBar>
                            <Tab
                                active={tab === "home"}
                                onClick={() => setTab("home")}>
                                <Text id="app.navigation.tabs.home" />
                            </Tab>
                            <Tab
                                active={tab === "promos"}
                                onClick={() => setTab("promos")}>
                                Promos
                                <NewChip>New</NewChip>
                            </Tab>
                        </TabBar>
                    </PageHeader>
                    <div className={styles.homeScreen}>
                        {tab === "home" ? (
                            <>
                                <SearchWrapper>
                                    <Search
                                        size={18}
                                        className="search-icon"
                                    />
                                    <InputBox
                                        palette="secondary"
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.currentTarget.value)
                                        }
                                        placeholder="Search communities…"
                                    />
                                    {query && (
                                        <div
                                            className="clear"
                                            onClick={() => setQuery("")}>
                                            <X size={18} />
                                        </div>
                                    )}
                                </SearchWrapper>
                                {loading ? (
                                    <LoaderWrapper>
                                        <Preloader type="ring" />
                                    </LoaderWrapper>
                                ) : error ? (
                                    <NoResults>{error}</NoResults>
                                ) : (
                                    <>
                                        <div className={styles.actions}>
                                            {filteredServers.map(
                                                renderServerButton,
                                            )}
                                        </div>
                                        {filteredServers.length === 0 && (
                                            <NoResults>
                                                No communities found.
                                            </NoResults>
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <Promos />
                        )}
                    </div>
                </div>
            </Overlay>
        </div>
    );
};

export default observer(Home);
