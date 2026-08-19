import { Hide, Show } from "@styled-icons/boxicons-regular";
import { UseFormMethods } from "react-hook-form";

import styles from "./FormField.module.scss";
import { Text, Localizer } from "preact-i18n";
import { useState } from "preact/hooks";

import { Category, InputBox } from "@revoltchat/ui";

import { I18nError } from "../../context/Locale";

type FieldType =
    | "email"
    | "username"
    | "password"
    | "invite"
    | "current_password";

type Props = Omit<JSX.HTMLAttributes<HTMLInputElement>, "children" | "as"> & {
    type: FieldType;
    showOverline?: boolean;
    register: UseFormMethods["register"];
    error?: string;
    name?: string;
    /** Rendered at the far end of the label row, e.g. a "Forgot?" link. */
    action?: JSX.Element;
    /** Quiet guidance under the field; yields to the error when one shows. */
    hint?: JSX.Element;
};

export default function FormField({
    type,
    register,
    showOverline,
    error,
    name,
    action,
    hint,
    ...props
}: Props) {
    const isPassword = type === "password" || type === "current_password";
    const [revealed, setRevealed] = useState(false);

    const input = (
        <Localizer>
            <InputBox
                placeholder={
                    (<Text id={`login.enter.${type}`} />) as unknown as string
                }
                name={type === "current_password" ? "password" : name ?? type}
                type={
                    isPassword
                        ? revealed
                            ? "text"
                            : "password"
                        : type === "invite" || type === "username"
                        ? "text"
                        : type
                }
                // See https://github.com/mozilla/contain-facebook/issues/783
                className={`fbc-has-badge ${error ? styles.invalid : ""}`}
                aria-invalid={error ? "true" : undefined}
                // Room for the reveal toggle; inline because the login
                // card's `form input` rules outrank module classes.
                style={isPassword ? { paddingRight: "46px" } : undefined}
                ref={register(
                    isPassword
                        ? {
                              validate: (value: string) =>
                                  value.length === 0
                                      ? "RequiredField"
                                      : value.length < 8
                                      ? "TooShort"
                                      : value.length > 1024
                                      ? "TooLong"
                                      : undefined,
                          }
                        : type === "email"
                        ? {
                              required: "RequiredField",
                              pattern: {
                                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                  message: "InvalidEmail",
                              },
                          }
                        : type === "username"
                        ? {
                              validate: (value: string) =>
                                  value.length === 0
                                      ? "RequiredField"
                                      : value.length < 2
                                      ? "TooShort"
                                      : value.length > 32
                                      ? "TooLong"
                                      : undefined,
                          }
                        : { required: "RequiredField" },
                )}
                {...props}
            />
        </Localizer>
    );

    return (
        <>
            {showOverline && (
                <Category compact className={styles.label}>
                    <Text id={`login.${type}`} />
                    {action && <span className={styles.action}>{action}</span>}
                </Category>
            )}
            {isPassword ? (
                <div className={styles.inputWrap}>
                    {input}
                    <button
                        type="button"
                        className={styles.eye}
                        aria-label={
                            revealed ? "Hide password" : "Show password"
                        }
                        onClick={() => setRevealed(!revealed)}>
                        {revealed ? <Hide size={18} /> : <Show size={18} />}
                    </button>
                </div>
            ) : (
                input
            )}
            {/* Inline validation lives under its field, not in the label. */}
            {error ? (
                <div className={styles.fieldError}>
                    <I18nError error={error} />
                </div>
            ) : (
                hint && <div className={styles.hint}>{hint}</div>
            )}
        </>
    );
}
