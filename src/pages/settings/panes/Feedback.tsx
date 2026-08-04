import { Github } from "@styled-icons/boxicons-logos";
import { BugAlt, Group, ListOl } from "@styled-icons/boxicons-regular";
import { Link } from "react-router-dom";

import styles from "./Panes.module.scss";
import { Text } from "preact-i18n";

import { CategoryButton, Column, Tip } from "@revoltchat/ui";

import { SOURCE_ISSUES_URL } from "../../../config/branding";

export function Feedback() {
    return (
        <Column>
            <Tip palette="warning">
                <span>
                    PepChat is actively maintained. Please use the links below
                    to suggest improvements or report problems.
                </span>
            </Tip>
            <div className={styles.feedback}>
                <a href={SOURCE_ISSUES_URL} target="_blank" rel="noreferrer">
                    <CategoryButton
                        action="external"
                        icon={<Github size={24} />}
                        description={
                            <Text id="app.settings.pages.feedback.suggest_desc" />
                        }>
                        <Text id="app.settings.pages.feedback.suggest" />
                    </CategoryButton>
                </a>
                <a href={SOURCE_ISSUES_URL} target="_blank" rel="noreferrer">
                    <CategoryButton
                        action="external"
                        icon={<ListOl size={24} />}
                        description={
                            <Text id="app.settings.pages.feedback.issue_desc" />
                        }>
                        <Text id="app.settings.pages.feedback.issue" />
                    </CategoryButton>
                </a>
                <a href={SOURCE_ISSUES_URL} target="_blank" rel="noreferrer">
                    <CategoryButton
                        action="external"
                        icon={<BugAlt size={24} />}
                        description={
                            <Text id="app.settings.pages.feedback.bug_desc" />
                        }>
                        <Text id="app.settings.pages.feedback.bug" />
                    </CategoryButton>
                </a>
                <Link to="/invite/Testers">
                    <a>
                        <CategoryButton
                            action="chevron"
                            icon={<Group size={24} />}
                            description="You can report issues and discuss improvements with us directly here.">
                            {"Join the Pepchat Lounge"}
                        </CategoryButton>
                    </a>
                </Link>
            </div>
        </Column>
    );
}
