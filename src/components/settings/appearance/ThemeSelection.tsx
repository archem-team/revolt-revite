import { Brush } from "@styled-icons/boxicons-solid";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
// @ts-expect-error shade-blend-color does not have typings.
import pSBC from "shade-blend-color";
import styled from "styled-components/macro";

import { Text } from "preact-i18n";

import { CategoryButton, Checkbox, ObservedInputElement } from "@revoltchat/ui";

import { isMaterialYouBase } from "../../../context/materialTheme";
import { useApplicationState } from "../../../mobx/State";

import { ThemeBaseSelector } from "./legacy/ThemeBaseSelector";

/**
 * ! LEGACY
 * Component providing a way to switch the base theme being used.
 */
export const ShimThemeBaseSelector = observer(() => {
    const theme = useApplicationState().settings.theme;
    const base = theme.getBase();
    const materialYou = isMaterialYouBase(base);
    const mode: "light" | "dark" =
        base === "light" || base === "materialYouLight" ? "light" : "dark";

    return (
        <ThemeBaseSelector
            value={materialYou || !theme.isModified() ? mode : undefined}
            setValue={(newMode) => {
                if (materialYou) {
                    // Keep dynamic colour on; only switch light/dark.
                    theme.setBase(
                        newMode === "light"
                            ? "materialYouLight"
                            : "materialYouDark",
                    );
                } else {
                    theme.setBase(newMode);
                    theme.reset();
                }
            }}
        />
    );
});

/**
 * Toggle for the Material You dynamic colour theme.
 */
const MaterialYouToggle = observer(() => {
    const theme = useApplicationState().settings.theme;
    const base = theme.getBase();
    const materialYou = isMaterialYouBase(base);
    const mode: "light" | "dark" =
        base === "light" || base === "materialYouLight" ? "light" : "dark";

    return (
        <Checkbox
            value={materialYou}
            title="Material You"
            description="Generate the entire theme from your accent colour using Material 3 dynamic colour."
            onChange={(enabled: boolean) =>
                theme.setBase(
                    enabled
                        ? mode === "light"
                            ? "materialYouLight"
                            : "materialYouDark"
                        : mode,
                )
            }
        />
    );
});

export default function ThemeSelection() {
    const theme = useApplicationState().settings.theme;

    return (
        <>
            {/** Allow users to change base theme */}
            <ShimThemeBaseSelector />
            {/** Dynamic colour (Material 3) toggle */}
            <MaterialYouToggle />
            {/** Provide a link to the theme shop */}
            <Link to="/discover/themes" replace>
                <CategoryButton
                    icon={<Brush size={24} />}
                    action="chevron"
                    description={
                        <Text id="app.settings.pages.appearance.discover.description" />
                    }>
                    <Text id="app.settings.pages.appearance.discover.title" />
                </CategoryButton>
            </Link>
            <hr />
            <h3>
                <Text id="app.settings.pages.appearance.accent_selector" />
            </h3>
            <ObservedInputElement
                type="colour"
                value={theme.getVariable("accent")}
                onChange={(colour) => {
                    theme.setVariable("accent", colour as string);
                    // Under Material You the accent is the palette seed and
                    // scrollbar colours are derived by the generator instead.
                    if (!isMaterialYouBase(theme.getBase())) {
                        theme.setVariable(
                            "scrollbar-thumb",
                            pSBC(-0.2, colour),
                        );
                    }
                }}
            />
        </>
    );
}
