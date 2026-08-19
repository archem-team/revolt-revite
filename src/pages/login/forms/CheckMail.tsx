import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";

import morph from "../Morph.module.scss";
import styles from "./CheckMail.module.scss";
import { Text } from "preact-i18n";

import { clientController } from "../../../controllers/client/ClientController";
import { MailProvider } from "./MailProvider";

interface Props {
    /** Where the verification mail was sent. */
    email: string;
    onReturn: () => void;
}

/** What a form shows once the server has taken the request. */
export const CheckMail = observer(({ email, onReturn }: Props) => {
    const configuration = clientController.getServerConfig();

    return (
        <div className={`${styles.success} ${morph.enter}`}>
            {configuration?.features.email ? (
                <>
                    <div>
                        <div className={styles.title}>
                            <Text id="login.check_mail" />
                        </div>
                        <div className={styles.subtitle}>
                            <Text id="login.email_delay" />
                        </div>
                    </div>
                    <MailProvider email={email} />
                </>
            ) : (
                <div className={styles.title}>
                    <Text id="login.successful_registration" />
                </div>
            )}
            {/* Clearing the state matters: /login renders the same Form
                instance, so navigating alone would not remount it and this
                screen would persist with no way out. */}
            <Link to="/login" onClick={onReturn}>
                <a>
                    <Text id="login.remembered" />
                </a>
            </Link>
        </div>
    );
});
