export type MarketplaceMfaMethod = "Password" | "Recovery" | "Totp";

export type MarketplaceSession = {
    version: 1;
    token: string;
    userId: string;
    sessionId: string;
};

export type MarketplaceAuthResult =
    | { result: "Success"; session: MarketplaceSession }
    | {
          result: "MFA";
          ticket: string;
          allowedMethods: MarketplaceMfaMethod[];
      };

type RequestOptions = {
    apiBase: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
};

export const MARKETPLACE_AUTH_STORAGE_KEY: string;
export function normalizeMarketplaceSession(
    value: unknown,
): MarketplaceSession | undefined;
export function loadMarketplaceSession(
    storage?: Storage,
): MarketplaceSession | undefined;
export function saveMarketplaceSession(
    session: MarketplaceSession,
    storage?: Storage,
): MarketplaceSession;
export function clearMarketplaceSession(storage?: Storage): void;
export function loginMarketplace(
    input: RequestOptions & {
        email: string;
        password: string;
        friendlyName: string;
    },
): Promise<MarketplaceAuthResult>;
export function continueMarketplaceMfa(
    input: RequestOptions & {
        ticket: string;
        method: MarketplaceMfaMethod;
        value: string;
        friendlyName: string;
    },
): Promise<MarketplaceAuthResult>;
export function validateMarketplaceSession(
    input: RequestOptions & { session: MarketplaceSession },
): Promise<boolean>;
export function logoutMarketplace(
    input: RequestOptions & { session: MarketplaceSession },
): Promise<void>;
