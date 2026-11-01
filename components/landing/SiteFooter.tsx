"use client";

import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Faders,
  GithubLogo,
} from "@phosphor-icons/react";
import { MascotMark } from "./Mascot";
import { API_KEYS_URL, DOCS_URL, REPO_URL, SECURITY_DOC_URL } from "@/lib/links";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Why AI visibility", href: "#visibility" },
];

const RESOURCE_LINKS = [
  { label: "TinyFish docs", href: DOCS_URL, external: true },
  { label: "Get an API key", href: API_KEYS_URL, external: true },
  { label: "Source on GitHub", href: REPO_URL, external: true },
  { label: "Security model", href: SECURITY_DOC_URL, external: true },
];

const FACTS = [
  "No signup, no account, no card",
  "Bring your own TinyFish key, or run without one",
  "Keys stay in memory and never touch a server",
  "Run history lives only in this browser",
  "Export the report as Markdown, JSON, or print",
];

interface SiteFooterProps {
  onStartAudit: () => void;
  onOpenSettings: () => void;
}

export function SiteFooter({ onStartAudit, onOpenSettings }: SiteFooterProps) {
  return (
    <footer className="border-t border-[var(--surface-border)] pb-10 pt-14 sm:pt-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.5fr]">
          {/* brand */}
          <div>
            <a href="#top" className="inline-flex items-center gap-2.5">
              <MascotMark size={34} />
              <span className="text-[15px] font-semibold tracking-tight">
                SiteScore
              </span>
            </a>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-[var(--text-muted)]">
              The readability audit for the AI search era. Check what assistants
              and answer engines can actually see on your page, then fix what
              blocks them.
            </p>
          </div>

          {/* product */}
          <nav aria-label="Product">
            <h2 className="footer-heading">Product</h2>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="footer-link">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <button type="button" onClick={onStartAudit} className="footer-link">
                  Run an audit
                </button>
              </li>
            </ul>
          </nav>

          {/* resources */}
          <nav aria-label="Resources">
            <h2 className="footer-heading">Resources</h2>
            <ul className="mt-4 space-y-2.5">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="footer-link"
                  >
                    {l.label}
                    <ArrowUpRight weight="bold" className="h-3 w-3 opacity-60" />
                  </a>
                </li>
              ))}
              <li>
                <button type="button" onClick={onOpenSettings} className="footer-link">
                  <Faders weight="bold" className="h-3 w-3 opacity-60" />
                  API keys
                </button>
              </li>
            </ul>
          </nav>

          {/* facts */}
          <div>
            <h2 className="footer-heading">Good to know</h2>
            <ul className="mt-4 space-y-2.5">
              {FACTS.map((f) => (
                <li key={f} className="footer-fact">
                  <Check weight="bold" className="footer-fact__icon h-3 w-3" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--surface-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-[var(--text-subtle)]">
            © 2026 SiteScore. Built with TinyFish Search + Fetch. Live pages
            only, never cached copies.
          </p>
          <div className="flex items-center gap-5">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="SiteScore source on GitHub"
              className="nav-icon h-8 w-8"
            >
              <GithubLogo className="h-4 w-4" weight="bold" />
            </a>
            <a href="#top" className="footer-link">
              <span>Back to top</span>
              <ArrowUp weight="bold" className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
