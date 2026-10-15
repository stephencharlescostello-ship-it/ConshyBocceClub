import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ServiceWorker } from "@/components/shell/service-worker";
import { Toaster } from "@/components/ui/toast";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const sora = Sora({ variable: "--font-display", subsets: ["latin"], display: "swap", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "CBC Shuffle", template: "%s · CBC Shuffle" },
  description: "Conshohocken Bocce Club shuffleboard league: live scores, standings, schedule and trash talk.",
  applicationName: "CBC Shuffle",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CBC Shuffle", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/apple-180", sizes: "180x180", type: "image/png" }] },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1f17" },
    { media: "(prefers-color-scheme: light)", color: "#f6f1e4" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = (await cookies()).get("theme")?.value;
  const dataTheme = theme === "light" || theme === "dark" ? theme : theme === "system" ? undefined : "dark";
  return (
    <html lang="en" data-theme={dataTheme} className={`${inter.variable} ${sora.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {theme === "system" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'`,
            }}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
