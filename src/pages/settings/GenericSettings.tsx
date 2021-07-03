import { Text } from "preact-i18n";
import { Helmet } from "react-helmet";
import styles from "./Settings.module.scss";
import { Children } from "../../types/Preact";
import Header from '../../components/ui/Header';
import { ThemeContext } from "../../context/Theme";
import Category from '../../components/ui/Category';
import { useContext, useEffect } from "preact/hooks";
import IconButton from "../../components/ui/IconButton";
import LineDivider from "../../components/ui/LineDivider";
import { Switch, useHistory, useParams } from "react-router-dom";
import { isTouchscreenDevice } from "../../lib/isTouchscreenDevice";
import ButtonItem from "../../components/navigation/items/ButtonItem";
import { ArrowBack, X, XCircle } from "@styled-icons/boxicons-regular";

interface Props {
    pages: {
        category?: Children
        divider?: boolean
        id: string
        icon: Children
        title: Children
        hideTitle?: boolean
    }[]
    custom?: Children
    children: Children
    defaultPage: string
    showExitButton?: boolean
    switchPage: (to?: string) => void
    category: 'pages' | 'channel_pages' | 'server_pages'
}

export function GenericSettings({ pages, switchPage, category, custom, children, defaultPage, showExitButton }: Props) {
    const history = useHistory();
    const theme = useContext(ThemeContext);
    const { page } = useParams<{ page: string; }>();

    function exitSettings() {
        if (history.length > 0) {
            history.goBack();
        } else {
            history.push('/');
        }
    }

    useEffect(() => {
        function keyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                exitSettings();
            }
        }

        document.body.addEventListener("keydown", keyDown);
        return () => document.body.removeEventListener("keydown", keyDown);
    }, []);

    return (
        <div className={styles.settings} data-mobile={isTouchscreenDevice}>
            <Helmet>
                <meta
                    name="theme-color"
                    content={
                        isTouchscreenDevice
                            ? theme["primary-header"]
                            : theme["secondary-background"]
                    }
                />
            </Helmet>
            {isTouchscreenDevice && (
                <Header placement="primary">
                    {typeof page === "undefined" ? (
                        <>
                            { showExitButton &&
                                <IconButton onClick={exitSettings}>
                                    <X size={24} />
                                </IconButton> }
                            <Text id="app.settings.title" />
                        </>
                    ) : (
                        <>
                            <IconButton onClick={() => switchPage()}>
                                <ArrowBack size={24} />
                            </IconButton>
                            <Text
                                id={`app.settings.${category}.${page}.title`}
                            />
                        </>
                    )}
                </Header>
            )}
            {(!isTouchscreenDevice || typeof page === "undefined") && (
                <div className={styles.sidebar}>
                    <div className={styles.container}>
                        {
                            pages.map((entry, i) =>
                                <>
                                    { entry.category && <Category variant="uniform" text={entry.category} /> }
                                    <ButtonItem
                                        active={page === entry.id || (i === 0 && !isTouchscreenDevice && typeof page === "undefined")}
                                        onClick={() => switchPage(entry.id)}
                                        compact
                                    >{entry.icon} {entry.title}</ButtonItem>
                                    { entry.divider && <LineDivider /> }
                                </>
                            )
                        }
                        { custom }
                    </div>
                </div>
            )}
            {(!isTouchscreenDevice || typeof page === "string") && (
                <div className={styles.content}>
                    {!isTouchscreenDevice && !(pages.find(x => x.id === page && x.hideTitle)) && (
                        <h1>
                            <Text
                                id={`app.settings.${category}.${page ?? defaultPage}.title`}
                            />
                        </h1>
                    )}
                    <Switch>
                        { children }
                    </Switch>
                </div>
            )}
            {!isTouchscreenDevice && (
                <div className={styles.action}>
                    <IconButton onClick={exitSettings}>
                        <XCircle size={48} />
                    </IconButton>
                </div>
            )}
        </div>
    );
}
