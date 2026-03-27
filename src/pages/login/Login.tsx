import { Github } from "@styled-icons/boxicons-logos";
import { observer } from "mobx-react-lite";
import { Helmet } from "react-helmet";
import { Route, Switch } from "react-router-dom";

import styles from "./Login.module.scss";
import { Text } from "preact-i18n";

import { useApplicationState } from "../../mobx/State";

import wideSVG from "/assets/wide.svg";
import zekoIcon from "/assets/zeko-icon.png";

import LocaleSelector from "../../components/common/LocaleSelector";
import { Titlebar } from "../../components/native/Titlebar";
import { useSystemAlert } from "../../updateWorker";
import { StatusBar } from "../RevoltApp";
import { FormCreate } from "./forms/FormCreate";
import { FormLogin } from "./forms/FormLogin";
import { FormReset, FormSendReset } from "./forms/FormReset";
import { FormResend, FormVerify } from "./forms/FormVerify";

export default observer(() => {
    const state = useApplicationState();
    const theme = state.settings.theme;

    const alert = useSystemAlert();

    return (
        <>
            {window.isNative && !window.native.getConfig().frame && (
                <Titlebar overlay />
            )}
            {alert && (
                <StatusBar>
                    <div className="title">{alert.text}</div>
                    <div className="actions">
                        {alert.actions?.map((action) =>
                            action.type === "internal" ? null : action.type ===
                                "external" ? (
                                <a
                                    href={action.href}
                                    target="_blank"
                                    rel="noreferrer">
                                    <div className="button">{action.text}</div>{" "}
                                </a>
                            ) : null,
                        )}
                    </div>
                </StatusBar>
            )}
            <div className={styles.login}>
                <Helmet>
                    <title>PepChat – Home of the Peptide Community</title>
                    <meta name="description" content="Join the only chat built for unrestricted peptide discussion. Connect with group buys, Chinese manufacturers, and fellow researchers. No gatekeepers. No censorship. 100% open-source, powered by Revolt." />
                    <meta name="keywords" content="peptide, chat, community, group buy, research, discussion, open source" />
                    <meta property="og:title" content="PepChat – Home of the Peptide Community" />
                    <meta property="og:description" content="Join the only chat built for unrestricted peptide discussion. Connect with group buys, Chinese manufacturers, and fellow researchers. No gatekeepers. No censorship. 100% open-source, powered by Revolt." />
                    <meta property="og:type" content="website" />
                    <meta property="og:url" content="https://peptide.chat" />
                    <meta property="og:site_name" content="PepChat" />
                    <meta name="twitter:card" content="summary_large_image" />
                    <meta name="twitter:title" content="PepChat – Home of the Peptide Community" />
                    <meta name="twitter:description" content="Join the only chat built for unrestricted peptide discussion. Connect with group buys, Chinese manufacturers, and fellow researchers. No gatekeepers. No censorship. 100% open-source, powered by Revolt." />
                    <meta
                        name="theme-color"
                        content={theme.getVariable("background")}
                    />
                </Helmet>
                <div className={styles.content}>
                    <div className={styles.nav}>
                        <a className={styles.logo}>
                            {!("native" in window) && (
                                <img src={wideSVG} draggable={false} />
                            )}
                        </a>
                        <LocaleSelector />
                    </div>
                    <div className={styles.form}>
                        {/*<div style={styles.version}>
                            API: <code>{configuration?.revolt ?? "???"}</code>{" "}
                            &middot; revolt.js: <code>{LIBRARY_VERSION}</code>{" "}
                            &middot; App: <code>{APP_VERSION}</code>
                        </div>*/}
                        <Switch>
                            <Route path="/login/create">
                                <FormCreate />
                            </Route>
                            <Route path="/login/resend">
                                <FormResend />
                            </Route>
                            <Route path="/login/verify/:token">
                                <FormVerify />
                            </Route>
                            <Route path="/login/reset/:token">
                                <FormReset />
                            </Route>
                            <Route path="/login/reset">
                                <FormSendReset />
                            </Route>
                            <Route path="/">
                                <FormLogin />
                            </Route>
                        </Switch>
                        <div className={styles.appLinks}>
                            <div className={styles.appLinksDivider}>
                                <img
                                    src={zekoIcon}
                                    alt="Zeko"
                                    className={styles.appDividerIcon}
                                />
                                <span>Get Zeko App</span>
                            </div>
                            <div className={styles.appLinksButtons}>
                                <a
                                    href="https://play.google.com/store/apps/details?id=com.zekochat"
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.appButton}
                                    title="Get it on Google Play">
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="currentColor">
                                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.19,15.12L14.54,12.47L17.19,9.88L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                                    </svg>
                                </a>
                                <a
                                    href="https://apps.apple.com/app/zeko-chat/id6756353165"
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.appButton}
                                    title="Download on the App Store">
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="currentColor">
                                        <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className={styles.bottom}>
                        <div className={styles.links}>
                            <div className={styles.socials}>
                                <a
                                    href="https://github.com/archem-team"
                                    target="_blank"
                                    rel="noreferrer">
                                    <Github size={24} />
                                </a>
                            </div>
                            <div className={styles.bullet} />
                            <div className={styles.revolt}>
                                <a
                                    href="https://copper-mildrid-58.tiiny.site"
                                    target="_blank"
                                    rel="noreferrer">
                                    Acceptable Usage Policy
                                </a>
                                <a
                                    href="https://emerald-theresita-57.tiiny.site"
                                    target="_blank"
                                    rel="noreferrer">
                                    <Text id="general.tos" />
                                </a>
                                <a
                                    href="https://crimson-elena-61.tiiny.site"
                                    target="_blank"
                                    rel="noreferrer">
                                    <Text id="general.privacy" />
                                </a>
                            </div>
                        </div>
                        <a
                            className={styles.attribution}
                            href="https://unsplash.com/@kirp"
                            target="_blank"
                            rel="noreferrer">
                            <Text id="general.image_by" /> &lrm;@kirp &rlm;·
                            unsplash.com
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
});
