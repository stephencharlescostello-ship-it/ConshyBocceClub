"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void> };

export function InstallButton() {
  const [bip, setBip] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const check = setTimeout(() => { if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true); }, 0);
    const h = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => { clearTimeout(check); window.removeEventListener("beforeinstallprompt", h); };
  }, []);
  if (installed) return <p className="mt-3 text-sm font-semibold text-success">Already installed — you&apos;re using the app.</p>;
  return <button type="button" className="btn btn-accent mt-3 w-full" disabled={!bip} onClick={() => bip?.prompt()}><Download className="h-5 w-5" /> {bip ? "Install app" : "Install from the browser menu"}</button>;
}
