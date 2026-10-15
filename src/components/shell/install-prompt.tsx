"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Android: native install prompt. iPhone: link to the illustrated Add to Home Screen sheet. Shown on the home screen only so it never covers a scoring or confirm button. */
export function InstallPrompt() {
  const pathname = usePathname();
  const [bip, setBip] = useState<BIP | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("installDismissed")) return;
    } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const iosTimer = setTimeout(() => setIos(isIos), 0);
    const handler = (e: Event) => {
      e.preventDefault();
      setBip(e as BIP);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const showTimer = isIos ? setTimeout(() => setShow(true), 4000) : null;
    return () => {
      clearTimeout(iosTimer);
      if (showTimer) clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);
  if (!show || pathname !== "/") return null;
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem("installDismissed", "1");
    } catch {}
  };
  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl px-4">
      <div className="card flex items-center gap-3 p-3 shadow-card">
        <Download className="h-6 w-6 shrink-0 text-accent" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Add CBC Shuffle to your home screen</p>
          <p className="text-muted">Faster, works offline, gets notifications.</p>
        </div>
        {bip ? (
          <button className="btn btn-accent !min-h-[44px] px-3 text-sm" onClick={async () => { await bip.prompt(); dismiss(); }}>Install</button>
        ) : ios ? (
          <Link href="/install" className="btn btn-accent !min-h-[44px] px-3 text-sm" onClick={dismiss}>How</Link>
        ) : null}
        <button className="tap flex items-center justify-center text-muted" aria-label="Dismiss" onClick={dismiss}><X className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
