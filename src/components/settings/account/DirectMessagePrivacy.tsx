import { observer } from "mobx-react-lite";

import { Text } from "preact-i18n";

import { Checkbox, Column } from "@revoltchat/ui";

import { useApplicationState } from "../../../mobx/State";

export default observer(function DirectMessagePrivacy() {
    const settings = useApplicationState().settings;

    return (
        <>
            <h3>
                <Text id="app.settings.pages.account.privacy.title" />
            </h3>
            <Column>
                <Checkbox
                    value={settings.get("privacy:require_friends_for_dms", false)}
                    title={
                        <Text id="app.settings.pages.account.privacy.require_friends_before_dm" />
                    }
                    description={
                        <Text id="app.settings.pages.account.privacy.require_friends_before_dm_desc" />
                    }
                    onChange={(enabled) =>
                        settings.set("privacy:require_friends_for_dms", enabled)
                    }
                />
            </Column>
        </>
    );
});
