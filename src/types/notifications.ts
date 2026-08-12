export type NotificationCategory = "conversation" | "social" | "account" | "update";
export type NotificationPriority = "normal" | "important" | "critical";
export type NotificationTarget =
    | { type: "channel_message"; server_id?: string; channel_id: string; message_id: string }
    | { type: "channel"; server_id?: string; channel_id: string }
    | { type: "friends" }
    | { type: "settings"; page?: string }
    | { type: "feature"; key: string }
    | { type: "external"; url: string };
export type NotificationBlock =
    | { type: "text"; text: string }
    | { type: "image"; file_id: string; alt: string }
    | { type: "video"; file_id: string; title?: string }
    | { type: "link_preview"; url: string; title: string; description?: string }
    | { type: "actions"; actions: { label: string; target: NotificationTarget; style: "primary" | "secondary" }[] };
export interface NotificationItem {
    _id: string;
    user_id: string;
    source_kind: string;
    source_id: string;
    kind: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    body: string;
    blocks: NotificationBlock[];
    target?: NotificationTarget;
    actor_id?: string;
    actor_name?: string;
    actor_avatar?: string;
    created_at: string;
    read_at?: string;
    expires_at: string;
    metadata: Record<string, unknown>;
}
export interface NotificationPage {
    items: NotificationItem[];
    nextCursor?: string;
    unreadCount: number;
}
