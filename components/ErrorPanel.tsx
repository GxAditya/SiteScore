import type { ReactNode } from "react";
import {
  ArrowClockwise,
  Clock,
  Globe,
  Key,
  Warning,
} from "@phosphor-icons/react";
import type { ApiFailure } from "@/lib/audit-types";

const TINYFISH_KEYS_URL = "https://agent.tinyfish.ai/api-keys";

interface ActionInfo {
  title: string;
  next: string;
}

function actionFor(code: string): ActionInfo {
  switch (code) {
    case "missing_api_key":
      return {
        title: "API key missing",
        next: "Add your TinyFish key under Settings → API keys and retry, or set TINYFISH_API_KEY on the server. Keys are free.",
      };
    case "invalid_api_key":
      return {
        title: "API key rejected",
        next: "The TinyFish key was rejected (401). Check for typos or extra spaces, generate a fresh key, and retry.",
      };
    case "rate_limited":
      return {
        title: "Rate limit reached (429)",
        next: "TinyFish throttled the request (Search: 30/min, Fetch: 150 URLs/min). Wait about a minute and retry.",
      };
    case "invalid_url":
    case "invalid_request":
      return {
        title: "Invalid URL",
        next: "Enter a full http(s) URL, e.g. https://example.com/page. Bare domains are accepted and get https:// prepended.",
      };
    case "private_host_not_allowed":
      return {
        title: "Host not allowed",
        next: "Localhost, private-network and cloud-metadata hosts cannot be audited. Use a publicly reachable URL instead.",
      };
    case "upstream_timeout":
    case "timeout":
      return {
        title: "Upstream timed out",
        next: "The page or TinyFish took too long. Retry once; if it repeats, the page itself is too slow - that is itself a P1 finding (fetch latency).",
      };
    case "bot_blocked":
    case "fetch_error_bot_blocked":
      return {
        title: "Fetch blocked by bot protection",
        next: "The server treated the fetch crawler as a bot. Allowlist well-behaved AI fetchers for this path and retry - AI assistants hit the same wall.",
      };
    case "login_required":
    case "fetch_error_login_required":
      return {
        title: "Page requires login",
        next: "Anonymous fetchers see a sign-in wall, so AI tools see nothing. Publish the key content on a public URL and audit that instead.",
      };
    case "empty_content":
    case "fetch_error_empty_content":
      return {
        title: "Page returned empty content",
        next: "Fetch succeeded but extracted nothing - likely a script-only page. Server-render the main content into the HTML and retry.",
      };
    case "page_not_found":
    case "fetch_error_page_not_found":
      return {
        title: "Page not found",
        next: "Check the URL for typos, restore the page, or 301-redirect it to its replacement, then retry.",
      };
    case "tinyfish_unavailable":
    case "fetch_failed":
    case "search_failed":
    case "fetch_rejected":
      return {
        title: "TinyFish unavailable",
        next: "The upstream API errored. Wait a moment and retry - nothing about your page can be concluded from this.",
      };
    case "request_timeout":
      return {
        title: "Request timed out",
        next: "The audit exceeded the time budget. Retry once; persistent timeouts point at a very slow page (see the latency fix).",
      };
    default:
      return {
        title: "Audit failed",
        next: "Retry the audit. If it keeps failing, try a different URL to isolate whether the problem is the page or the service.",
      };
  }
}

function iconFor(code: string): ReactNode {
  const props = {
    className: "h-5 w-5",
    weight: "bold" as const,
    "aria-hidden": true as const,
  };
  switch (code) {
    case "missing_api_key":
    case "invalid_api_key":
      return <Key {...props} />;
    case "rate_limited":
    case "upstream_timeout":
    case "timeout":
    case "request_timeout":
      return <Clock {...props} />;
    case "invalid_url":
    case "invalid_request":
    case "private_host_not_allowed":
    case "page_not_found":
    case "fetch_error_page_not_found":
      return <Globe {...props} />;
    default:
      return <Warning {...props} />;
  }
}

interface ErrorPanelProps {
  failure: ApiFailure;
  onRetry: () => void;
}

export default function ErrorPanel({ failure, onRetry }: ErrorPanelProps) {
  const action = actionFor(failure.code);
  const icon = iconFor(failure.code);
  const showKeysLink =
    failure.code === "missing_api_key" || failure.code === "invalid_api_key";
  const docsHref = failure.docs ?? (showKeysLink ? TINYFISH_KEYS_URL : null);

  return (
    <section
      role="alert"
      aria-label="Audit error"
      className="w-full rounded-2xl border border-coral-300 bg-coral-50/80 p-5 dark:border-coral-900/80 dark:bg-coral-950/40 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral-100 text-coral-700 dark:bg-coral-900/60 dark:text-coral-300"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-coral-950 dark:text-coral-50">
            {action.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-coral-900 dark:text-coral-200">
            <span className="font-semibold">What happened: </span>
            {failure.message}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs sm:text-sm text-coral-950 dark:text-coral-100">
        <span className="font-semibold">Next action: </span>
        {action.next}
      </p>
      <p className="mt-2 min-w-0 break-words font-mono text-[11px] text-coral-700 dark:text-coral-400">
        code: {failure.code} · HTTP {failure.status}
        {failure.retryable ? " · retryable" : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-xl bg-coral-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-transform hover:bg-coral-700 active:scale-[0.98]"
        >
          <ArrowClockwise aria-hidden="true" className="h-3.5 w-3.5" weight="bold" />
          Retry audit
        </button>
        {docsHref && (
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-coral-400/80 px-4 py-2 text-xs font-semibold text-coral-900 transition-colors hover:bg-coral-100/60 dark:border-coral-700 dark:text-coral-200 dark:hover:bg-coral-900/40"
          >
            {showKeysLink ? "Get a free TinyFish key" : "Read docs"}
          </a>
        )}
      </div>
    </section>
  );
}
