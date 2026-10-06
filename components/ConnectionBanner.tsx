import { TrendUp } from "@phosphor-icons/react";

interface ConnectionBannerProps {
  summary: string;
  correlation: string;
}

export default function ConnectionBanner({
  summary,
  correlation,
}: ConnectionBannerProps) {
  return (
    <section
      id="connection"
      aria-label="Readability to visibility connection"
      className="w-full scroll-mt-24"
    >
      <div className="card border-sage-300/80 bg-sage-50/70 p-5 dark:border-sage-800 dark:bg-[#152017] sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sage-500/15 text-sage-700 ring-1 ring-inset ring-sage-500/25 dark:bg-sage-400/10 dark:text-sage-300 dark:ring-sage-400/25">
            <TrendUp className="h-4 w-4" weight="bold" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-sage-950 dark:text-sage-50">
            Readability Drives Visibility
          </h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-sage-950 dark:text-sage-100">
          {summary}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-sage-800 dark:text-sage-200/90">
          {correlation}
        </p>
      </div>
    </section>
  );
}
