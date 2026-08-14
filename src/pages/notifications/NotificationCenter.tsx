import { Bell, CheckCircle, X } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import type { NotificationItem, NotificationTarget } from "../../types/notifications";
import { useHistory } from "react-router-dom";
import styled, { css, keyframes } from "styled-components/macro";

import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { useClient } from "../../controllers/client/ClientController";
import { isTouchscreenDevice } from "../../lib/isTouchscreenDevice";
import { useApplicationState } from "../../mobx/State";

const drawerIn = keyframes`
    from { opacity: 0; transform: translateX(24px); }
    to { opacity: 1; transform: translateX(0); }
`;

const scrimIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const Shell = styled.section<{ drawer?: boolean }>`
    height: 100%;
    display: flex;
    flex-direction: column;
    color: var(--foreground);
    background: var(--primary-background);

    ${(props) => props.drawer && css`
        position: fixed;
        z-index: var(--z-modal, 1100);
        inset: 12px 12px 12px auto;
        width: min(440px, calc(100vw - 24px));
        border: 1px solid var(--tertiary-background);
        border-radius: 24px;
        box-shadow: 0 24px 80px rgb(0 0 0 / 38%);
        overflow: hidden;
        animation: ${drawerIn} 300ms cubic-bezier(0.16, 1, 0.3, 1);

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    `}
`;

const Scrim = styled.div`
    position: fixed;
    z-index: calc(var(--z-modal, 1100) - 1);
    inset: 0;
    background: rgb(0 0 0 / 24%);
    backdrop-filter: blur(2px);
    animation: ${scrimIn} 300ms cubic-bezier(0.16, 1, 0.3, 1);

    @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Header = styled.header`
    min-height: 68px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--tertiary-background);

    h1 { margin: 0; font-size: 21px; letter-spacing: -0.02em; flex: 1; }
    button { border: 0; color: var(--foreground); background: var(--secondary-background); border-radius: 12px; min-width: 44px; min-height: 44px; padding: 0 12px; cursor: pointer; white-space: nowrap; }
    button:hover { background: var(--tertiary-background); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    button:active { background: var(--primary-background); }
    button:disabled { cursor: not-allowed; opacity: .55; }
`;

const Filters = styled.div`
    display: flex;
    gap: 8px;
    padding: 12px 18px 4px;
    overflow-x: auto;

    button { border: 0; border-radius: 999px; min-height: 44px; padding: 8px 13px; color: var(--secondary-foreground); background: transparent; cursor: pointer; white-space: nowrap; }
    button[data-active="true"] { color: var(--foreground); background: var(--secondary-background); }
    button:hover { color: var(--foreground); background: var(--secondary-background); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    button:active { background: var(--tertiary-background); }
    button:disabled { cursor: not-allowed; opacity: .55; }
`;

const Feed = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px 32px;
`;

const GroupTitle = styled.div`
    padding: 16px 6px 8px;
    color: var(--secondary-foreground);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
`;

const Card = styled.article<{ unread: boolean; actionable: boolean }>`
    position: relative;
    margin-bottom: 9px;
    padding: 15px;
    border-radius: 18px;
    border: 1px solid ${(props) => props.unread ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--tertiary-background)"};
    background: ${(props) => props.unread ? "color-mix(in srgb, var(--accent) 8%, var(--secondary-background))" : "var(--secondary-background)"};
    cursor: ${(props) => props.actionable ? "pointer" : "default"};

    @media (hover: hover) and (pointer: fine) {
        ${(props) => props.actionable && css`&:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }`}
    }
    @media (prefers-reduced-motion: reduce) { &:hover, &:active { transform: none; } }
    &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    &:active { background: var(--tertiary-background); }
    &:disabled { cursor: not-allowed; opacity: .55; }
    &:active { transform: translateY(0); }
    h2 { margin: 0 30px 5px 0; font-size: 15px; line-height: 1.3; }
    p { margin: 0; color: var(--secondary-foreground); line-height: 1.45; font-size: 14px; }
    time { display: block; margin-top: 10px; color: var(--secondary-foreground); font-size: 12px; font-variant-numeric: tabular-nums; }
`;

const Dot = styled.span`
    position: absolute;
    top: 18px;
    right: 18px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
`;

const Media = styled.img`
    display: block;
    width: 100%;
    max-height: 240px;
    object-fit: cover;
    margin-top: 12px;
    border-radius: 14px;
`;

const Video = styled.video`
    display: block;
    width: 100%;
    max-height: 240px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    margin-top: 12px;
    border-radius: 14px;
    background: var(--tertiary-background);
`;

const LinkPreview = styled.button`
    width: 100%;
    min-height: 44px;
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--tertiary-background);
    border-radius: 12px;
    color: var(--foreground);
    background: transparent;
    text-align: start;
    cursor: pointer;
    strong, span { display: block; }
    span { margin-top: 3px; color: var(--secondary-foreground); font-size: 12px; }
    &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    button { border: 0; border-radius: 10px; min-height: 44px; padding: 9px 13px; cursor: pointer; background: var(--accent); color: var(--accent-contrast); font-weight: 600; white-space: nowrap; }
    button[data-secondary="true"] { background: var(--tertiary-background); color: var(--foreground); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    button:active { filter: brightness(.92); }
    button:disabled { cursor: not-allowed; opacity: .55; }
`;

const Skeleton = styled.div`
    display: grid;
    gap: 10px;
    padding-top: 18px;
    span { display: block; height: 108px; border-radius: 18px; background: var(--secondary-background); opacity: .7; }
`;

const State = styled.div`
    min-height: 260px;
    display: grid;
    place-items: center;
    text-align: center;
    color: var(--secondary-foreground);
    padding: 32px;
    svg { margin-bottom: 12px; opacity: .7; }
`;

type Filter = "all" | NotificationItem["category"];

const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "conversation", label: "Mentions" },
    { value: "social", label: "Activity" },
    { value: "account", label: "Account" },
    { value: "update", label: "Updates" },
];

