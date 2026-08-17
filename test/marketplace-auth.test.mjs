import assert from "node:assert/strict";
import test from "node:test";

import {
    clearMarketplaceSession,
    continueMarketplaceMfa,
    loadMarketplaceSession,
    loginMarketplace,
    logoutMarketplace,
    MARKETPLACE_AUTH_STORAGE_KEY,
    saveMarketplaceSession,
    validateMarketplaceSession,
} from "../src/lib/marketplaceAuth.js";

function response(status, payload) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    };
}

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
        values,
    };
}

const successfulSession = {
    result: "Success",
    _id: "session-id",
    user_id: "user-id",
    token: "session-token",
    name: "Pep Marketplace on Web",
};

test("marketplace signs in directly with PepChat credentials", async () => {
    const requests = [];
    const result = await loginMarketplace({
        apiBase: "https://peptide.chat/api/",
        email: " buyer@example.com ",
        password: "secret",
        friendlyName: "Pep Marketplace on Test",
        fetchImpl: async (url, init) => {
            requests.push({ url, init });
            return response(200, successfulSession);
        },
    });

    assert.equal(result.result, "Success");
    assert.deepEqual(result.session, {
        version: 1,
        token: "session-token",
        userId: "user-id",
        sessionId: "session-id",
    });
    assert.equal(
        requests[0].url,
        "https://peptide.chat/api/auth/session/login",
    );
    assert.deepEqual(JSON.parse(requests[0].init.body), {
        email: "buyer@example.com",
        password: "secret",
        friendly_name: "Pep Marketplace on Test",
    });
});

test("marketplace continues every PepChat MFA method with the same ticket", async () => {
    const methods = [
        ["Totp", "123456", { totp_code: "123456" }],
        ["Recovery", "recover-me", { recovery_code: "recover-me" }],
        ["Password", "second-secret", { password: "second-secret" }],
    ];

    for (const [method, value, expectedResponse] of methods) {
        let payload;
        const result = await continueMarketplaceMfa({
            apiBase: "https://peptide.chat/api",
            ticket: "mfa-ticket",
            method,
            value,
            friendlyName: "Pep Marketplace on Test",
            fetchImpl: async (_url, init) => {
                payload = JSON.parse(init.body);
                return response(200, successfulSession);
            },
        });
        assert.equal(result.result, "Success");
        assert.deepEqual(payload, {
            mfa_ticket: "mfa-ticket",
            mfa_response: expectedResponse,
            friendly_name: "Pep Marketplace on Test",
        });
    }
});

test("marketplace keeps repeated MFA challenges inside the dialog", async () => {
    const result = await continueMarketplaceMfa({
        apiBase: "https://peptide.chat/api",
        ticket: "first-ticket",
        method: "Totp",
        value: "000000",
        friendlyName: "Pep Marketplace on Test",
        fetchImpl: async () =>
            response(200, {
                result: "MFA",
                ticket: "replacement-ticket",
                allowed_methods: ["Recovery", "Totp", "Totp", "Unknown"],
            }),
    });

    assert.deepEqual(result, {
        result: "MFA",
        ticket: "replacement-ticket",
        allowedMethods: ["Recovery", "Totp"],
    });
});

test("marketplace maps credential, MFA, disabled, and network failures safely", async () => {
    await assert.rejects(
        loginMarketplace({
            apiBase: "https://peptide.chat/api",
            email: "buyer@example.com",
            password: "wrong",
            friendlyName: "test",
            fetchImpl: async () =>
                response(401, { type: "InvalidCredentials" }),
        }),
        /email or password did not match/,
    );
    await assert.rejects(
        continueMarketplaceMfa({
            apiBase: "https://peptide.chat/api",
            ticket: "ticket",
            method: "Totp",
            value: "000000",
            friendlyName: "test",
            fetchImpl: async () => response(400, { type: "InvalidTotpCode" }),
        }),
        /verification code was not accepted/,
    );
    await assert.rejects(
        loginMarketplace({
            apiBase: "https://peptide.chat/api",
            email: "buyer@example.com",
            password: "secret",
            friendlyName: "test",
            fetchImpl: async () =>
                response(200, { result: "Disabled", user_id: "user-id" }),
        }),
        /account is disabled/,
    );
    await assert.rejects(
        loginMarketplace({
            apiBase: "https://peptide.chat/api",
            email: "buyer@example.com",
            password: "secret",
            friendlyName: "test",
            fetchImpl: async () => {
                throw new Error("private network detail");
            },
        }),
        /Check your connection/,
    );
});

test("remembered marketplace sessions validate, fail closed, and sign out locally", async () => {
    const storage = memoryStorage();
    const session = saveMarketplaceSession(
        {
            version: 1,
            token: "session-token",
            userId: "user-id",
            sessionId: "session-id",
        },
        storage,
    );
    assert.deepEqual(loadMarketplaceSession(storage), session);
    assert.equal(
        await validateMarketplaceSession({
            apiBase: "https://peptide.chat/api",
            session,
            fetchImpl: async (_url, init) => {
                assert.equal(init.headers["x-session-token"], "session-token");
                return response(200, { _id: "user-id" });
            },
        }),
        true,
    );
    assert.equal(
        await validateMarketplaceSession({
            apiBase: "https://peptide.chat/api",
            session,
            fetchImpl: async () => response(401, {}),
        }),
        false,
    );

    let revoked = false;
    await logoutMarketplace({
        apiBase: "https://peptide.chat/api",
        session,
        fetchImpl: async (_url, init) => {
            revoked = init.method === "POST";
            return response(204, {});
        },
    });
    assert.equal(revoked, true);
    clearMarketplaceSession(storage);
    assert.equal(storage.values.has(MARKETPLACE_AUTH_STORAGE_KEY), false);
});

test("corrupted remembered sessions never become authenticated", () => {
    for (const value of [
        "not-json",
        JSON.stringify({ version: 1, token: "token" }),
        JSON.stringify({
            version: 2,
            token: "token",
            userId: "user",
            sessionId: "session",
        }),
    ]) {
        const storage = memoryStorage({
            [MARKETPLACE_AUTH_STORAGE_KEY]: value,
        });
        assert.equal(loadMarketplaceSession(storage), undefined);
    }
});
