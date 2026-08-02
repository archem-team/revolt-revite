import type { API } from "revolt.js";

export function hasMfaResponseValue(
    response?: API.MFAResponse,
): response is API.MFAResponse;

export function submitMfaChallenge<T>(input: {
    session: { ticket: string };
    response?: API.MFAResponse;
    friendlyName?: string;
    login: (payload: {
        mfa_response: API.MFAResponse;
        mfa_ticket: string;
        friendly_name?: string;
    }) => Promise<T>;
}): Promise<T>;
