import styles from "./MarketplaceAuthDialog.module.scss";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { API_URL } from "../../lib/apiUrl";
import {
    continueMarketplaceMfa,
    loginMarketplace,
    MarketplaceAuthResult,
    MarketplaceMfaMethod,
    MarketplaceSession,
} from "../../lib/marketplaceAuth";

type Step = "credentials" | "methods" | "challenge";
type Status = "default" | "loading" | "error" | "success";

const METHOD_LABELS: Record<MarketplaceMfaMethod, string> = {
    Totp: "Authenticator code",
    Recovery: "Recovery code",
    Password: "Account password",
};

function friendlyName() {
    const platform =
        (navigator as Navigator & { userAgentData?: { platform?: string } })
            .userAgentData?.platform || navigator.platform;
    return `Pep Marketplace on ${platform || "Web"}`;
}

export default function MarketplaceAuthDialog({
    open,
    notice,
    onAuthenticated,
    onCancel,
}: {
    open: boolean;
    notice?: string;
    onAuthenticated: (session: MarketplaceSession) => void;
    onCancel: () => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const challengeRef = useRef<HTMLInputElement>(null);
    const successTimerRef = useRef<number>();
    const [step, setStep] = useState<Step>("credentials");
    const [status, setStatus] = useState<Status>("default");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [challenge, setChallenge] = useState("");
    const [ticket, setTicket] = useState("");
    const [methods, setMethods] = useState<MarketplaceMfaMethod[]>([]);
    const [selectedMethod, setSelectedMethod] =
        useState<MarketplaceMfaMethod>();
    const [error, setError] = useState("");
    const busy = status === "loading" || status === "success";

    const challengeLabel = selectedMethod
        ? METHOD_LABELS[selectedMethod]
        : "Verification";
    const challengeHelp = useMemo(() => {
        switch (selectedMethod) {
            case "Totp":
                return "Enter the current code from your authenticator app.";
            case "Recovery":
                return "Enter one unused PepChat recovery code.";
            case "Password":
                return "Confirm your PepChat account password.";
            default:
                return "";
        }
    }, [selectedMethod]);

    function resetSecrets() {
        window.clearTimeout(successTimerRef.current);
        setStep("credentials");
        setStatus("default");
        setEmail("");
        setPassword("");
        setChallenge("");
        setTicket("");
        setMethods([]);
        setSelectedMethod(undefined);
        setError("");
    }

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            resetSecrets();
            dialog.showModal();
            window.setTimeout(() => emailRef.current?.focus(), 0);
        } else if (!open && dialog.open) {
            dialog.close();
            resetSecrets();
        }
    }, [open]);

    useEffect(() => () => window.clearTimeout(successTimerRef.current), []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || !open) return;
        const handleCancel = (event: Event) => {
            event.preventDefault();
            if (!busy) onCancel();
        };
        dialog.addEventListener("cancel", handleCancel);
        return () => dialog.removeEventListener("cancel", handleCancel);
    }, [busy, onCancel, open]);

    function selectMethod(method: MarketplaceMfaMethod) {
        setSelectedMethod(method);
        setChallenge("");
        setError("");
        setStatus("default");
        setStep("challenge");
        window.setTimeout(() => challengeRef.current?.focus(), 0);
    }

    function acceptResult(result: MarketplaceAuthResult) {
        if (result.result === "Success") {
            setPassword("");
            setChallenge("");
            setTicket("");
            setStatus("success");
            successTimerRef.current = window.setTimeout(
                () => onAuthenticated(result.session),
                120,
            );
            return;
        }

        setTicket(result.ticket);
        setMethods(result.allowedMethods);
        setChallenge("");
        setStatus("default");
        if (result.allowedMethods.length === 1) {
            selectMethod(result.allowedMethods[0]);
        } else {
            setSelectedMethod(undefined);
            setStep("methods");
        }
    }

    async function submitCredentials(event: Event) {
        event.preventDefault();
        setError("");
        setStatus("loading");
        try {
            acceptResult(
                await loginMarketplace({
                    apiBase: API_URL,
                    email,
                    password,
                    friendlyName: friendlyName(),
                }),
            );
        } catch (caught) {
            setStatus("error");
            setError(
                caught instanceof Error
                    ? caught.message
                    : "PepChat could not sign you in. Try again.",
            );
        }
    }

    async function submitChallenge(event: Event) {
        event.preventDefault();
        if (!selectedMethod) return;
        setError("");
        setStatus("loading");
        try {
            acceptResult(
                await continueMarketplaceMfa({
                    apiBase: API_URL,
                    ticket,
                    method: selectedMethod,
                    value: challenge,
                    friendlyName: friendlyName(),
                }),
            );
        } catch (caught) {
            setStatus("error");
            setError(
                caught instanceof Error
                    ? caught.message
                    : "That verification response was not accepted. Try again.",
            );
        }
    }

    function goBack() {
        setError("");
        setStatus("default");
        setChallenge("");
        if (methods.length > 1) {
            setSelectedMethod(undefined);
            setStep("methods");
        } else {
            setTicket("");
            setMethods([]);
            setSelectedMethod(undefined);
            setStep("credentials");
            window.setTimeout(() => emailRef.current?.focus(), 0);
        }
    }

    return (
        <dialog
            className={styles.dialog}
            ref={dialogRef}
            aria-labelledby="marketplace-auth-dialog-title"
            aria-describedby="marketplace-auth-dialog-description"
            onClick={(event) => {
                if (event.currentTarget === event.target && !busy) onCancel();
            }}>
            <div className={styles.surface} data-step={step}>
                <button
                    className={styles.close}
                    type="button"
                    data-state={busy ? "disabled" : "default"}
                    disabled={busy}
                    aria-label="Close sign in"
                    onClick={onCancel}>
                    ×
                </button>

                <header className={styles.heading}>
                    <p className={styles.eyebrow}>Pep Marketplace</p>
                    <h2 id="marketplace-auth-dialog-title">
                        {step === "credentials"
                            ? "Sign in without leaving"
                            : step === "methods"
                            ? "Choose verification"
                            : challengeLabel}
                    </h2>
                    <p id="marketplace-auth-dialog-description">
                        {step === "credentials"
                            ? "Use the same email and password as Peptide.chat."
                            : step === "methods"
                            ? "Your PepChat account requires one more check."
                            : challengeHelp}
                    </p>
                    {notice ? <p className={styles.notice}>{notice}</p> : null}
                </header>

                {step === "credentials" ? (
                    <form className={styles.form} onSubmit={submitCredentials}>
                        <label className={styles.field}>
                            <span>Email</span>
                            <input
                                ref={emailRef}
                                name="email"
                                type="email"
                                autoComplete="username"
                                inputMode="email"
                                required
                                aria-required="true"
                                aria-invalid={status === "error"}
                                aria-describedby="marketplace-auth-error"
                                disabled={busy}
                                value={email}
                                onInput={(event) =>
                                    setEmail(event.currentTarget.value)
                                }
                            />
                        </label>
                        <label className={styles.field}>
                            <span>Password</span>
                            <input
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                aria-required="true"
                                aria-invalid={status === "error"}
                                aria-describedby="marketplace-auth-error"
                                disabled={busy}
                                value={password}
                                onInput={(event) =>
                                    setPassword(event.currentTarget.value)
                                }
                            />
                        </label>
                        <p
                            className={styles.feedback}
                            id="marketplace-auth-error"
                            role={error ? "alert" : "status"}
                            aria-live="polite">
                            {error}
                        </p>
                        <button
                            className={styles.primary}
                            type="submit"
                            data-state={status}
                            disabled={busy || !email.trim() || !password}>
                            {status === "loading"
                                ? "Signing in…"
                                : status === "success"
                                ? "Signed in"
                                : "Sign in"}
                        </button>
                    </form>
                ) : step === "methods" ? (
                    <div className={styles.methods}>
                        {methods.map((method) => (
                            <button
                                key={method}
                                className={styles.method}
                                type="button"
                                data-state="default"
                                onClick={() => selectMethod(method)}>
                                <span>{METHOD_LABELS[method]}</span>
                                <span aria-hidden>→</span>
                            </button>
                        ))}
                        <button
                            className={styles.secondary}
                            type="button"
                            data-state="default"
                            onClick={goBack}>
                            Back to sign in
                        </button>
                    </div>
                ) : (
                    <form className={styles.form} onSubmit={submitChallenge}>
                        <label className={styles.field}>
                            <span>{challengeLabel}</span>
                            <input
                                ref={challengeRef}
                                name="verification"
                                type={
                                    selectedMethod === "Password"
                                        ? "password"
                                        : "text"
                                }
                                autoComplete={
                                    selectedMethod === "Totp"
                                        ? "one-time-code"
                                        : selectedMethod === "Password"
                                        ? "current-password"
                                        : "off"
                                }
                                inputMode={
                                    selectedMethod === "Totp"
                                        ? "numeric"
                                        : "text"
                                }
                                required
                                aria-required="true"
                                aria-invalid={status === "error"}
                                aria-describedby="marketplace-auth-error"
                                disabled={busy}
                                value={challenge}
                                onInput={(event) =>
                                    setChallenge(event.currentTarget.value)
                                }
                            />
                        </label>
                        <p
                            className={styles.feedback}
                            id="marketplace-auth-error"
                            role={error ? "alert" : "status"}
                            aria-live="polite">
                            {error}
                        </p>
                        <div className={styles.actions}>
                            <button
                                className={styles.secondary}
                                type="button"
                                data-state={busy ? "disabled" : "default"}
                                disabled={busy}
                                onClick={goBack}>
                                Back
                            </button>
                            <button
                                className={styles.primary}
                                type="submit"
                                data-state={status}
                                disabled={busy || !challenge.trim()}>
                                {status === "loading"
                                    ? "Checking…"
                                    : status === "success"
                                    ? "Verified"
                                    : "Verify"}
                            </button>
                        </div>
                    </form>
                )}

                <footer className={styles.footer}>
                    <span>Need account help?</span>
                    <a
                        href="https://peptide.chat/login/reset"
                        target="_blank"
                        rel="noreferrer">
                        Reset password
                    </a>
                    <a
                        href="https://peptide.chat/login/create"
                        target="_blank"
                        rel="noreferrer">
                        Create account
                    </a>
                </footer>
            </div>
        </dialog>
    );
}
