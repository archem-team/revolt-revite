import {
    Home as HomeIcon,
    MessageDots,
    MessageAdd,
    Lock,
} from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import styled from "styled-components/macro";

import styles from "./Home.module.scss";
import { Text } from "preact-i18n";

import { CategoryButton } from "@revoltchat/ui";

import wideSVG from "/assets/wide.svg";

import { PageHeader } from "../../components/ui/Header";
import { useClient } from "../../controllers/client/ClientController";

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

const DisabledButtonWrapper = styled.div`
    opacity: 0.5;
    pointer-events: none;
`;

export default observer(() => {
    const client = useClient();

    const servers = [
        {
            id: "01J544PT4T3WQBVBSDK3TBFZW7",
            name: "PepChat Official",
            description:
                "Get your questions answered and stay up-to-date with the state of the project.",
            inviteCode: "pepchatdiscover",
            disabled: false,
        },
        {
            id: "01J5ZQMJSQ5AFZJJ3S204JK5Q4",
            name: "Elite Group Buy (EGB)",
            description: "Group buy peptides, amino blends & more.",
            inviteCode: "elitegroupbuydiscover",
            disabled: false,
        },
        {
            id: "01J545CBXQRWZZAASZQ6THKE96",
            name: "Qingdao Sigma Chemical (QSC)",
            description:
                "China wholesale bioactive compounds. (International, US, EU, Canada and Australia domestic)",
            inviteCode: "qscdiscover",
            disabled: false,
        },
        {
            id: "01J63A8HQ8S10MM4B3K85VMYBW",
            name: "Wonderland",
            description: "Peptide life social group.",
            inviteCode: "wonderlanddiscover",
            disabled: false,
        },
        {
            id: "01J5VPXSS0EK69QD69RX6SKZHW",
            name: "Kimmes Korner",
            description: "Peptide group buys.",
            inviteCode: "kimmeskornerdiscover",
            disabled: false,
        },
        {
            id: "01J5Z5QBQWREPZZPMVKJNCBDP2",
            name: "Joyous",
            description: "Peptide group buys.",
            inviteCode: "joyousdiscover",
            disabled: false,
        },
        {
            id: "01J6FNC5667A6RWV1SK4FMP19S",
            name: "Rabbit Hole Research",
            description:
                "A peptide research collective focused on community, education, and facilitating group buys.",
            inviteCode: "rabbitholediscover",
            disabled: false,
        },
        {
            id: "01J6DDFWNT3SFKVQHK8J29RPXE",
            name: "Johnny 5",
            description:
                "Amazing community of helpful people. Focus on weight loss group buys.",
            inviteCode: "johnny5discover",
            disabled: false,
        },
        {
            id: "01J64CC6710N7CCWBBT625VXQ3",
            name: "The Raven Nest",
            description:
                "Group buys, protocols, social, and all things peptides.",
            inviteCode: "ravennestdiscover",
            disabled: false,
        },
        {
            id: "01J6ZRS52BA42BJFVT0M4WY0Q6",
            name: "Deb's PepTalk",
            description: "Peptide GB's, education & ramblings.",
            inviteCode: "debspeptalkdiscover",
            disabled: false,
        },
        {
            id: "01J6ZT36PMKPEV8B60YCS23NE1",
            name: "Sunny Solutions",
            description:
                "Pep Ancillaries. BAC water, Humapen, Filter kits & more.",
            inviteCode: "sunnysolutionsdiscover",
            disabled: false,
        },
        {
            id: "01J6DHAK4RH0H6QK35CZ4G3ZSW",
            name: "Cousin Eddie's Corner",
            description: "Peptides with a dose of humour!",
            inviteCode: "cousineddiescornerdiscover",
            disabled: false,
        },
        {
            id: "01J5TQYA639STTEX7SH5KXC96M",
            name: "Joe Lu's Hideout",
            description: "Peptide group buys.",
            inviteCode: "placeholder",
            disabled: true,
        },
        {
            id: "placeholder",
            name: "HYB",
            description: "China wholesale direct.",
            inviteCode: "placeholder",
            disabled: true,
        },
        {
            id: "placeholder",
            name: "Polypeptide Universe",
            description: "The science of peptides in depth.",
            inviteCode: "placeholder",
            disabled: true,
        },
    ];

    const renderServerButton = (server) => {
        const isServerJoined = client.servers.get(server.id);
        const linkTo = isServerJoined
            ? `/server/${server.id}`
            : `/invite/${server.inviteCode}`;

        const buttonContent = (
            <CategoryButton
                key={server.id}
                action={server.disabled ? undefined : "chevron"}
                icon={
                    server.disabled ? (
                        <Lock size={32} />
                    ) : isServerJoined ? (
                        <MessageDots size={32} />
                    ) : (
                        <MessageAdd size={32} />
                    )
                }
                description={server.description}>
                {server.name}
            </CategoryButton>
        );

        if (server.disabled) {
            return (
                <DisabledButtonWrapper>{buttonContent}</DisabledButtonWrapper>
            );
        } else {
            return (
                <Link to={linkTo} key={server.id}>
                    {buttonContent}
                </Link>
            );
        }
    };

    return (
        <div className={styles.home}>
            <Overlay>
                <div className="content">
                    <PageHeader icon={<HomeIcon size={24} />} withTransparency>
                        <Text id="app.navigation.tabs.home" />
                    </PageHeader>
                    <div className={styles.homeScreen}>
                        <h3>Welcome to PepChat</h3>
                        <div className={styles.actions}>
                            {servers.map(renderServerButton)}
                        </div>
                    </div>
                </div>
            </Overlay>{" "}
        </div>
    );
});
