import { describe, it, expect } from "vitest";
import { MemoryStorage, OfflineQueue, type QueueItem } from "@/lib/engine/offline-queue";

function item(id: string, matchId = "m1"): Omit<QueueItem, "createdAt" | "attempts"> {
  return { id, kind: "frame", matchId, payload: { points: 3 } };
}

describe("offline queue", () => {
  it("queues in order and is idempotent on id", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    await q.enqueue(item("a"));
    await q.enqueue(item("b"));
    await q.enqueue(item("a"));
    expect((await q.pending()).map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("stops at the first network failure and keeps the item", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    await q.enqueue(item("a"));
    await q.enqueue(item("b"));
    let calls = 0;
    const res = await q.flush(async () => {
      calls++;
      return { ok: false, permanent: false, error: "offline" };
    });
    expect(calls).toBe(1);
    expect(res.sent).toEqual([]);
    expect(res.remaining.map((i) => i.id)).toEqual(["a", "b"]);
    expect(res.remaining[0].attempts).toBe(1);
  });
  it("drops permanently rejected items and continues", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    await q.enqueue(item("bad"));
    await q.enqueue(item("good"));
    const res = await q.flush(async (i) => (i.id === "bad" ? { ok: false, permanent: true, error: "impossible score" } : { ok: true }));
    expect(res.rejected.map((r) => r.item.id)).toEqual(["bad"]);
    expect(res.sent.map((i) => i.id)).toEqual(["good"]);
    expect(res.remaining).toEqual([]);
  });
  it("treats thrown errors as transient", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    await q.enqueue(item("a"));
    const res = await q.flush(async () => {
      throw new Error("Failed to fetch");
    });
    expect(res.remaining).toHaveLength(1);
    // reconnect → sends
    const res2 = await q.flush(async () => ({ ok: true }));
    expect(res2.sent).toHaveLength(1);
    expect(await q.pending()).toEqual([]);
  });
  it("filters by match and clears", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    await q.enqueue(item("a", "m1"));
    await q.enqueue(item("b", "m2"));
    expect(await q.pending("m2")).toHaveLength(1);
    await q.clear("m1");
    expect((await q.pending()).map((i) => i.id)).toEqual(["b"]);
  });
});
