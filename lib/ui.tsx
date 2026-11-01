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
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CheckCircle,
  Copy,
  Moon,
  Sun,
} from "@phosphor-icons/react";

/** Join class names, dropping falsy values. */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/** Re-exported so feature workstreams share one motion import. */
export { useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Shared report primitives                                            */
/* ------------------------------------------------------------------ */

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
  tone = "light",
}: {
  text: string;
  label: string;
  className?: string;
  /** "dark" sits on a console surface, so it needs its own palette. */
  tone?: "light" | "dark";
}) {
  const { toast } = useToast();
  const [done, setDone] = useState(false);

  async function onClick() {
    const ok = await copyText(text);
    toast(ok ? "Copied" : "Copy failed - select the text manually");
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
        "inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        tone === "dark"
          ? "border-white/15 bg-white/10 text-[#DCEBD5] hover:bg-white/20"
          : "border-sage-200 text-sage-800 hover:bg-sage-100/70 dark:border-sage-800 dark:text-sage-200 dark:hover:bg-sage-900/80",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Entrance wrapper: fades up 24px to 0 once when scrolled into view. */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
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
