import type { ReactNode } from "react";

export const CARD_W = 1080;
export const CARD_H = 1920; // Instagram story; also fine in iMessage previews

/** Shared card chrome for share images rendered with next/og. */
export function CardFrame({ kicker, title, children, footer }: { kicker: string; title: string; children: ReactNode; footer?: string }) {
  return (
    <div style={{ width: CARD_W, height: CARD_H, display: "flex", flexDirection: "column", background: "linear-gradient(160deg, #0b1f17 0%, #143427 60%, #0b1f17 100%)", color: "#f4efe3", fontFamily: "sans-serif", padding: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "#1f6f4a", border: "4px solid #d4a73a", display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, fontWeight: 800 }}>CBC Shuffle</div>
          <div style={{ fontSize: 22, letterSpacing: 4, color: "#b9c8bf", textTransform: "uppercase" }}>Conshohocken Bocce Club</div>
        </div>
      </div>
      <div style={{ marginTop: 120, fontSize: 32, letterSpacing: 6, textTransform: "uppercase", color: "#d4a73a", fontWeight: 700 }}>{kicker}</div>
      <div style={{ marginTop: 16, fontSize: 76, fontWeight: 800, lineHeight: 1.05, display: "flex" }}>{title}</div>
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div style={{ fontSize: 26, color: "#7f978c", display: "flex", justifyContent: "space-between" }}>
        <span>{footer ?? ""}</span>
        <span>cbcshuffle</span>
      </div>
    </div>
  );
}
