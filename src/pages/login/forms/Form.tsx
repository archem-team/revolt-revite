import { observer } from "mobx-react-lite";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import styled from "styled-components/macro";

import styles from "../Login.module.scss";
import morph from "../Morph.module.scss";
import { Text } from "preact-i18n";
import { useRef, useState } from "preact/hooks";

import { Button, Category } from "@revoltchat/ui";

import { I18nError } from "../../../context/Locale";

import { clientController } from "../../../controllers/client/ClientController";
import { takeError } from "../../../controllers/client/jsx/error";
import FormField from "../FormField";
import { useMorph } from "../Morph";
import { CaptchaBlock, CaptchaProps } from "./CaptchaBlock";
import { CheckMail } from "./CheckMail";

interface Props {
    page: "create" | "login" | "send_reset" | "reset" | "resend";
    callback: (fields: {
        email: string;
        password: string;
        invite: string;
        captcha?: string;
    }) => Promise<void>;
}

function getInviteCode() {
    if (typeof window === "undefined") return "";

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    return code ?? "";
}

interface FormInputs {
    email: string;
    password: string;
    invite: string;
}

/**
 * A whole sentence rather than an overline: it has to wrap (the stock label
 * is `nowrap`, and a translated message runs past the card) and it should not
 * shout.
 */
const ErrorLine = styled(Category)`
    font-weight: 600;
    white-space: normal;
    text-transform: none;
`;

/** What the submit button says, per page. */
const ACTIONS: Record<Props["page"], string> = {
    create: "login.register",
    login: "login.title",
    reset: "login.set_password",
    resend: "login.resend",
    send_reset: "login.reset",
};

export const Form = observer(({ page, callback }: Props) => {
    const configuration = clientController.getServerConfig();
    const card = useMorph();

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | undefined>(undefined);
    const [error, setGlobalError] = useState<string | undefined>(undefined);
    const [captcha, setCaptcha] = useState<CaptchaProps | undefined>(undefined);

    const { handleSubmit, register, errors, setError } = useForm<FormInputs>({
        defaultValues: {
            email: "",
            password: "",
            invite: getInviteCode(),
        },
    });

    /** Swap the card's contents through the morph, never in a hard cut. */
    function swapTo(change: () => void) {
        card.swap();
        change();
    }

    // react-hook-form 6 has no invalid-submit callback, so watch whether our
    // handler ran at all: if it did not, validation turned the submit away.
    const accepted = useRef(false);
    const submit = handleSubmit(onSubmit);

    async function trySubmit(event: Event) {
        accepted.current = false;
        await submit(event as never);
        if (!accepted.current) card.reject();
    }

    async function onSubmit(data: FormInputs) {
        accepted.current = true;

        // The fields stay live while submitting, so Enter can still reach us.
        if (loading) return;

        setGlobalError(undefined);
        setLoading(true);

        function onError(err: unknown) {
            setLoading(false);
            card.reject();

            const error = takeError(err);
            switch (error) {
                case "email_in_use":
                    return setError("email", { type: "", message: error });
                case "unknown_user":
                    return setError("email", { type: "", message: error });
                case "invalid_invite":
                    return setError("invite", { type: "", message: error });
            }

            setGlobalError(error);
        }

        try {
            if (
                configuration?.features.captcha.enabled &&
                page !== "reset" &&
                page !== "login"
            ) {
                swapTo(() =>
                    setCaptcha({
                        onSuccess: async (captcha) => {
                            swapTo(() => setCaptcha(undefined));
                            try {
                                await callback({ ...data, captcha });
                                swapTo(() => setSuccess(data.email));
                            } catch (err) {
                                onError(err);
                            }
                        },
                        onCancel: () =>
                            swapTo(() => {
                                setCaptcha(undefined);
                                setLoading(false);
                            }),
                    }),
                );
            } else {
                await callback(data);
                // Logging in sends no email — it establishes a session and
                // CheckAuth redirects away. Setting success here raced that
                // redirect and, when it won, left the user on the "check your
                // mail" screen with no way back.
                if (page !== "login") {
                    swapTo(() => setSuccess(data.email));
                }
            }
        } catch (err) {
            onError(err);
        }
    }

    if (typeof success !== "undefined") {
        return (
            <CheckMail email={success} onReturn={() => setSuccess(undefined)} />
        );
    }

    if (captcha) return <CaptchaBlock {...captcha} />;

    return (
        <div className={`${styles.formModal} ${morph.enter}`}>
            <div className={styles.welcome}>
                <div className={styles.title}>
                    <Text
                        id={
                            page === "create"
                                ? "login.welcome2"
                                : "login.welcome"
                        }
                    />
                </div>
                <div className={styles.subtitle}>
                    <Text
                        id={
                            page === "create"
                                ? "login.subtitle2"
                                : "login.subtitle"
                        }
                    />
                </div>
            </div>

            {/* Preact / React typing incompatabilities */}
            <form
                onSubmit={
                    trySubmit as unknown as JSX.GenericEventHandler<HTMLFormElement>
                }>
                {page !== "reset" && (
                    <FormField
                        type="email"
                        register={register}
                        showOverline
                        error={errors.email?.message}
                    />
                )}
                {(page === "login" ||
                    page === "create" ||
                    page === "reset") && (
                    <FormField
                        type="password"
                        register={register}
                        showOverline
                        error={errors.password?.message}
                        action={
                            // Lives on the label row, where the eye
                            // lands right before typing a password.
                            page === "login" ? (
                                <Link to="/login/reset">Forgot?</Link>
                            ) : undefined
                        }
                        hint={
                            // Surface the rule where a password is being
                            // chosen, not after it gets rejected.
                            page !== "login" ? (
                                <Text id="login.password_hint" />
                            ) : undefined
                        }
                    />
                )}
                {configuration?.features.invite_only && page === "create" && (
                    <FormField
                        type="invite"
                        register={register}
                        showOverline
                        error={errors.invite?.message}
                    />
                )}
                {/* Says what went wrong on its own - pairing it with
                    "Failed to login!" only said it twice. */}
                {error && (
                    <ErrorLine>
                        <I18nError error={error} />
                    </ErrorLine>
                )}
                <Button disabled={loading}>
                    {/* Progress reports inside the button: swapping the whole
                        form out for a spinner collapsed the card. */}
                    <span
                        className={morph.cta}
                        data-loading={loading ? "true" : undefined}>
                        <span className={morph.ctaLabel}>
                            <Text id={ACTIONS[page]} />
                        </span>
                        <span className={morph.ctaSpinner} aria-hidden="true" />
                    </span>
                </Button>
            </form>
            {page === "create" && (
                <span className={styles.create}>
                    <Text id="login.existing" />{" "}
                    <Link to="/login">
                        <Text id="login.title" />
                    </Link>
                </span>
            )}
            {page === "login" && (
                <>
                    <span className={styles.create}>
                        <Text id="login.new" />{" "}
                        <Link to="/login/create">
                            <Text id="login.create" />
                        </Link>
                    </span>
                </>
            )}
            {(page === "reset" ||
                page === "resend" ||
                page === "send_reset") && (
                <>
                    <span className={styles.create}>
                        <Link to="/login">
                            <Text id="login.remembered" />
                        </Link>
                    </span>
                </>
            )}
        </div>
    );
});
