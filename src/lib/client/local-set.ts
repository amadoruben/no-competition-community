"use client";

import { useSyncExternalStore } from "react";

/**
 * A set of ids kept in this browser's localStorage (watched stories, hidden
 * suggestions), shared by every component that reads it. Nothing is sent to
 * the server. Without storage (private mode) it simply starts empty.
 */
export function localSet(key: string, max = 400) {
  const listeners = new Set<() => void>();
  const EMPTY: ReadonlySet<string> = new Set();
  let cache: { raw: string | null; set: ReadonlySet<string> } = { raw: null, set: EMPTY };

  const read = (): ReadonlySet<string> => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return cache.set;
    }
    if (raw !== cache.raw) {
      let ids: string[] = [];
      try {
        ids = raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        ids = [];
      }
      cache = { raw, set: new Set(ids) };
    }
    return cache.set;
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => e.key === key && cb();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };

  return {
    /** The current ids; empty during server rendering and on first paint. */
    useIds: () => useSyncExternalStore(subscribe, read, () => EMPTY),
    add(id: string) {
      const now = read();
      if (now.has(id)) return;
      const next = [...now, id].slice(-max);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        cache = { raw: cache.raw, set: new Set(next) }; // storage unavailable: remember for this visit
      }
      listeners.forEach((l) => l());
    },
  };
}
