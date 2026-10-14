import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import { Providers } from "./providers";

const display = localFont({ src: [{ path: "./fonts/AutourOne-Regular.woff2", weight: "400", style: "normal" }], variable: "--nf-display", display: "swap", preload: true });
const body = localFont({
  src: [{ path: "./fonts/LXGWWenKaiTC-Regular.woff2", weight: "400", style: "normal" }, { path: "./fonts/LXGWWenKaiTC-Bold.woff2", weight: "700", style: "normal" }],
  variable: "--nf-body", display: "swap", preload: true,
});

export const metadata: Metadata = {
  title: { default: "Mock2Pitch", template: "%s · Mock2Pitch" },
  description: "Rehearse your pitch in private. Upload your slides, present out loud to a calm virtual jury, and get honest, encouraging feedback.",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#00072D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <div id="m2p-root"><Providers>{children}</Providers></div>
      </body>
    </html>
  );
}
