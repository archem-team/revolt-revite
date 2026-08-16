import { Archive, ChevronRight } from "@styled-icons/boxicons-regular";
import { Key, Keyboard } from "@styled-icons/boxicons-solid";
import { API } from "revolt.js";
import styled from "styled-components/macro";

import { Text } from "preact-i18n";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
} from "preact/hooks";

import { Category, InputBox, Modal, Preloader } from "@revoltchat/ui";

import { hasMfaResponseValue } from "../../../lib/authFlows";

import { ModalProps } from "../types";

/**
 * Mapping of MFA methods to icons
 */
const ICONS: Record<API.MFAMethod, React.FC<any>> = {
    Password: Keyboard,
    Totp: Key,
    Recovery: Archive,
};

const MethodButton = styled.button`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 10px;
    border: 0;
    border-radius: var(--border-radius);
    background: var(--secondary-header);
    color: var(--foreground);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
        filter: brightness(1.08);
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
`;

const MethodLabel = styled.span`
    flex: 1;
    font-size: 0.875rem;
    font-weight: 600;
`;

const ChallengeBody = styled.div`
    display: flex;
    flex-direction: column;
`;

/**
 * Component for handling challenge entry
 */
function ResponseEntry({
    type,
    value,
    onChange,
}: {
    type: API.MFAMethod;
    value?: API.MFAResponse;
    onChange: (v: API.MFAResponse) => void;
}) {
    return (
        <>
            <Category compact>
                <Text id={`login.${type.toLowerCase()}`} />
            </Category>

            {type === "Password" && (
                <InputBox
                    type="password"
                    value={(value as { password: string })?.password}
                    onInput={(e) =>
                        onChange({ password: e.currentTarget.value })
                    }
                />
            )}

            {type === "Totp" && (
                <InputBox
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={(value as { totp_code: string })?.totp_code}
                    onInput={(e) =>
                        onChange({ totp_code: e.currentTarget.value })
                    }
                />
            )}

            {type === "Recovery" && (
                <InputBox
                    value={(value as { recovery_code: string })?.recovery_code}
                    onInput={(e) =>
                        onChange({ recovery_code: e.currentTarget.value })
                    }
                />
            )}
        </>
    );
}

/**
 * MFA ticket creation flow
 */
export default function MFAFlow({
    onClose,
    signal,
    ...props
}: ModalProps<"mfa_flow">) {
    const [methods, setMethods] = useState<API.MFAMethod[] | undefined>(
        props.state === "unknown" ? props.available_methods : undefined,
    );

    // Current state of the modal
    const [selectedMethod, setSelected] = useState<API.MFAMethod>();
    const [response, setResponse] = useState<API.MFAResponse>();

    // Fetch available methods if they have not been provided.
    useEffect(() => {
        if (!methods && props.state === "known") {
            props.client.api.get("/auth/mfa/methods").then(setMethods);
        }
    }, []);

    // Always select first available method if only one available.
    useLayoutEffect(() => {
        if (methods && methods.length === 1) {
            setSelected(methods[0]);
        }
    }, [methods]);

    // Callback to generate a new ticket or send response back up the chain.
    const generateTicket = useCallback(async () => {
        if (response) {
            if (props.state === "known") {
                const ticket = await props.client.api.put(
                    "/auth/mfa/ticket",
                    response,
                );

                props.callback(ticket);
            } else {
                props.callback(response);
            }

            return true;
        }

        return false;
    }, [response]);

    return (
        <Modal
            title={
                <span id="mfa-flow-title">
                    <Text id="app.special.modals.confirm" />
                </span>
            }
            description={
                <Text
                    id={`app.special.modals.mfa.${
                        selectedMethod ? "confirm" : "select_method"
                    }`}
                />
            }
            actions={
                selectedMethod
                    ? [
                          {
                              palette: "primary",
                              disabled: !hasMfaResponseValue(response),
                              children: (
                                  <Text id="app.special.modals.actions.confirm" />
                              ),
                              onClick: generateTicket,
                              confirmation: true,
                          },
                          {
                              palette: "plain",
                              children: (
                                  <Text
                                      id={`app.special.modals.actions.${
                                          methods!.length === 1
                                              ? "cancel"
                                              : "back"
                                      }`}
                                  />
                              ),
                              onClick: () => {
                                  if (methods!.length === 1) {
                                      props.callback();
                                      return true;
                                  }
                                  setSelected(undefined);
                              },
                          },
                      ]
                    : [
                          {
                              palette: "plain",
                              children: (
                                  <Text id="app.special.modals.actions.cancel" />
                              ),
                              onClick: () => {
                                  props.callback();
                                  return true;
                              },
                          },
                      ]
            }
            // If we are logging in or have selected a method,
            // don't allow the user to dismiss the modal by clicking off.
            // This is to just generally prevent annoying situations
            // where you accidentally close the modal while logging in
            // or when switching to your password manager.
            nonDismissable={
                props.state === "unknown" ||
                typeof selectedMethod !== "undefined"
            }
            signal={signal}
            onClose={() => {
                props.callback();
                onClose();
            }}>
            <ChallengeBody
                role="dialog"
                aria-modal="true"
                aria-labelledby="mfa-flow-title">
                {methods ? (
                    selectedMethod ? (
                        <ResponseEntry
                            type={selectedMethod}
                            value={response}
                            onChange={setResponse}
                        />
                    ) : (
                        methods.map((method) => {
                            const Icon = ICONS[method];
                            return (
                                <MethodButton
                                    type="button"
                                    key={method}
                                    onClick={() => setSelected(method)}>
                                    <Icon size={24} />
                                    <MethodLabel>
                                        <Text
                                            id={`login.${method.toLowerCase()}`}
                                        />
                                    </MethodLabel>
                                    <ChevronRight aria-hidden size={20} />
                                </MethodButton>
                            );
                        })
                    )
                ) : (
                    <Preloader type="ring" />
                )}
            </ChallengeBody>
        </Modal>
    );
}
