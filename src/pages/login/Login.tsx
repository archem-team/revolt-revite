import { observer } from "mobx-react-lite";
import { Helmet } from "react-helmet";
import { Route, Switch, useLocation } from "react-router-dom";

import styles from "./Login.module.scss";
import { Text } from "preact-i18n";

import { useApplicationState } from "../../mobx/State";

import LocaleSelector from "../../components/common/LocaleSelector";
import { Titlebar } from "../../components/native/Titlebar";
import { useSystemAlert } from "../../updateWorker";
import { StatusBar } from "../RevoltApp";
import BrandMark from "./BrandMark";
import GetZeko from "./GetZeko";
import LoginArt from "./LoginArt";
import Morph from "./Morph";
import { FormCreate } from "./forms/FormCreate";
import { FormLogin } from "./forms/FormLogin";
import { FormReset, FormSendReset } from "./forms/FormReset";
import { FormResend, FormVerify } from "./forms/FormVerify";

export default observer(() => {
    const state = useApplicationState();
    const theme = state.settings.theme;

    const alert = useSystemAlert();
    const location = useLocation();

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
                    <meta
                        name="description"
                        content="Join the only chat built for unrestricted peptide discussion. Connect with group buys, Chinese manufacturers, and fellow researchers. No gatekeepers. No censorship. 100% open-source."
                    />
                    <meta
                        name="keywords"
                        content="peptide, chat, community, group buy, research, discussion, open source"
                    />
                    <meta
                        property="og:title"
                        content="PepChat – Home of the Peptide Community"
                    />
                    <meta
                        property="og:description"
                        content="Join the only chat built for unrestricted peptide discussion. Connect with group buys, Chinese manufacturers, and fellow researchers. No gatekeepers. No censorship. 100% open-source."
                    />
                    <meta property="og:type" content="website" />
                    <meta property="og:url" content="https://peptide.chat" />
                    <meta property="og:site_name" content="PepChat" />
                    <meta name="twitter:card" content="summary_large_image" />
                    <meta
                        name="twitter:title"
                        content="PepChat – Home of the Peptide Community"
                    />
                    <meta
                        name="twitter:description"
                        content="Join the only chat built for unrestricted peptide discussion. Connect with group buys, Chinese manufacturers, and fellow researchers. No gatekeepers. No censorship. 100% open-source."
                    />
                    <meta
                        name="theme-color"
                        content={theme.getVariable("background")}
                    />
                </Helmet>
                <LoginArt />
                {/* Brand lockup in the page corner, over the artwork —
                    the card stays all business. */}
                <div className={styles.brand}>
                    <BrandMark />
                    <span>PepChat</span>
                </div>
                <div className={styles.content}>
                    {/* Page meta (legal + language) lives in one quiet
                        centered strip at the bottom. */}
                    <div className={styles.formColumn}>
                        <div className={styles.form}>
                            {/* The card resizes into each form rather than
                                snapping between them. */}
                            <Morph morphKey={location.pathname}>
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
                            </Morph>
                        </div>
                        <GetZeko />
                    </div>
                    <div className={styles.bottom}>
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
                        <LocaleSelector />
                    </div>
                </div>
            </div>
        </>
    );
});
