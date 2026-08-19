import styles from "./LoginArt.module.scss";

// The artist's layered SVG delivery (PEPCHAT_SIGNINUP_DESIGN), rendered as
// individually anchored layers. DOM order is paint order — it implements
// her layering notes, including the flyer's trail slotting between the
// cityscape layers. plane.svg already contains its motion lines.

const LAYERS: [keyof typeof styles, string][] = [
    ["bg", "background"],
    ["stars", "stars"],
    ["city3", "cityscape-3"],
    ["city2", "cityscape-2"],
    ["flyerPath", "flying-person-path"],
    ["city1", "cityscape-1"],
    ["plane", "plane"],
    ["flyer", "flying-person"],
    ["charsLeft", "chars-left"],
    ["charsRight", "chars-right"],
];

/** The login artwork: the artist's city-at-night, fully vector. */
export default function LoginArt() {
    return (
        <div className={styles.art} aria-hidden="true">
            {LAYERS.map(([cls, file]) => (
                <img
                    key={file}
                    className={styles[cls]}
                    src={`/assets/login-art/${file}.svg`}
                    alt=""
                    draggable={false}
                />
            ))}
        </div>
    );
}
