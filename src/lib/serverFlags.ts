export const SERVER_JOIN_APPROVAL_FLAG = 1 << 29;

export function hasServerJoinApproval(flags?: number | null) {
    return Boolean((flags ?? 0) & SERVER_JOIN_APPROVAL_FLAG);
}

export function setServerJoinApproval(
    flags: number | null | undefined,
    enabled: boolean,
) {
    const current = flags ?? 0;
    const next = enabled
        ? current | SERVER_JOIN_APPROVAL_FLAG
        : current & ~SERVER_JOIN_APPROVAL_FLAG;

    return next === 0 ? null : next;
}
