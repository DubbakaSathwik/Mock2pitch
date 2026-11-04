import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { connection } from "next/server";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Mock2Pitch", template: "%s · Mock2Pitch" },
  description: "Rehearse your pitch in private. Upload your slides, present out loud to a calm virtual jury, and get honest, encouraging feedback.",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#00072D" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The Content-Security-Policy carries a fresh script nonce per request (proxy.ts), and Next.js can only stamp it on pages rendered per request.
  await connection();
  // Preload only the two faces every page uses.
  preload("/fonts/AutourOne-Regular.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/LXGWWenKaiTC-Regular.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <div id="m2p-root"><Providers>{children}</Providers></div>
      </body>
    </html>
  );
}
