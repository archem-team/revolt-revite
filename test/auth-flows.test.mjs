import assert from "node:assert/strict";
import test from "node:test";

import {
    hasMfaResponseValue,
    submitMfaChallenge,
} from "../src/lib/authFlows.js";
import { requestCompoundBayRedirect } from "../src/lib/compoundBaySso.js";

test("MFA continue submits the TOTP response and original ticket", async () => {
    const requests = [];
    const result = await submitMfaChallenge({
        session: { ticket: "mfa-ticket" },
        response: { totp_code: "123456" },
        friendlyName: "Test Browser",
        login: async (payload) => {
            requests.push(payload);
            return { result: "Success", token: "session-token" };
        },
    });

    assert.deepEqual(requests, [
        {
            mfa_response: { totp_code: "123456" },
            mfa_ticket: "mfa-ticket",
            friendly_name: "Test Browser",
        },
    ]);
    assert.equal(result.result, "Success");
});

test("MFA continue rejects an empty response and surfaces API failures", async () => {
    assert.equal(hasMfaResponseValue({ totp_code: "   " }), false);
    await assert.rejects(
        submitMfaChallenge({
            session: { ticket: "mfa-ticket" },
            response: { totp_code: "" },
            login: async () => assert.fail("empty MFA response was submitted"),
        }),
        /response is required/,
    );
    await assert.rejects(
        submitMfaChallenge({
            session: { ticket: "mfa-ticket" },
            response: { totp_code: "000000" },
            login: async () => {
                throw new Error("invalid_totp");
            },
        }),
        /invalid_totp/,
    );
});

test("Compound Bay SSO uses the authenticated post-MFA session", async () => {
    const requests = [];
    const redirect = await requestCompoundBayRedirect({
        apiBase: "https://api.peptide.chat/",
        session: { token: "post-mfa-session" },
        returnUrl: "https://vendor.peptide.chat/auth/pepchat?next=%2Forders",
        fetchImpl: async (url, init) => {
            requests.push({ url, init });
            return {
                ok: true,
                json: async () => ({
                    redirect_url:
                        "https://vendor.peptide.chat/auth/pepchat?next=%2Forders&code=one-use-code",
                }),
            };
        },
    });

    assert.equal(
        requests[0].url,
        "https://api.peptide.chat/compound-bay/sso/issue",
    );
    assert.equal(requests[0].init.headers["x-session-token"], "post-mfa-session");
    assert.deepEqual(JSON.parse(requests[0].init.body), {
        return_url: "https://vendor.peptide.chat/auth/pepchat?next=%2Forders",
    });
    assert.equal(
        redirect,
        "https://vendor.peptide.chat/auth/pepchat?next=%2Forders&code=one-use-code",
    );
});

test("Compound Bay SSO rejects missing sessions and untrusted redirects", async () => {
    await assert.rejects(
        requestCompoundBayRedirect({
            apiBase: "https://api.peptide.chat",
            session: undefined,
            returnUrl: "https://vendor.peptide.chat/auth/pepchat",
            fetchImpl: async () => assert.fail("request should not be sent"),
        }),
        /session is not ready/,
    );
    await assert.rejects(
        requestCompoundBayRedirect({
            apiBase: "https://api.peptide.chat",
            session: "post-mfa-session",
            returnUrl: "https://vendor.peptide.chat/auth/pepchat",
            fetchImpl: async () => ({
                ok: true,
                json: async () => ({
                    redirect_url: "https://evil.example/auth/pepchat?code=stolen",
                }),
            }),
        }),
        /invalid Compound Bay redirect/,
    );
});
