import { makeAutoObservable, runInAction } from "mobx";
import type { Client, ClientboundNotification } from "revolt.js";
import type { NotificationCategory, NotificationItem, NotificationPage } from "../../types/notifications";

type NotificationPacket =
    | ClientboundNotification
    | { type: "NotificationCreate"; item: NotificationItem; unread_count: number }
    | { type: "NotificationRead"; id: string; read_at: string; unread_count: number }
    | { type: "NotificationsReadAll"; through: string; unread_count: number }
    | { type: "NotificationCampaignRemove"; campaign_id: string };

type NotificationClient = Client & {
    fetchNotifications(options?: { before?: string; limit?: number; category?: NotificationCategory }): Promise<NotificationPage>;
    markNotificationRead(id: string): Promise<{ unreadCount: number; affected: number }>;
    markAllNotificationsRead(through: string): Promise<{ unreadCount: number; affected: number }>;
};

export default class NotificationCenter {
    items: NotificationItem[] = [];
    unreadCount = 0;
    nextCursor?: string;
    loading = false;
    loadingMore = false;
    error?: string;
    drawerOpen = false;
    private client?: NotificationClient;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true, deep: false });
    }

    get id() {
        return "notification_center";
    }

    connect(client: Client) {
        this.client = client as NotificationClient;
        this.items = [];
        this.nextCursor = undefined;
        this.unreadCount = 0;
        void this.load();
    }

    disconnect() {
        this.client = undefined;
        this.items = [];
        this.unreadCount = 0;
        this.drawerOpen = false;
    }

    async load(category?: NotificationCategory) {
        if (!this.client || this.loading) return;
        this.loading = true;
        this.error = undefined;
        try {
            const page = await this.client.fetchNotifications({ limit: 30, category });
            runInAction(() => {
                this.items = page.items;
                this.nextCursor = page.nextCursor;
                this.unreadCount = page.unreadCount;
            });
        } catch (error) {
            runInAction(() => (this.error = error instanceof Error ? error.message : "Unable to load notifications"));
        } finally {
            runInAction(() => (this.loading = false));
        }
    }

    async loadMore() {
        if (!this.client || !this.nextCursor || this.loadingMore) return;
        this.loadingMore = true;
        try {
            const page = await this.client.fetchNotifications({ before: this.nextCursor, limit: 30 });
            runInAction(() => {
                const known = new Set(this.items.map((item) => item._id));
                this.items.push(...page.items.filter((item) => !known.has(item._id)));
                this.nextCursor = page.nextCursor;
                this.unreadCount = page.unreadCount;
            });
        } finally {
            runInAction(() => (this.loadingMore = false));
        }
    }

    onPacket(packet: NotificationPacket) {
        switch (packet.type) {
            case "NotificationCreate":
                if (!this.items.some((item) => item._id === packet.item._id)) this.items.unshift(packet.item);
                this.unreadCount = packet.unread_count;
                break;
            case "NotificationRead": {
                const item = this.items.find((item) => item._id === packet.id);
                if (item) item.read_at = packet.read_at;
                this.unreadCount = packet.unread_count;
                break;
            }
            case "NotificationsReadAll":
                this.items.forEach((item) => {
                    if (!item.read_at && item.created_at <= packet.through) item.read_at = new Date().toISOString();
                });
                this.unreadCount = packet.unread_count;
                break;
            case "NotificationCampaignRemove":
                this.items = this.items.filter((item) => !(item.source_kind === "campaign" && item.source_id === packet.campaign_id));
                break;
        }
    }

    async markRead(id: string) {
        const item = this.items.find((entry) => entry._id === id);
        if (!this.client || !item || item.read_at) return;
        const previous = this.unreadCount;
        item.read_at = new Date().toISOString();
        this.unreadCount = Math.max(0, previous - 1);
        try {
            const result = await this.client.markNotificationRead(id);
            runInAction(() => (this.unreadCount = result.unreadCount));
        } catch {
            runInAction(() => {
                item.read_at = undefined;
                this.unreadCount = previous;
            });
        }
    }

    async markAllRead() {
        if (!this.client || !this.items.length) return;
        const through = new Date().toISOString();
        const unread = this.items.filter((item) => !item.read_at);
        unread.forEach((item) => (item.read_at = through));
        const previous = this.unreadCount;
        this.unreadCount = 0;
        try {
            const result = await this.client.markAllNotificationsRead(through);
            runInAction(() => (this.unreadCount = result.unreadCount));
        } catch {
            runInAction(() => {
                unread.forEach((item) => (item.read_at = undefined));
                this.unreadCount = previous;
            });
        }
    }

    setDrawerOpen(open: boolean) {
        this.drawerOpen = open;
    }
}
