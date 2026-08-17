export function requestCompoundBayRedirect(input: {
    apiBase: string;
    session: unknown;
    returnUrl: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
}): Promise<string>;

export type CompoundBayAuthorizationError = Error & {
    code?: "SESSION_REJECTED";
};
