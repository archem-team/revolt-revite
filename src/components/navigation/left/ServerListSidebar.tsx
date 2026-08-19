import { observer } from "mobx-react-lite";
import { Bell } from "@styled-icons/boxicons-regular";
import { useParams } from "react-router-dom";
import styled from "styled-components/macro";

import { useCallback } from "preact/hooks";

import { ServerList } from "@revoltchat/ui";

import { useApplicationState } from "../../../mobx/State";

import { useClient } from "../../../controllers/client/ClientController";
import { modalController } from "../../../controllers/modals/ModalController";
import { isTouchscreenDevice } from "../../../lib/isTouchscreenDevice";

/* Elevation model: the server rail sits on the LIGHTEST surface
   (container-high; painted at the layout root), so the sidebar
   sheet's rounded left corners read against it. */
const RailBase = styled.div`
    display: flex;
    height: 100%;
    min-height: 0;
    flex-shrink: 0;
    background: var(--nav-rail);
    position: relative;

    /* ServerList contains a Virtuoso scroller followed by the fixed settings
       button. Give that nested flex column a definite, shrinkable viewport.
       Without this boundary iOS WebKit can lose the virtual list while the
       compact panel grid moves the rail off-screen and back, leaving only the
       non-virtualized settings button visible. */
    > div {
        height: 100%;
        min-height: 0;
    }

    .list {
        min-height: 0;
    }

    /* The list's bottom fade (above the settings button) must fade into the
       rail surface, not the canvas colour it defaults to. */
    div[class*="Shadow"] div {
        background: linear-gradient(
            to bottom,
            transparent,
            var(--nav-rail)
        ) !important;
    }
`;

const NotificationButton = styled.button`
    position: absolute;
    z-index: 5;
    right: 7px;
    bottom: 58px;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: var(--foreground);
    background: var(--secondary-background);
    cursor: pointer;

    b { position: absolute; top: -3px; right: -3px; min-width: 17px; height: 17px; padding: 0 3px; border-radius: 999px; background: var(--accent); color: var(--accent-contrast); font-size: 10px; display: grid; place-items: center; }
`;

/**
 * Server list sidebar shim component
 */
export default observer(() => {
    const client = useClient();
    const state = useApplicationState();
    const { server: server_id } = useParams<{ server?: string }>();

    const createServer = useCallback(
        () =>
            modalController.push({
                type: "create_server",
            }),
        [],
    );

    return (
        <RailBase>
            <ServerList
                client={client}
                active={server_id}
                createServer={createServer}
                permit={state.notifications}
                home={state.layout.getLastHomePath}
                servers={state.ordering.orderedServers}
                reorder={state.ordering.reorderServer}
                showDiscovery={false}
            />
            {!isTouchscreenDevice && (
                <NotificationButton aria-label="Open notifications" onClick={() => state.notificationCenter.setDrawerOpen(true)}>
                    <Bell size={22} />
                    {state.notificationCenter.unreadCount > 0 && <b>{state.notificationCenter.unreadCount > 99 ? "99+" : state.notificationCenter.unreadCount}</b>}
                </NotificationButton>
            )}
        </RailBase>
    );
});
