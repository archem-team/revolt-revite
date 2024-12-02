import { Shield } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";

import { Localizer, Text } from "preact-i18n";

import Tooltip from "../Tooltip";

enum Badges {
    Developer = 1, //Developer
    Translator = 2, //Clown
    Supporter = 4, //Supporter
    ResponsibleDisclosure = 8, //Top Contributor
    Founder = 16, //Administrator
    PlatformModeration = 32, //Verified Manufacturer
    ActiveSupporter = 64,
    Paw = 128, //🦊
    EarlyAdopter = 256, //Trusted Seller
    ReservedRelevantJokeBadge1 = 512,
    ReservedRelevantJokeBadge2 = 1024,
}

const BadgesBase = styled.div`
    gap: 8px;
    display: flex;
    flex-direction: row;

    img {
        width: 24px;
        height: 24px;
    }
`;

interface Props {
    badges: number;
    uid?: string;
}

export default function UserBadges({ badges, uid }: Props) {
    return (
        <BadgesBase>
            <Localizer>
                {badges & Badges.Founder ? (
                    <Tooltip content="Administrator">
                        <img src="/assets/badges/administrator.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.Developer ? (
                    <Tooltip content="Developer">
                        <img src="/assets/badges/developer.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.Translator ? (
                    <Tooltip content="Clown">
                        <img
                            src="/assets/badges/clown.png"
                            style={{
                                cursor: "pointer",
                            }}
                            // onClick={() => {
                            //     window.open(
                            //         "https://weblate.insrt.uk/projects/revolt/web-app/",
                            //         "_blank",
                            //     );
                            // }}
                        />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.EarlyAdopter ? (
                    <Tooltip content="Trusted Seller">
                        <img src="/assets/badges/trusted-seller.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.PlatformModeration ? (
                    <Tooltip content="Verified Manufacturer">
                        <img src="/assets/badges/verified-manufacturer.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.ResponsibleDisclosure ? (
                    <Tooltip content="Top Contributor">
                        <img src="/assets/badges/top-contributor.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.Supporter ? (
                    <Tooltip content="Supporter">
                        <img
                            src="/assets/badges/supporter.png"
                            style={{
                                cursor: "pointer",
                            }}
                            // onClick={() => {
                            //     window.open(
                            //         "https://insrt.uk/donate",
                            //         "_blank",
                            //     );
                            // }}
                        />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.ReservedRelevantJokeBadge1 ? (
                    <Tooltip content="Karen">
                        <img src="/assets/badges/karen.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.ReservedRelevantJokeBadge2 ? (
                    <Tooltip content="Verified GB">
                        <img src="/assets/badges/verified-GB.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
                {badges & Badges.Paw ? (
                    <Tooltip content="Verified Vendor">
                        <img src="/assets/badges/verified-vendor.png" />
                    </Tooltip>
                ) : (
                    <></>
                )}
            </Localizer>
        </BadgesBase>
    );
}
