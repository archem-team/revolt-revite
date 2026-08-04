import Lottie from "lottie-react";

import { JSX } from "preact";

import usernameAnim from "../controllers/modals/components/legacy/usernameUpdateLottie.json";

type Element =
    | string
    | {
          type: "image";
          src: string;
          shadow?: boolean;
      }
    | { type: "element"; element: JSX.Element };

export interface ChangelogPost {
    date: Date;
    title: string;
    content: Element[];
}

export const changelogEntries: Record<number, ChangelogPost> = {
    1: {
        date: new Date("2022-06-12T20:39:16.674Z"),
        title: "Secure your account with 2FA",
        content: [
            "Two-factor authentication is now available to all users, you can now head over to settings to enable recovery codes and an authenticator app.",
            "Once enabled, you will be prompted on login.",
            "Other authentication methods coming later, stay tuned!",
        ],
    },
    2: {
        date: new Date("2023-02-23T20:00:00.000Z"),
        title: "In-App Reporting Is Here",
        content: [
            "You can now report any user, server, or message directly from the app.",
            "Reports are reviewed by the PepChat moderation team.",
        ],
    },
    3: {
        date: new Date("2023-06-11T15:00:00.000Z"),
        title: "Usernames are Changing",
        content: [
            {
                type: "element",
                element: (
                    <Lottie
                        animationData={usernameAnim}
                        style={{
                            background: "var(--secondary-background)",
                            borderRadius: "6px",
                        }}
                    />
                ),
            },
            "Pepchat has undergone a significant change to its username system, transitioning from unique username handles to a new system of display names and usernames with four-digit number tags called discriminators. The four-digit number tags serve as identifiers to differentiate users with the same username, allowing individuals to select desired usernames that reflect their identity.",
        ],
    },
};

export const changelogEntryArray = Object.keys(changelogEntries).map(
    (index) => changelogEntries[index as unknown as number],
);

export const latestChangelog = changelogEntryArray.length;
