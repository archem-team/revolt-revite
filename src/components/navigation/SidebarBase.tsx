import styled, { css } from "styled-components/macro";

import { isTouchscreenDevice } from "../../lib/isTouchscreenDevice";

export default styled.div<{ railBackdrop?: boolean }>`
    height: 100%;
    display: flex;
    user-select: none;
    flex-direction: row;
    align-items: stretch;

    /* The sidebar block is a transparent region of the
       base canvas; the panels inside float on it as rounded surfaces.
       Exception: the layout root behind the rail + channel sheet
       is surface-container-high (the rail color), which is what makes the
       sheet's rounded corners visible where it meets the rail — the left
       sidebar opts in via railBackdrop. */
    background: ${(props) =>
        props.railBackdrop && !isTouchscreenDevice
            ? "var(--primary-header)"
            : "transparent"};
`;

export const GenericSidebarBase = styled.div<{
    mobilePadding?: boolean;
}>`
    /* Side columns are 248px (--layout-width-channel-sidebar),
       used for both the channel sidebar and the member list — the wider
       columns are what make their chat panel narrower. */
    width: 248px;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    height: 100%;

    /* Sidebars/member lists sit directly on their
       backing surface (canvas or panel) with no panel chrome of their own. */
    background: ${isTouchscreenDevice
        ? "var(--secondary-background)"
        : "transparent"};

    ${(props) =>
        props.mobilePadding &&
        isTouchscreenDevice &&
        css`
            padding-bottom: 50px;
        `}
`;

export const GenericSidebarList = styled.div`
    padding: 6px;
    flex-grow: 1;
    overflow-y: scroll;
    overflow-x: hidden;

    > img {
        width: 100%;
    }
`;
