import { User } from "revolt.js";
import styled from "styled-components";

import { Text } from "preact-i18n";
import { useContext } from "preact/hooks";

import { TextReact } from "../../../../lib/i18n";

import { connectState } from "../../../../redux/connector";
import { TypingUser } from "../../../../redux/reducers/typing";

import { AppContext } from "../../../../context/revoltjs/RevoltClient";
import { useUsers } from "../../../../context/revoltjs/hooks";

import { Username } from "../../user/UserShort";

interface Props {
    typing?: TypingUser[];
}

const Base = styled.div`
    position: relative;

    > div {
        height: 24px;
        margin-top: -24px;
        position: absolute;

        gap: 8px;
        display: flex;
        padding: 0 10px;
        user-select: none;
        align-items: center;
        flex-direction: row;
        width: calc(100% - 3px);
        color: var(--secondary-foreground);
        background: var(--secondary-background);
    }

    .avatars {
        display: flex;

        img {
            width: 16px;
            height: 16px;
            object-fit: cover;
            border-radius: 50%;

            &:not(:first-child) {
                margin-left: -4px;
            }
        }
    }

    .usernames {
        min-width: 0;
        font-size: 13px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
`;

export function TypingIndicator({ typing }: Props) {
    if (typing && typing.length > 0) {
        const client = useContext(AppContext);
        const users = useUsers(typing.map((x) => x.id)).filter(
            (x) => typeof x !== "undefined",
        ) as User[];

        users.sort((a, b) =>
            a._id.toUpperCase().localeCompare(b._id.toUpperCase()),
        );

        let text;
        if (users.length >= 5) {
            text = <Text id="app.main.channel.typing.several" />;
        } else if (users.length > 1) {
            const userlist = [...users].map((x) => <Username user={x} />);
            const user = userlist.pop();

            for (let i = 0; i < userlist.length - 1; i++) {
                userlist.splice(i * 2 + 1, 0, <>, </>);
            }

            text = (
                <TextReact
                    id="app.main.channel.typing.multiple"
                    fields={{
                        user,
                        userlist,
                    }}
                />
            );
        } else {
            text = (
                <TextReact
                    id="app.main.channel.typing.single"
                    fields={{ user: <Username user={users[0]} /> }}
                />
            );
        }

        return (
            <Base>
                <div>
                    <div className="avatars">
                        {users.map((user) => (
                            <img
                                loading="eager"
                                src={client.users.getAvatarURL(
                                    user._id,
                                    { max_side: 256 },
                                    true,
                                )}
                            />
                        ))}
                    </div>
                    <div className="usernames">{text}</div>
                </div>
            </Base>
        );
    }

    return null;
}

export default connectState<{ id: string }>(TypingIndicator, (state, props) => {
    return {
        typing: state.typing && state.typing[props.id],
    };
});
