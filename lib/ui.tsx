"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion as usePrefersReducedMotion,
} from "motion/react";
import {
  Check,
  CheckCircle,
  Copy,
  Moon,
  Sun,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

/** Join class names, dropping falsy values. */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/** Re-exported so feature workstreams share one motion import. */
export { useReducedMotion } from "motion/react";

/** Brand mark with user requested sage palette */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <rect width="28" height="28" rx="8" fill="#5C7057" />
      <circle cx="14" cy="14" r="8.5" stroke="#ACC5A6" strokeWidth="1.8" fill="none" opacity="0.7" />
      <path
        d="M7 16a7 7 0 0 1 14 0"
        stroke="#D1EDD3"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="14" cy="16" r="2.2" fill="#D1EDD3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Report dashboard tokens: Sage (#5C7057, #89A482, #ACC5A6, #D1EDD3)  */
/* and Complementary Warm Terracotta / Coral (#D97757)                */
/* ------------------------------------------------------------------ */

/** Score-grade text color. */
export function gradeTextClass(grade?: string): string {
  switch (grade) {
    case "A":
      return "text-sage-500 dark:text-sage-300";
    case "B":
      return "text-sage-400 dark:text-sage-200";
    case "C":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-coral-500 dark:text-coral-400";
  }
}

/** Tinted pill badge for a score grade. */
export function gradeBadgeClass(grade?: string): string {
  switch (grade) {
    case "A":
      return "bg-sage-100 text-sage-800 ring-1 ring-sage-500/30 dark:bg-sage-900/60 dark:text-sage-200 dark:ring-sage-400/30";
    case "B":
      return "bg-sage-50 text-sage-700 ring-1 ring-sage-300/30 dark:bg-sage-900/40 dark:text-sage-300 dark:ring-sage-300/30";
    case "C":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-400/30";
    default:
      return "bg-coral-50 text-coral-800 ring-1 ring-coral-500/30 dark:bg-coral-950/60 dark:text-coral-300 dark:ring-coral-400/30";
  }
}

/** Clipboard copy with a textarea fallback. Resolves true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      return true;
    } catch {
      return false;
    }
  }
}

/** Small "Copy" pill button with toast feedback ("Copied"). */
export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [done, setDone] = useState(false);

  async function onClick() {
    const ok = await copyText(text);
    toast(ok ? "Copied" : "Copy failed — select the text manually");
    if (ok) {
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    }
  }

  const Icon = done ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={done ? "Copied to clipboard" : label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-sage-200 px-2.5 py-0.5 text-xs font-medium text-sage-800 transition-colors hover:bg-sage-100/70",
        "dark:border-sage-800 dark:text-sage-200 dark:hover:bg-sage-900/80",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Entrance wrapper: fades up 24px to 0 once when scrolled into view.
 *  Renders statically when the user prefers reduced motion. */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

type StatusTone = "pass" | "warn" | "fail";

const STATUS_TONE: Record<
  StatusTone,
  {
    Icon: typeof CheckCircle;
    card: string;
    head: string;
    icon: string;
    item: string;
    sub: string;
  }
> = {
  pass: {
    Icon: CheckCircle,
    card: "border-sage-200/90 dark:border-sage-800/80 bg-white dark:bg-[#151D16]",
    head: "text-sage-700 dark:text-sage-200",
    icon: "text-sage-500 dark:text-sage-300",
    item: "text-sage-950 dark:text-sage-100",
    sub: "text-sage-800/80 dark:text-sage-300/80",
  },
  warn: {
    Icon: WarningCircle,
    card: "border-amber-200/90 dark:border-amber-900/70 bg-white dark:bg-[#151D16]",
    head: "text-amber-800 dark:text-amber-200",
    icon: "text-amber-600 dark:text-amber-400",
    item: "text-amber-950 dark:text-amber-100",
    sub: "text-amber-900/80 dark:text-amber-200/80",
  },
  fail: {
    Icon: XCircle,
    card: "border-coral-200/90 dark:border-coral-900/70 bg-white dark:bg-[#151D16]",
    head: "text-coral-800 dark:text-coral-200",
    icon: "text-coral-500 dark:text-coral-400",
    item: "text-coral-950 dark:text-coral-100",
    sub: "text-coral-900/80 dark:text-coral-200/80",
  },
};

/** CAN / Partial / CAN'T grouped check list with a status icon header. */
export function StatusGroup({
  title,
  count,
  tone,
  items,
  emptyText,
}: {
  title: string;
  count: number;
  tone: StatusTone;
  items: Array<{ id: string; label: string; evidence: string }>;
  emptyText: string;
}) {
  const t = STATUS_TONE[tone];
  const Icon = t.Icon;
  return (
    <div
      className={cn(
        "h-full rounded-card border p-4 shadow-card",
        t.card,
      )}
    >
      <h3 className={cn("flex items-center gap-1.5 text-sm font-semibold", t.head)}>
        <Icon className={cn("h-4 w-4 shrink-0", t.icon)} weight="fill" aria-hidden="true" />
        <span>
          {title} <span className="tabular-nums">({count})</span>
        </span>
      </h3>
      {items.length === 0 ? (
        <p className={cn("mt-1.5 text-sm", t.sub)}>{emptyText}</p>
      ) : (
        <ul className="mt-2 grid gap-2.5">
          {items.map((c) => (
            <li key={c.id} className={cn("flex gap-2 text-sm", t.item)}>
              <Icon
                className={cn("mt-0.5 h-4 w-4 shrink-0", t.icon)}
                weight="fill"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="font-medium">{c.label}. </span>
                <span className={t.sub}>{c.evidence}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

const THEME_KEY = "sitescore-theme";

function currentIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("storage", onChange);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onChange);
  };
}

/** Header dark-mode toggle. Persists to localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeTheme, currentIsDark, () => false);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }

  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-sage-200/70 bg-white/60",
        "text-sage-700 transition-colors hover:border-sage-400 hover:bg-sage-100 hover:text-sage-950",
        "dark:border-sage-800 dark:bg-sage-950/60 dark:text-sage-300 dark:hover:border-sage-600 dark:hover:bg-sage-900 dark:hover:text-sage-100",
        className,
      )}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">
        <Icon className="h-4 w-4" weight="bold" aria-hidden="true" />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Toast notification provider                                        */
/* ------------------------------------------------------------------ */

type Toast = { id: number; message: string };

type ToastContextValue = {
  toast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn(
                "pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border",
                "border-sage-800 bg-sage-950 py-2 pl-3.5 pr-4 text-xs font-medium text-sage-50 shadow-lift",
                "dark:border-sage-200 dark:bg-sage-100 dark:text-sage-950",
              )}
            >
              <CheckCircle
                className="h-4 w-4 shrink-0 text-sage-300 dark:text-sage-600"
                weight="fill"
                aria-hidden="true"
              />
              <span className="truncate">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
