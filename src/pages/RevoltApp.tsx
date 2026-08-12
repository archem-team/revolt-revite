import { Docked, OverlappingPanels, ShowIf } from "react-overlapping-panels";
import { Switch, Route, useLocation, Link, Redirect } from "react-router-dom";
import styled, { css } from "styled-components/macro";

import { useEffect, useState } from "preact/hooks";

import ContextMenus from "../lib/ContextMenus";
import { isTouchscreenDevice } from "../lib/isTouchscreenDevice";

import { Titlebar } from "../components/native/Titlebar";
import BottomNavigation from "../components/navigation/BottomNavigation";
import LeftSidebar from "../components/navigation/LeftSidebar";
import RightSidebar from "../components/navigation/RightSidebar";
import { useSystemAlert } from "../updateWorker";
import CompoundBaySso from "./CompoundBaySso";
import Open from "./Open";
import Channel from "./channels/Channel";
import Developer from "./developer/Developer";
import Friends from "./friends/Friends";
import Home from "./home/Home";
import HomeNew from "./home/HomeNew";
import NotificationCenterPage, { NotificationDrawer } from "./notifications/NotificationCenter";
import InviteBot from "./invite/InviteBot";
import ChannelSettings from "./settings/ChannelSettings";
import ServerSettings from "./settings/ServerSettings";
import Settings from "./settings/Settings";

const COMPACT_LAYOUT_QUERY = "(max-width: 960px)";

const AppContainer = styled.div`
    background-size: cover !important;
    background-position: center center !important;

    /* The canvas the floating panels sit on — themed, so it follows the
       active preset instead of the static token background. */
    background-color: var(--background);
`;

export const StatusBar = styled.div`
    height: 40px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    //gap: 14px;
    gap: 8px;

    user-select: none;

    .button {
        padding: 5px;
        border: 1px solid white;
        border-radius: var(--border-radius);
    }

    a {
        cursor: pointer;
        color: var(--foreground);
    }

    .title {
        flex-grow: 1;
        text-align: center;
    }

    .actions {
        gap: 12px;
        display: flex;
        padding-right: 4px;
    }
`;

const Routes = styled.div.attrs({ "data-component": "routes" })<{
    borders: boolean;
    panel: boolean;
    compact: boolean;
}>`
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: flex;
    position: relative;
    flex-direction: column;

    /* Most pages are a floating rounded panel on the
       canvas. Channel pages manage their own panel (the chat card) so the
       member column can sit directly on the canvas beside it. */
    background: ${(props) =>
        props.panel ? "var(--primary-background)" : "transparent"};

    ${(props) =>
        !props.compact &&
        props.panel &&
        css`
            margin: var(--space-2);
            /* The main content surface uses radius "xl" (28px). */
            border-radius: 28px;
        `}

    overflow: hidden;
`;

