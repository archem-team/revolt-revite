function sessionToken(session) {
    if (typeof session === "string") return session.trim();
    if (session && typeof session === "object") {
        const token = session.token;
        return typeof token === "string" ? token.trim() : "";
    }
    return "";
}

export async function requestCompoundBayRedirect({
    apiBase,
    session,
    returnUrl,
    fetchImpl = fetch,
    signal,
}) {
    const token = sessionToken(session);
    if (!token)
        throw new Error(
            "Your PepChat session is not ready. Please sign in again.",
        );

    const requestedReturn = new URL(returnUrl);
    const response = await fetchImpl(
        `${apiBase.replace(/\/+$/, "")}/compound-bay/sso/issue`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-session-token": token,
            },
            body: JSON.stringify({ return_url: requestedReturn.toString() }),
            signal,
        },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.redirect_url !== "string") {
        const error = new Error(
            typeof payload.error === "string"
                ? payload.error
                : "PepChat could not authorize this storefront.",
        );
        if (response.status === 401 || response.status === 403) {
            error.code = "SESSION_REJECTED";
        }
        throw error;
    }

    const redirect = new URL(payload.redirect_url);
    if (
        redirect.origin !== requestedReturn.origin ||
        redirect.pathname !== requestedReturn.pathname ||
        !redirect.searchParams.get("code")
    ) {
        throw new Error("PepChat returned an invalid Compound Bay redirect.");
    }

    return redirect.toString();
}
