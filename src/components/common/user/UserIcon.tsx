import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import { User, API } from "revolt.js";

import { useApplicationState } from "../../../mobx/State";

import fallback from "../assets/user.png";

import { useClient } from "../../../controllers/client/ClientController";
import IconBase, { IconBaseProps } from "../IconBase";

interface Props extends IconBaseProps<User> {
    status?: boolean;
    override?: string;
    masquerade?: API.Masquerade;
    showServerIdentity?: boolean;
}

export function useStatusColour(user?: User) {
    const theme = useApplicationState().settings.theme;

    return user?.online && user?.status?.presence !== "Invisible"
        ? user?.status?.presence === "Idle"
            ? theme.getVariable("status-away")
            : user?.status?.presence === "Focus"
            ? theme.getVariable("status-focus")
            : user?.status?.presence === "Busy"
            ? theme.getVariable("status-busy")
            : theme.getVariable("status-online")
        : theme.getVariable("status-invisible");
}

export default observer(
    (
        props: Props &
            Omit<
                JSX.SVGAttributes<SVGSVGElement>,
                keyof Props | "children" | "as"
            >,
    ) => {
        const client = useClient();

        const {
            target,
            attachment,
            size,
            status,
            animate,
            mask,
            hover,
            showServerIdentity,
            masquerade,
            innerRef,
            override,
            ...svgProps
        } = props;

        let { url } = props;
        if (masquerade?.avatar) {
            url = client.proxyFile(masquerade.avatar);
        } else if (override) {
            url = override;
        } else if (!url) {
            let override;
            if (target && showServerIdentity) {
                const { server } = useParams<{ server?: string }>();
                if (server) {
                    const member = client.members.getKey({
                        server,
                        user: target._id,
                    });

                    if (member?.avatar) {
                        override = member?.avatar;
                    }
                }
            }

            url =
                client.generateFileURL(
                    override ?? target?.avatar ?? attachment ?? undefined,
                    { max_side: 256 },
                    animate,
                ) ?? (target ? target.defaultAvatarURL : fallback);
        }

        return (
            <IconBase
                {...svgProps}
                ref={innerRef}
                width={size}
                height={size}
                hover={hover}
                borderRadius="--border-radius-user-icon"
                aria-hidden="true"
                viewBox="0 0 32 32">
                <foreignObject
                    x="0"
                    y="0"
                    width="32"
                    height="32"
                    className="icon"
                    mask={mask ?? (status ? "url(#user)" : undefined)}>
                    {<img src={url} draggable={false} loading="lazy" />}
                </foreignObject>
                {props.status && (
                    <circle
                        cx="27"
                        cy="27"
                        r="5"
                        fill={useStatusColour(target)}
                    />
                )}
            </IconBase>
        );
    },
);