export default function App() {
    const path = useLocation().pathname;
    const fixedBottomNav =
        path === "/" ||
        path === "/home" ||
        path === "/settings" ||
        path.startsWith("/friends") ||
        path.startsWith("/discover") ||
        path.startsWith("/notifications");
    const inChannel = path.includes("/channel");
    const inServer = path.includes("/server");
    // Pages that draw their own header-on-canvas + rounded panel.
    const inFriends = path.startsWith("/friends");
    const inSpecial =
        (path.startsWith("/friends") && isTouchscreenDevice) ||
        path.startsWith("/invite") ||
        path.includes("/settings") ||
        path.startsWith("/notifications");

    const alert = useSystemAlert();
    const [statusBar, setStatusBar] = useState(false);
    const [compactLayout, setCompactLayout] = useState(
        () =>
            isTouchscreenDevice ||
            (typeof window !== "undefined" &&
                window.matchMedia(COMPACT_LAYOUT_QUERY).matches),
    );
    useEffect(() => setStatusBar(true), [alert]);
    useEffect(() => {
        const media = window.matchMedia(COMPACT_LAYOUT_QUERY);
        const updateLayout = () =>
            setCompactLayout(isTouchscreenDevice || media.matches);

        updateLayout();
        if (media.addEventListener) {
            media.addEventListener("change", updateLayout);
        } else {
            media.addListener(updateLayout);
        }
        return () => {
            if (media.removeEventListener)
                media.removeEventListener("change", updateLayout);
            else media.removeListener(updateLayout);
        };
    }, []);

    return (
        <>
            {alert && statusBar && (
                <StatusBar>
                    <div className="title">{alert.text}</div>
                    <div className="actions">
                        {alert.actions?.map((action) =>
                            action.type === "internal" ? (
                                <Link to={action.href}>
                                    <div className="button">{action.text}</div>
                                </Link>
                            ) : action.type === "external" ? (
                                <a
                                    href={action.href}
                                    target="_blank"
                                    rel="noreferrer">
                                    <div className="button">{action.text}</div>{" "}
                                </a>
                            ) : null,
                        )}
                        {alert.dismissable !== false && (
                            <a onClick={() => setStatusBar(false)}>
                                <div className="button">{"Dismiss"}</div>
                            </a>
                        )}
                    </div>
                </StatusBar>
            )}
            <AppContainer>
                {window.isNative && !window.native.getConfig().frame && (
                    <Titlebar />
                )}
                <OverlappingPanels
                    width="100%"
                    height={
                        (alert && statusBar ? "calc(" : "") +
                        (window.isNative && !window.native.getConfig().frame
                            ? "calc(var(--app-height) - var(--titlebar-height))"
                            : "var(--app-height)") +
                        (alert && statusBar ? " - 40px)" : "")
                    }
                    leftPanel={
                        inSpecial
                            ? undefined
                            : { width: 290, component: <LeftSidebar /> }
                    }
                    rightPanel={
                        !inSpecial && inChannel
                            ? { width: 236, component: <RightSidebar /> }
                            : undefined
                    }
                    bottomNav={{
                        component: <BottomNavigation />,
                        showIf: fixedBottomNav ? ShowIf.Always : ShowIf.Left,
                        height: 50,
                    }}
                    docked={compactLayout ? Docked.None : Docked.Left}>
                    <Routes
                        borders={inServer}
                        compact={compactLayout}
                        panel={!(inChannel || inServer || inFriends)}>
                        <Switch>
                            <Route
                                path="/server/:server/channel/:channel/settings/:page"
                                component={ChannelSettings}
                            />
                            <Route
                                path="/server/:server/channel/:channel/settings"
                                component={ChannelSettings}
                            />
                            <Route
                                path="/server/:server/settings/:page"
                                component={ServerSettings}
                            />
                            <Route
                                path="/server/:server/settings"
                                component={ServerSettings}
                            />
                            <Route
                                path="/channel/:channel/settings/:page"
                                component={ChannelSettings}
                            />
                            <Route
                                path="/channel/:channel/settings"
                                component={ChannelSettings}
                            />

                            <Route
                                path="/channel/:channel/:message"
                                component={Channel}
                            />
                            <Route
                                path="/server/:server/channel/:channel/:message"
                                component={Channel}
                            />

                            <Route
                                path="/server/:server/channel/:channel"
                                component={Channel}
                            />
                            <Route path="/server/:server" component={Channel} />
                            <Route
                                path="/channel/:channel"
                                component={Channel}
                            />

                            <Route
                                path="/settings/:page"
                                component={Settings}
                            />
                            <Route path="/settings" component={Settings} />

                            <Route path="/discover">
                                <Redirect to="/home" />
                            </Route>
                            <Route
                                path="/compound-bay"
                                component={CompoundBaySso}
                            />

                            <Route path="/dev" component={Developer} />
                            <Route path="/friends" component={Friends} />
                            <Route path="/open/:id" component={Open} />
                            <Route path="/bot/:id" component={InviteBot} />
                            <Route path="/home" component={HomeNew} />
                            <Route path="/notifications" component={NotificationCenterPage} />
                            <Route path="/" component={Home} />
                        </Switch>
                    </Routes>
                    <ContextMenus />
                </OverlappingPanels>
                {!isTouchscreenDevice && <NotificationDrawer />}
            </AppContainer>
        </>
    );
}
