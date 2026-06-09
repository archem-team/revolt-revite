import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { Text } from "preact-i18n";

import { Checkbox } from "@revoltchat/ui";

import { useApplicationState } from "../../../mobx/State";

const PrivacyRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9.8px 12px;
    background: var(--secondary-header);
    border-radius: var(--border-radius);
    margin-bottom: 10px;
    height: 54px;
    cursor: pointer;

    &:hover .checkmark {
        border-color: var(--accent);
        background: var(--accent);
    }

    &:hover .check {
        visibility: visible;
        opacity: 1;
        color: var(--accent-contrast);
    }
`;

const TextContent = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
`;

const Title = styled.div`
    color: var(--secondary-foreground);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    transition: color 0.2s ease;

    &:hover {
        color: var(--accent);
    }
`;

const Description = styled.div`
    color: var(--secondary-foreground);
    font-size: 0.6875rem;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
`;

const CheckboxWrapper = styled.div`
    flex-shrink: 0;
    display: flex;
    align-items: center;
`;

export default observer(function DirectMessagePrivacy() {
    const settings = useApplicationState().settings;
    const value = settings.get("privacy:require_friends_for_dms", false);

    return (
        <>
            <h3>
                <Text id="app.settings.pages.account.privacy.title" />
            </h3>
            <PrivacyRow
                onClick={() =>
                    settings.set("privacy:require_friends_for_dms", !value)
                }>
                <TextContent>
                    <Title>
                        <Text id="app.settings.pages.account.privacy.require_friends_before_dm" />
                    </Title>
                    <Description>
                        <Text id="app.settings.pages.account.privacy.require_friends_before_dm_desc" />
                    </Description>
                </TextContent>
                <CheckboxWrapper onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                        value={value}
                        onChange={(enabled) =>
                            settings.set("privacy:require_friends_for_dms", enabled)
                        }
                    />
                </CheckboxWrapper>
            </PrivacyRow>
        </>
    );
});
