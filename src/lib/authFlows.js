export function hasMfaResponseValue(response) {
    if (!response || typeof response !== "object") return false;

    return Object.values(response).some(
        (value) => typeof value === "string" && value.trim().length > 0,
    );
}

export async function submitMfaChallenge({
    session,
    response,
    friendlyName,
    login,
}) {
    if (!hasMfaResponseValue(response)) {
        throw new Error("A two-factor authentication response is required.");
    }

    return login({
        mfa_response: response,
        mfa_ticket: session.ticket,
        friendly_name: friendlyName,
    });
}
