import { Text } from "preact-i18n";
import { useState } from "preact/hooks";

import styled from "styled-components/macro";

import { Category, InputBox, Modal, Error } from "@revoltchat/ui";

import { ModalProps } from "../types";

const StyledModal = styled(Modal)`
    .phoneInput {
        background: #332e36 !important;
        border: none !important;
        box-shadow: inset 0 0 0 1px transparent !important;
        color: var(--foreground) !important;

        &:focus,
        &:focus-visible {
            background: #3d3941 !important;
            box-shadow: inset 0 0 0 2px var(--accent) !important;
        }

        &::placeholder {
            color: var(--secondary-foreground) !important;
        }
    }

    .sendCodeButton {
        background: #242424 !important;
        
        &:hover,
        &:focus-visible,
        &:active {
            background: #2a2630 !important;
            color: var(--foreground) !important;
            text-decoration: none !important;
            filter: none !important;
            box-shadow: none !important;
        }
    }

    .cancelButton {
        background: #242424 !important;
        color: var(--foreground) !important;
        
        &:hover,
        &:focus-visible,
        &:active {
            background: #2a2630 !important;
            color: var(--foreground) !important;
            text-decoration: none !important;
            filter: none !important;
            box-shadow: none !important;
        }
    }
`;

/**
 * Phone Verification modal
 */
export default function PhoneVerification({
    client,
    onClose,
    signal,
}: ModalProps<"phone_verification">) {
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const handleSendCode = async () => {
        setError(undefined);
        setLoading(true);
        try {
            await client.api.post("/users/@me/phone/send", {
                phone_number: phone,
            });
            setSent(true);
        } catch (err: any) {
            setError(err?.message ?? "Failed to send code");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setError(undefined);
        setLoading(true);
        try {
            await client.api.post("/users/@me/phone/verify", {
                phone_number: phone,
                code,
            });
            // Mark verified locally
            try {
                (client.user as any).phone_verified = true;
            } catch { }
            onClose();
        } catch (err: any) {
            setError(err?.message ?? "Failed to verify code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <StyledModal
            title={<Text id="app.settings.pages.account.phone.phone_verification" />}
            description={
                sent ? (
                    <Text id="app.settings.pages.account.phone.verify_code_sent" />
                ) : (
                    <Text id="app.settings.pages.account.phone.enter_phone" />
                )
            }
            actions={[
                {
                    palette: "primary",
                    className: "sendCodeButton",
                    children: sent ? (
                        <Text id="app.settings.pages.account.phone.verify" />
                    ) : (
                        <Text id="app.settings.pages.account.phone.send_code" />
                    ),
                    onClick: sent ? handleVerify : handleSendCode,
                    disabled: sent ? code.length !== 6 : !phone || loading,
                },
                {
                    palette: "plain",
                    className: "cancelButton",
                    children: <Text id="app.special.modals.actions.cancel" />,
                    onClick: () => {
                        onClose();
                        return true;
                    },
                },
            ]}
            onClose={onClose}
            signal={signal}
            nonDismissable={loading}>
            {error && (
                <Category compact>
                    <Error error={error} />
                </Category>
            )}

            {!sent ? (
                <InputBox
                    className="phoneInput"
                    placeholder="+1234567890"
                    value={phone}
                    onInput={(e: any) => setPhone(e.currentTarget.value)}
                    type="tel"
                    disabled={loading}
                />
            ) : (
                <InputBox
                    className="phoneInput"
                    placeholder="123456"
                    value={code}
                    onInput={(e: any) => setCode(e.currentTarget.value)}
                    maxLength={6}
                    inputMode="numeric"
                    disabled={loading}
                />
            )}
        </StyledModal>
    );
}
