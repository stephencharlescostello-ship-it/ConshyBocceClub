/**
 * Offline queue for score entries. Items are applied in order; a network failure
 * stops the flush (the item stays queued), while a permanent rejection removes the item
 * and reports it, so a bad entry can never block the ones behind it.
 */
export type QueueItem = {
  id: string; // also the idempotency key
  kind: "frame" | "undo" | "submit" | "lineup";
  matchId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
};

export interface QueueStorage {
  load(): Promise<QueueItem[]>;
  save(items: QueueItem[]): Promise<void>;
}

export class MemoryStorage implements QueueStorage {
  items: QueueItem[] = [];
  async load() {
    return this.items.slice();
  }
  async save(items: QueueItem[]) {
    this.items = items.slice();
  }
}

export type SendResult = { ok: true } | { ok: false; permanent: boolean; error: string };
export type Sender = (item: QueueItem) => Promise<SendResult>;

export class OfflineQueue {
  private flushing = false;
  constructor(private storage: QueueStorage) {}

  async enqueue(item: Omit<QueueItem, "createdAt" | "attempts">): Promise<QueueItem[]> {
    const items = await this.storage.load();
    if (items.some((i) => i.id === item.id)) return items;
    const next = [...items, { ...item, createdAt: Date.now(), attempts: 0 }];
    await this.storage.save(next);
    return next;
  }

  async pending(matchId?: string): Promise<QueueItem[]> {
    const items = await this.storage.load();
    return matchId ? items.filter((i) => i.matchId === matchId) : items;
  }

  /** Sends queued items in order. Returns what was sent, what failed permanently and what is still pending. */
  async flush(send: Sender): Promise<{ sent: QueueItem[]; rejected: { item: QueueItem; error: string }[]; remaining: QueueItem[] }> {
    const sent: QueueItem[] = [];
    const rejected: { item: QueueItem; error: string }[] = [];
    if (this.flushing) return { sent, rejected, remaining: await this.storage.load() };
    this.flushing = true;
    try {
      let items = await this.storage.load();
      while (items.length) {
        const item = items[0];
        let res: SendResult;
        try {
          res = await send(item);
        } catch (e) {
          res = { ok: false, permanent: false, error: e instanceof Error ? e.message : String(e) };
        }
        if (res.ok) {
          sent.push(item);
          items = items.slice(1);
          await this.storage.save(items);
        } else if (res.permanent) {
          rejected.push({ item, error: res.error });
          items = items.slice(1);
          await this.storage.save(items);
        } else {
          items = [{ ...item, attempts: item.attempts + 1 }, ...items.slice(1)];
          await this.storage.save(items);
          break; // offline: stop and retry later
        }
      }
      return { sent, rejected, remaining: items };
    } finally {
      this.flushing = false;
    }
  }

  async clear(matchId?: string) {
    const items = await this.storage.load();
    await this.storage.save(matchId ? items.filter((i) => i.matchId !== matchId) : []);
  }
}
