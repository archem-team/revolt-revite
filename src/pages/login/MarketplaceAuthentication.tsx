import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { API_URL } from "../../lib/apiUrl";
import {
    clearMarketplaceSession,
    loadMarketplaceSession,
    MarketplaceSession,
    saveMarketplaceSession,
    validateMarketplaceSession,
} from "../../lib/marketplaceAuth";

import MarketplaceAuthDialog from "./MarketplaceAuthDialog";
import MarketplaceLogin from "./MarketplaceLogin";

type PendingAuthentication = {
    resolve: (session: MarketplaceSession | undefined) => void;
};

export default function MarketplaceAuthentication({
    locale,
    legal,
    logoSrc,
}: {
    locale: ComponentChildren;
    legal: ComponentChildren;
    logoSrc: string;
}) {
    const [session, setSession] = useState<MarketplaceSession | undefined>(() =>
        loadMarketplaceSession(window.localStorage),
    );
    const [authOpen, setAuthOpen] = useState(false);
    const [authNotice, setAuthNotice] = useState<string>();
    const pendingRef = useRef<PendingAuthentication>();

    useEffect(() => {
        if (!session) return;
        const controller = new AbortController();
        void validateMarketplaceSession({
            apiBase: API_URL,
            session,
            signal: controller.signal,
        }).then((valid) => {
            if (valid || controller.signal.aborted) return;
            clearMarketplaceSession(window.localStorage);
            setSession(undefined);
        });
        return () => controller.abort();
    }, [session]);

    const requestPepchatSignIn = useCallback(
        (notice?: string) => {
            if (session) return Promise.resolve(session);
            return new Promise<MarketplaceSession | undefined>((resolve) => {
                pendingRef.current?.resolve(undefined);
                pendingRef.current = { resolve };
                setAuthNotice(notice);
                setAuthOpen(true);
            });
        },
        [session],
    );

    const closeAuthentication = useCallback(() => {
        pendingRef.current?.resolve(undefined);
        pendingRef.current = undefined;
        setAuthOpen(false);
        setAuthNotice(undefined);
    }, []);

    const acceptAuthentication = useCallback(
        (nextSession: MarketplaceSession) => {
            const saved = saveMarketplaceSession(
                nextSession,
                window.localStorage,
            );
            setSession(saved);
            pendingRef.current?.resolve(saved);
            pendingRef.current = undefined;
            setAuthOpen(false);
            setAuthNotice(undefined);
        },
        [],
    );

    const rejectPepchatSession = useCallback((notice: string) => {
        clearMarketplaceSession(window.localStorage);
        setSession(undefined);
        return new Promise<MarketplaceSession | undefined>((resolve) => {
            pendingRef.current?.resolve(undefined);
            pendingRef.current = { resolve };
            setAuthNotice(notice);
            setAuthOpen(true);
        });
    }, []);

    return (
        <>
            <MarketplaceLogin
                pepchatSession={session}
                requestPepchatSignIn={requestPepchatSignIn}
                rejectPepchatSession={rejectPepchatSession}
                locale={locale}
                legal={legal}
                logoSrc={logoSrc}
            />
            <MarketplaceAuthDialog
                open={authOpen}
                notice={authNotice}
                onAuthenticated={acceptAuthentication}
                onCancel={closeAuthentication}
            />
        </>
    );
}
