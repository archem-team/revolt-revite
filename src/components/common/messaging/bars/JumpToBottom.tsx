import { DownArrowAlt } from "@styled-icons/boxicons-regular";
import styled from "styled-components";

import { Text } from "preact-i18n";

import {
    SingletonMessageRenderer,
    useRenderState,
} from "../../../../lib/renderer/Singleton";

const Bar = styled.div`
    z-index: 10;
    position: relative;

    > div {
        top: -26px;
        height: 28px;
        width: 100%;
        position: absolute;
        display: flex;
        align-items: center;
        cursor: pointer;
        font-size: 13px;
        padding: 0 8px;
        user-select: none;
        justify-content: space-between;
        color: var(--secondary-foreground);
        transition: color ease-in-out 0.08s;
        background: var(--secondary-background);
        border-radius: var(--border-radius) var(--border-radius) 0 0;
        
        > div {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        &:hover {
            color: var(--primary-text);
        }

        &:active {
            transform: translateY(1px);
        }

        @media (pointer: coarse) {
            height: 34px;
            top: -32px;
            padding: 0 12px;
        }
    }
`;

export default function JumpToBottom({ id }: { id: string }) {
    const view = useRenderState(id);
    if (!view || view.type !== "RENDER" || view.atBottom) return null;

    return (
        <Bar>
            <div
                onClick={() => SingletonMessageRenderer.jumpToBottom(id, true)}>
                <div>
                    <Text id="app.main.channel.misc.viewing_old" />
                </div>
                <div>
                    <Text id="app.main.channel.misc.jump_present" />{" "}
                    <DownArrowAlt size={20} />
                </div>
            </div>
        </Bar>
    );
}
