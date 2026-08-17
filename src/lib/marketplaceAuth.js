export const MARKETPLACE_AUTH_STORAGE_KEY = "pep-marketplace-auth-v1";

const SESSION_VERSION = 1;
const MFA_METHODS = new Set(["Password", "Recovery", "Totp"]);

function endpoint(apiBase, path) {
    return `${String(apiBase).replace(/\/+$/, "")}${path}`;
}

function errorCode(payload) {
    if (!payload || typeof payload !== "object") return "";
    if (typeof payload.type === "string") return payload.type;
    if (typeof payload.error === "string") return payload.error;
    return "";
}

function authErrorMessage(code, status) {
    switch (code) {
        case "InvalidCredentials":
        case "invalid_credentials":
        case "unknown_user":
        case "Unauthorized":
            return "That email or password did not match. Try again.";
        case "InvalidToken":
        case "InvalidSession":
        case "InvalidMFAResponse":
        case "InvalidTotpCode":
        case "invalid_totp":
            return "That verification code was not accepted. Try a fresh code.";
        case "TooManyRequests":
            return "Too many attempts. Wait a moment, then try again.";
        case "Disabled":
            return "This PepChat account is disabled.";
        default:
            if (status === 401)
                return "That email or password did not match. Try again.";
            if (status === 429)
                return "Too many attempts. Wait a moment, then try again.";
            return "PepChat could not sign you in. Check your connection and try again.";
    }
}

function normalizeMethods(methods) {
    if (!Array.isArray(methods)) return [];
    return methods.filter(
        (method, index) =>
            MFA_METHODS.has(method) && methods.indexOf(method) === index,
    );
}

export function normalizeMarketplaceSession(value) {
    if (!value || typeof value !== "object") return undefined;
    const token = typeof value.token === "string" ? value.token.trim() : "";
    const userId = typeof value.userId === "string" ? value.userId.trim() : "";
    const sessionId =
        typeof value.sessionId === "string" ? value.sessionId.trim() : "";
    if (value.version !== SESSION_VERSION || !token || !userId || !sessionId)
        return undefined;
    return { version: SESSION_VERSION, token, userId, sessionId };
}

export function loadMarketplaceSession(storage = localStorage) {
    try {
        const value = storage.getItem(MARKETPLACE_AUTH_STORAGE_KEY);
        return value
            ? normalizeMarketplaceSession(JSON.parse(value))
            : undefined;
    } catch {
        return undefined;
    }
}

export function saveMarketplaceSession(session, storage = localStorage) {
    const normalized = normalizeMarketplaceSession(session);
    if (!normalized) throw new Error("PepChat returned an invalid session.");
    storage.setItem(MARKETPLACE_AUTH_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}

export function clearMarketplaceSession(storage = localStorage) {
    storage.removeItem(MARKETPLACE_AUTH_STORAGE_KEY);
}

async function postLogin(apiBase, payload, fetchImpl, signal) {
    let response;
    try {
        response = await fetchImpl(endpoint(apiBase, "/auth/session/login"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
            throw error;
        throw new Error(
            "PepChat could not sign you in. Check your connection and try again.",
        );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(authErrorMessage(errorCode(data), response.status));
    }

    if (data.result === "Success") {
        const session = normalizeMarketplaceSession({
            version: SESSION_VERSION,
            token: data.token,
            userId: data.user_id,
            sessionId: data._id,
        });
        if (!session) throw new Error("PepChat returned an invalid session.");
        return session;
    }

    if (data.result === "MFA") {
        const methods = normalizeMethods(data.allowed_methods);
        if (
            typeof data.ticket !== "string" ||
            !data.ticket.trim() ||
            !methods.length
        )
            throw new Error(
                "PepChat returned an invalid verification challenge.",
            );
        return {
            result: "MFA",
            ticket: data.ticket,
            allowedMethods: methods,
        };
    }

    if (data.result === "Disabled") {
        throw new Error("This PepChat account is disabled.");
    }

    throw new Error("PepChat returned an invalid sign-in response.");
}

export async function loginMarketplace({
    apiBase,
    email,
    password,
    friendlyName,
    fetchImpl = fetch,
    signal,
}) {
    const result = await postLogin(
        apiBase,
        { email: email.trim(), password, friendly_name: friendlyName },
        fetchImpl,
        signal,
    );
    return result.result === "MFA"
        ? result
        : { result: "Success", session: result };
}

export async function continueMarketplaceMfa({
    apiBase,
    ticket,
    method,
    value,
    friendlyName,
    fetchImpl = fetch,
    signal,
}) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Enter your verification response.");
    const response =
        method === "Totp"
            ? { totp_code: trimmed }
            : method === "Recovery"
            ? { recovery_code: trimmed }
            : { password: value };
    const result = await postLogin(
        apiBase,
        {
            mfa_ticket: ticket,
            mfa_response: response,
            friendly_name: friendlyName,
        },
        fetchImpl,
        signal,
    );
    return result.result === "MFA"
        ? result
        : { result: "Success", session: result };
}

export async function validateMarketplaceSession({
    apiBase,
    session,
    fetchImpl = fetch,
    signal,
}) {
    const normalized = normalizeMarketplaceSession(session);
    if (!normalized) return false;
    try {
        const response = await fetchImpl(endpoint(apiBase, "/users/@me"), {
            headers: { "x-session-token": normalized.token },
            cache: "no-store",
            signal,
        });
        if (!response.ok) return false;
        const user = await response.json().catch(() => ({}));
        return user?._id === normalized.userId;
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
            throw error;
        // A temporary network failure must not destroy a remembered login.
        return true;
    }
}

export async function logoutMarketplace({
    apiBase,
    session,
    fetchImpl = fetch,
    signal,
}) {
    const normalized = normalizeMarketplaceSession(session);
    if (!normalized) return;
    try {
        await fetchImpl(endpoint(apiBase, "/auth/session/logout"), {
            method: "POST",
            headers: { "x-session-token": normalized.token },
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
            throw error;
        // Local sign-out still succeeds when the server is temporarily offline.
    }
}
