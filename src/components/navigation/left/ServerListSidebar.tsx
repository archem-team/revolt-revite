import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import styled from "styled-components/macro";

import { useCallback } from "preact/hooks";

import { ServerList } from "@revoltchat/ui";

import { useApplicationState } from "../../../mobx/State";

import { useClient } from "../../../controllers/client/ClientController";
import { modalController } from "../../../controllers/modals/ModalController";
import { IS_REVOLT } from "../../../version";

/* Elevation model: the server rail sits on the LIGHTEST surface
   (container-high; painted at the layout root), so the sidebar
   sheet's rounded left corners read against it. */
const RailBase = styled.div`
    display: flex;
    height: 100%;
    flex-shrink: 0;
    background: var(--primary-header);

    /* The list's bottom fade (above the settings button) must fade into the
       rail surface, not the canvas colour it defaults to. */
    div[class*="Shadow"] div {
        background: linear-gradient(
            to bottom,
            transparent,
            var(--primary-header)
        ) !important;
    }
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
                showDiscovery={IS_REVOLT}
            />
        </RailBase>
    );
});
