import {
    Home as HomeIcon,
    MessageDots,
    MessageAdd,
    Lock,
} from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import Papa from "papaparse";
import React, { useEffect, useState } from "react";
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

interface Server {
    id: string;
    name: string;
    description: string;
    inviteCode: string;
    disabled: boolean;
}

const Home: React.FC = () => {
    const client = useClient();
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const csvUrl =
            "https://docs.google.com/spreadsheets/d/e/2PACX-1vRY41D-NgTE6bC3kTN3dRpisI-DoeHG8Eg7n31xb1CdydWjOLaphqYckkTiaG9oIQSWP92h3NE-7cpF/pub?gid=0&single=true&output=csv";

        Papa.parse<Server>(csvUrl, {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: (result) => {
                setServers(result.data);
                setLoading(false);
            },
            error: (err) => {
                console.error("Error parsing CSV:", err);
                setError("Failed to load server data.");
                setLoading(false);
            },
        });
    }, []);

    const renderServerButton = (server: Server) => {
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
                <DisabledButtonWrapper key={server.id}>
                    {buttonContent}
                </DisabledButtonWrapper>
            );
        } else {
            return (
                <Link to={linkTo} key={server.id}>
                    {buttonContent}
                </Link>
            );
        }
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

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
            </Overlay>
        </div>
    );
};

export default observer(Home);
