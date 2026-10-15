"use client";
import { useEffect } from "react";

/** Registers the app-shell service worker (caching + push). */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !location.search.includes("sw=1")) return; // avoid stale caches in dev
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
