import { Server } from "revolt.js";

import { SUPPORT_EMAIL } from "../../config/branding";

export function report(object: Server) {
    let type;
    if (object instanceof Server) {
        type = "Server";
    }

    window.open(
        `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            `${type} Report`,
        )}&body=${encodeURIComponent(
            `${type} ID: ${object._id}\nWrite more information here!`,
        )}`,
    );
}
