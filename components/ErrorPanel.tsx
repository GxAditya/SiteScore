import type { ReactNode } from "react";
import {
  ArrowClockwise,
  Clock,
  Globe,
  Key,
  Warning,
} from "@phosphor-icons/react";
import type { ApiFailure } from "@/lib/audit-types";
import { API_KEYS_URL } from "@/lib/links";

interface ActionInfo {
  title: string;
  next: string;
}

/** Every failure the service can return, answered in plain words. */
function actionFor(code: string): ActionInfo {
  switch (code) {
    case "missing_api_key":
      return {
        title: "There is no search service key yet",
        next: "Add your free TinyFish key in settings and try again. It stays in memory and nothing is saved on our side.",
      };
    case "invalid_api_key":
      return {
        title: "The key was turned away",
        next: "The service rejected that key. Look for a stray space or a typo, generate a fresh one, and try again.",
      };
    case "rate_limited":
      return {
        title: "Too many runs at once",
        next: "Free usage is capped at 30 searches a minute and 150 page reads. Wait about a minute and try again.",
      };
    case "invalid_url":
    case "invalid_request":
      return {
        title: "That address will not work",
        next: "Type the whole web address, like https://example.com/page. A bare domain is fine too, we add the rest.",
      };
    case "private_host_not_allowed":
      return {
        title: "That address is inside a private network",
        next: "Local and internal addresses cannot be reached from the outside. Audit a public web address instead.",
      };
    case "upstream_timeout":
    case "timeout":
      return {
        title: "It took too long to answer",
        next: "Either the page or the search service stalled. Try once more. If it repeats, the page itself is slow, which is its own finding.",
      };
    case "bot_blocked":
    case "fetch_error_bot_blocked":
      return {
        title: "Your own security stopped the reader",
        next: "The bot protection on the site turned the reader away. Let well-behaved search and AI readers through, then try again. AI assistants arrive the same way.",
      };
    case "login_required":
    case "fetch_error_login_required":
      return {
        title: "The page asked for a sign-in",
        next: "Anyone not signed in sees only the login form, and so does every AI tool. Audit a public address that carries the real content.",
      };
    case "empty_content":
    case "fetch_error_empty_content":
      return {
        title: "The page arrived with no text on it",
        next: "The read worked but returned no words, usually because scripts build the page after it loads. Put the main text in the page itself and try again.",
      };
    case "page_not_found":
    case "fetch_error_page_not_found":
      return {
        title: "Nothing is at that address",
        next: "Check for a typo, put the page back, or point the old address at whatever replaced it.",
      };
    case "tinyfish_unavailable":
    case "fetch_failed":
    case "search_failed":
    case "fetch_rejected":
      return {
        title: "The service behind the check had an error",
        next: "Wait a moment and try again. This says nothing about your page, so read no result into it.",
      };
    case "request_timeout":
      return {
        title: "The run ran out of time",
        next: "Try again once. If it keeps running out of time, the page is very slow to respond.",
      };
    default:
      return {
        title: "The run stopped",
        next: "Try again. If it keeps failing, test a different address to see whether the problem is the page or the service.",
      };
  }
}

function iconFor(code: string): ReactNode {
  const props = {
    className: "h-4.5 w-4.5",
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
  const docsHref = failure.docs ?? (showKeysLink ? API_KEYS_URL : null);

  return (
    <section
      role="alert"
      aria-label="The audit stopped"
      className="panel panel--alert w-full p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--fail-strong)]"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <span className="state-pill state-pill--fail">Stopped</span>
          <h2 className="panel-title mt-1.5">{action.title}</h2>
        </div>
      </div>

      <div className="inset mt-3.5 px-3 py-2.5">
        <p className="panel-eyebrow">What the check reported</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">
          {failure.message}
        </p>
      </div>

      <div className="alert-well mt-2.5 px-3 py-2.5">
        <p className="panel-eyebrow">What to do</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">
          {action.next}
        </p>
      </div>

      <p className="check-row__tech mt-2.5">
        code: {failure.code} · HTTP {failure.status}
        {failure.retryable ? " · retryable" : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className="btn-primary">
          <ArrowClockwise aria-hidden="true" className="h-4 w-4" weight="bold" />
          <span className="text-sm">Try the run again</span>
        </button>
        {docsHref ? (
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            <span className="text-sm">
              {showKeysLink ? "Get a free key" : "Read the docs"}
            </span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
