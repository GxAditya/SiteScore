import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { ToastProvider } from "@/lib/ui";
import "./globals.css";

const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_NAME = "SiteScore";
const SITE_DESCRIPTION =
  "Audit how AI search and fetch tools read, index, and understand your website. Real-time TinyFish Search & Fetch probes with prioritized fixes.";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — AI Search & Readability Auditor`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "SiteScore — AI Search & Readability Auditor",
    description: SITE_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SiteScore — AI Search & Readability Auditor",
    description: SITE_DESCRIPTION,
  },
};

const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("sitescore-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} min-h-dvh bg-[var(--surface)] font-sans text-[var(--text)] antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-sage-500 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <ToastProvider>
          <div id="content" className="min-h-dvh">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
