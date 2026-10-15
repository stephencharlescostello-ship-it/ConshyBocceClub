"use client";
import { get, set } from "idb-keyval";
import type { QueueItem, QueueStorage } from "@/lib/engine/offline-queue";

/** IndexedDB-backed queue storage (one key per match) with a localStorage fallback. */
export class IdbStorage implements QueueStorage {
  constructor(private key: string) {}
  async load(): Promise<QueueItem[]> {
    try {
      return ((await get(this.key)) as QueueItem[] | undefined) ?? [];
    } catch {
      try {
        return JSON.parse(localStorage.getItem(this.key) ?? "[]") as QueueItem[];
      } catch {
        return [];
      }
    }
  }
  async save(items: QueueItem[]) {
    try {
      await set(this.key, items);
    } catch {
      try {
        localStorage.setItem(this.key, JSON.stringify(items));
      } catch {}
    }
  }
}
