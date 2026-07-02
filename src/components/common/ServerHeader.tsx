import { Check } from "@styled-icons/boxicons-regular";
import { Cog } from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import { Server } from "revolt.js";
import styled, { css } from "styled-components/macro";

import { Text } from "preact-i18n";

import { IconButton } from "@revoltchat/ui";

import { modalController } from "../../controllers/modals/ModalController";
import Tooltip from "./Tooltip";

interface Props {
    server: Server;
    background?: boolean;
}

const ServerBanner = styled.div<Omit<Props, "server">>`
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;

    background-size: cover;
    background-repeat: norepeat;
    background-position: center center;

    /* The server header is a rounded card floating at
       the top of the sidebar sheet (radius matches the panel scale, 16px). */
    margin: var(--space-2);
    border-radius: 16px;
    overflow: hidden;

    ${(props) =>
        props.background
            ? css`
                  height: 120px;

                  /* The name sits directly on the banner image
                     (no gradient band); a soft text shadow keeps it legible. */
                  .container {
                      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
                  }
              `
            : css`
                  background-color: var(--secondary-header);
              `}

    .container {
        height: var(--header-height);

        display: flex;
        align-items: center;
        padding: 0 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        gap: 8px;

        .title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex-grow: 1;

            cursor: pointer;
            color: var(--foreground);
        }
    }
`;

export default observer(({ server }: Props) => {
    const bannerURL = server.generateBannerURL({ width: 480 });

    return (
        <ServerBanner
            background={typeof bannerURL !== "undefined"}
            style={{
                backgroundImage: bannerURL ? `url('${bannerURL}')` : undefined,
            }}>
            <div className="container">
                {server.flags && server.flags & 1 ? (
                    <Tooltip content="Verified GB" placement={"bottom-start"}>
                        <img
                            src="/assets/badges/verified-GB.png"
                            width="20"
                            height="20"
                        />
                    </Tooltip>
                ) : undefined}
                {server.flags && server.flags & 2 ? (
                    <Tooltip
                        content="Verified Vendor"
                        placement={"bottom-start"}>
                        <img
                            src="/assets/badges/verified-vendor.png"
                            width="20"
                            height="20"
                        />
                    </Tooltip>
                ) : undefined}
                <a
                    className="title"
                    onClick={() =>
                        modalController.push({ type: "server_info", server })
                    }>
                    {server.name}
                </a>
                {server.havePermission("ManageServer") && (
                    <Link to={`/server/${server._id}/settings`}>
                        <IconButton>
                            {/* Matches the reference header settings glyph
                                (24px). */}
                            <Cog size={24} />
                        </IconButton>
                    </Link>
                )}
            </div>
        </ServerBanner>
    );
});