function groupLabel(value: Date, now = new Date()) {
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startValue = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const days = Math.round((startToday - startValue) / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "This week";
    return "Earlier";
}

function pathForTarget(target: NotificationTarget): string | undefined {
    switch (target.type) {
        case "channel_message": return target.server_id ? `/server/${target.server_id}/channel/${target.channel_id}/${target.message_id}` : `/channel/${target.channel_id}/${target.message_id}`;
        case "channel": return target.server_id ? `/server/${target.server_id}/channel/${target.channel_id}` : `/channel/${target.channel_id}`;
        case "friends": return "/friends";
        case "settings": return target.page ? `/settings/${target.page}` : "/settings";
        case "feature": return target.key === "notification_center" ? "/notifications" : `/home?feature=${encodeURIComponent(target.key)}`;
        case "external": return undefined;
    }
}

const ViewedCard = observer(({ item, onOpen }: { item: NotificationItem; onOpen: (target?: NotificationTarget) => void }) => {
    const state = useApplicationState().notificationCenter;
    const client = useClient();
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        if (item.read_at || !ref.current) return;
        let timer: number | undefined;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
                timer ??= window.setTimeout(() => {
                    void state.markRead(item._id);
                    observer.disconnect();
                }, 450);
            } else if (timer) {
                window.clearTimeout(timer);
                timer = undefined;
            }
        }, { threshold: [0.65] });
        observer.observe(ref.current);
        return () => {
            if (timer) window.clearTimeout(timer);
            observer.disconnect();
        };
    }, [item._id, item.read_at]);

    const mediaUrl = (fileId: string) => `${client.configuration?.features.autumn.url}/attachments/${fileId}`;

    return (
        <Card
            ref={ref}
            unread={!item.read_at}
            actionable={Boolean(item.target)}
            role={item.target ? "link" : undefined}
            tabIndex={item.target ? 0 : undefined}
            aria-label={item.target ? `Open notification: ${item.title}` : undefined}
            onClick={() => item.target && onOpen(item.target)}
            onKeyDown={(event) => {
                if (item.target && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onOpen(item.target);
                }
            }}>
            {!item.read_at && <Dot />}
            <h2>{item.title}</h2>
            {item.body && <p>{item.body}</p>}
            {item.blocks.map((block, index) => {
                if (block.type === "text") return <p key={index}>{block.text}</p>;
                if (block.type === "image") return <Media key={index} src={mediaUrl(block.file_id)} alt={block.alt} loading="lazy" />;
                if (block.type === "video") return <Video key={index} src={mediaUrl(block.file_id)} controls preload="metadata" aria-label={block.title || "Notification video"} />;
                if (block.type === "link_preview") return <LinkPreview key={index} onClick={(event) => { event.stopPropagation(); window.open(block.url, "_blank", "noopener,noreferrer"); }}><strong>{block.title}</strong>{block.description && <span>{block.description}</span>}</LinkPreview>;
                if (block.type === "actions") return <Actions key={index}>{block.actions.map((action) => <button key={action.label} data-secondary={action.style === "secondary"} onClick={(event) => { event.stopPropagation(); onOpen(action.target); }}>{action.label}</button>)}</Actions>;
                return null;
            })}
            <time dateTime={item.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time>
        </Card>
    );
});

