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
            id: "01J72VR94J6722AHF1MD33DB4F",
            name: "New Beginnings Research",
            description:
                "Peptide community focused on education, research, and organized group buys.",
            inviteCode: "newbeginningsdiscover",
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
            id: "01J7E2NW9WXSHWJR7B75CDB2AC",
            name: "AOB",
            description: "Handmade organic beauty products",
            inviteCode: "aobdiscover",
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
            id: "01J6RS5RR3YKPMW09M7D71BTD2",
            name: "HYB",
            description: "China wholesale direct.",
            inviteCode: "hybdiscover",
            disabled: false,
        },
        {
            id: "01J740MT75NC05F6VB9EJ4Y115",
            name: "Royal Peptides",
            description:
                "USA domestic wholesale vendor with 3rd party tested kits.",
            inviteCode: "royalpeptidesdiscover",
            disabled: false,
        },
        {
            id: "01J78Z1C1XW209S5YSQZMPS0E4",
            name: "The Pep Planner",
            description:
                "Planner to keep track of daily pins, peptide information, orders & more.",
            inviteCode: "thepepplannerdiscover",
            disabled: false,
        },
        {
            id: "01J74BC8PFE9XBDX05J3Y9R9PV",
            name: "Monkey Peps",
            description:
                "A Peptide Community for support, sourcing and group testing.",
            inviteCode: "monkeypepsdiscover",
            disabled: false,
        },
        {
            id: "01J7EGW77XE2GSJGPR87MQXZW4",
            name: "SRY-LAB",
            description:
                "Peptide factory in China. Wholesale, retail and customization.",
            inviteCode: "srylabdiscover",
            disabled: false,
        },
        {
            id: "01J7NZR6KTG9BTRMNPCQQJ1VES",
            name: "Shanghai Nexa Pharma",
            description:
                "Ship from domestic USA 3-5 business days. Custom batch manufacture MOQ 300 vials.",
            inviteCode: "snpdiscover",
            disabled: false,
        },
        {
            id: "01J72F71TZWQFEBNSSFBMSDZK1",
            name: "Angel Shanghai Chem (ASC)",
            description: "Manufacturer of Peptides",
            inviteCode: "ascdiscover",
            disabled: false,
        },
        {
            id: "01J72C64KX97MP5K6ABDRP62P4",
            name: "The Hood",
            description:
                "Welcome to the neighbour-hood. A magical place full of potions and peps.",
            inviteCode: "thehooddiscover",
            disabled: false,
        },
        {
            id: "01J7RF37VXVMTS55K1C18PQ2HY",
            name: "Peppy Princess",
            description: "Beauty and skin-care experts.",
            inviteCode: "peppyprincessdiscover",
            disabled: false,
        },
        {
            id: "01J71Z3FVMJVCVCD8X4WGVR1SF",
            name: "JoLynn's World",
            description: "Pep talk and group buys.",
            inviteCode: "jolynnsworlddiscover",
            disabled: false,
        },
        {
            id: "01J84NMVTR2NQVHV9FQ1VR6YBN",
            name: "Henan Tirzepa Peptides",
            description:
                "Factory direct wholesale of peptide products, door-to-door delivery.",
            inviteCode: "henantirzepadiscover",
            disabled: false,
        },
        {
            id: "01J8CQBJRR8EYVQFM7ARD1P11P",
            name: "Peptopia",
            description:
                "Discussions about safe use, sourcing, testing, & more. GBs for Tirz, Reta, Sema, Cagri & more.",
            inviteCode: "peptopiadiscover",
            disabled: false,
        },
        {
            id: "01J8GZYC66E5T7PZNYVHD4DC6V",
            name: "Nantong Guangyuan Chemical (GYC)",
            description:
                "High quality peptides with 99% purity from manufacturers.",
            inviteCode: "gycdiscover",
            disabled: false,
        },
        {
            id: "01J9QDPBRHTCBV4DJ15G28393H",
            name: "Uther Pharmaceutical Peptide",
            description: "Chemistry changes the world.",
            inviteCode: "uppdiscover",
            disabled: false,
        },
        {
            id: "01J9R4AP31FG4VX4FTZTSMWHFF",
            name: "Tianjin Cangtu",
            description:
                "Direct factory supply with 99%+ purity and safe delivery.",
            inviteCode: "tianjincangtudiscover",
            disabled: false,
        },
        {
            id: "01JAJBYY4N7ZATDG446M4XGTMA",
            name: "Shanghai Sigma Audley",
            description:
                "China peptides, steroid tablets, oil, and APIs supplier.",
            inviteCode: "shanghaisigmaaudleydiscover",
            disabled: false,
        },
        {
            id: "01J5TQYA639STTEX7SH5KXC96M",
            name: "Joe Lu's Hideout",
            description: "Peptide group buys.",
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
