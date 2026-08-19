import styles from "./GetZeko.module.scss";

import zekoIcon from "/assets/zeko-icon.png";

/** The Zeko hand-off row under the login card: Zeko is PepChat on mobile. */
export default function GetZeko() {
    return (
        <div className={styles.row}>
            <img src={zekoIcon} alt="Zeko" className={styles.tile} />
            <div className={styles.copy}>
                <div className={styles.name}>Get Zeko</div>
                <div className={styles.sub}>PepChat on mobile</div>
            </div>
            <div className={styles.stores}>
                <a
                    href="https://play.google.com/store/apps/details?id=com.zekochat"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.store}
                    title="Get it on Google Play">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.19,15.12L14.54,12.47L17.19,9.88L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                    </svg>
                    <span>Google Play</span>
                </a>
                <a
                    href="https://apps.apple.com/app/zeko-chat/id6756353165"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.store}
                    title="Download on the App Store">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                    </svg>
                    <span>App Store</span>
                </a>
            </div>
        </div>
    );
}