export const NotificationCenterContent = observer(({ drawer = false }: { drawer?: boolean }) => {
    const center = useApplicationState().notificationCenter;
    const history = useHistory();
    const [filter, setFilter] = useState<Filter>("all");
    const visible = center.items.filter((item) => filter === "all" || item.category === filter);
    const groups = useMemo(() => {
        const result = new Map<string, NotificationItem[]>();
        visible.forEach((item) => {
            const label = groupLabel(new Date(item.created_at));
            result.set(label, [...(result.get(label) ?? []), item]);
        });
        return [...result.entries()];
    }, [visible]);

    const open = (target?: NotificationTarget) => {
        if (!target) return;
        if (target.type === "external") window.open(target.url, "_blank", "noopener,noreferrer");
        else { const path = pathForTarget(target); if (path) history.push(path); }
        center.setDrawerOpen(false);
    };

    return (
        <Shell data-notification-drawer={drawer || undefined} drawer={drawer} role={drawer ? "dialog" : undefined} aria-modal={drawer || undefined} aria-label="Notification Center">
            <Header>
                <Bell size={24} />
                <h1>{"Notifications"}</h1>
                {center.unreadCount > 0 && <button onClick={() => void center.markAllRead()}><CheckCircle size={17} /> {"Mark all read"}</button>}
                {drawer && <button aria-label="Close" onClick={() => center.setDrawerOpen(false)}><X size={20} /></button>}
            </Header>
            <Filters>
                {filters.map(({ value, label }) => <button key={value} data-filter data-active={filter === value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
            </Filters>
            <Feed>
                {center.loading ? <Skeleton aria-label="Loading notifications"><span /><span /><span /></Skeleton> : center.error ? <State><div>{center.error}<br /><button onClick={() => void center.load()}>{"Try again"}</button></div></State> : groups.length === 0 ? <State><div><Bell size={36} /><br />{filter === "all" ? "You’re all caught up." : "No notifications in this category."}</div></State> : groups.map(([label, items]) => <div key={label}><GroupTitle>{label}</GroupTitle>{items.map((item) => <ViewedCard key={item._id} item={item} onOpen={open} />)}</div>)}
                {center.nextCursor && <State><button onClick={() => void center.loadMore()} disabled={center.loadingMore}>{center.loadingMore ? "Loading…" : "Load older notifications"}</button></State>}
            </Feed>
        </Shell>
    );
});

export const NotificationDrawer = observer(() => {
    const center = useApplicationState().notificationCenter;
    useEffect(() => {
        if (!center.drawerOpen) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-notification-drawer] [data-filter]")?.focus());
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                center.setDrawerOpen(false);
                return;
            }
            if (event.key !== "Tab") return;
            const drawer = document.querySelector<HTMLElement>("[data-notification-drawer]");
            const focusable = [...(drawer?.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1']), video[controls]") ?? [])].filter((element) => !element.hasAttribute("disabled"));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [center.drawerOpen]);
    if (!center.drawerOpen) return null;
    return <><Scrim onClick={() => center.setDrawerOpen(false)} /><NotificationCenterContent drawer /></>;
});

export default function NotificationCenterPage() {
    const application = useApplicationState();
    const history = useHistory();

    useEffect(() => {
        if (isTouchscreenDevice) return;
        application.notificationCenter.setDrawerOpen(true);
        history.replace(application.layout.getLastPath());
    }, []);

    if (!isTouchscreenDevice) return null;
    return <NotificationCenterContent />;
}
