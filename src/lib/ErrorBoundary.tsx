import localforage from "localforage";
import styled from "styled-components/macro";

import { useEffect, useErrorBoundary, useState } from "preact/hooks";

import { Button } from "@revoltchat/ui";

import { SUPPORT_EMAIL } from "../config/branding";

const CrashContainer = styled.div`
    // defined for the Button component
    --error: #ed4245;
    --primary-background: #2d2d2d;

    height: 100%;
    padding: 12px;

    background: #191919;
    color: white;

    h3 {
        margin: 0;
        margin-bottom: 12px;
    }

    code {
        font-size: 1.1em;
    }

    .buttonDivider {
        margin: 8px;
    }
`;

interface Props {
    children: Children;
    section: "client" | "renderer";
}

const DYNAMIC_IMPORT_FAILURE =
    /chunkloaderror|loading chunk|dynamically imported module|importing a module script failed/i;

export function isDynamicImportFailure(error: unknown) {
    const candidate = error as { message?: string; name?: string } | undefined;
    return DYNAMIC_IMPORT_FAILURE.test(
        String(candidate?.message || candidate?.name || error || ""),
    );
}

export function reportError(error: Error, section: string) {
    console.error(`PepChat ${section} error`, error);
}

export default function ErrorBoundary({ children, section }: Props) {
    const [error, ignoreError] = useErrorBoundary();
    const [confirm, setConfirm] = useState(false);

    async function reset() {
        if (confirm) {
            await localforage.clear();
            location.reload();
        } else {
            setConfirm(true);
        }
    }

    useEffect(() => {
        if (error) {
            if (isDynamicImportFailure(error)) {
                const recover = (
                    window as typeof window & {
                        __pepchatRecoverBoot?: () => void;
                    }
                ).__pepchatRecoverBoot;
                if (recover) {
                    recover();
                    return;
                }
            }
            reportError(error, section);
        }
    }, [error, section]);

    if (error) {
        return (
            <CrashContainer>
                {section === "client" ? (
                    <>
                        <h3>Client Crash Report</h3>
                        <Button onClick={ignoreError}>
                            Ignore error and try to reload app
                        </Button>
                        <div class="buttonDivider" />
                        <Button onClick={() => location.reload()}>
                            Refresh page
                        </Button>
                        <div class="buttonDivider" />
                        <Button palette="error" onClick={reset}>
                            {confirm ? "Are you sure?" : "Reset all app data"}
                        </Button>
                    </>
                ) : (
                    <>
                        <h3>Component Error</h3>
                        <button onClick={ignoreError}>
                            Ignore error and try render again
                        </button>
                    </>
                )}
                <br />
                <br />
                <div>Pepchat has crashed. Here's the error:</div>
                <pre>
                    <code>{error?.stack}</code>
                </pre>
                <div>
                    This error was logged locally. If the problem continues,
                    contact{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                </div>
            </CrashContainer>
        );
    }

    return <>{children}</>;
}
