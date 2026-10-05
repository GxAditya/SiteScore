import type { Check, CheckCategory, Grade, Scores } from "./types";

export const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
  readability: 0.4,
  visibility: 0.35,
  technical: 0.25,
};

const STATUS_POINTS = { pass: 1, warn: 0.5, fail: 0 } as const;

export function gradeForScore(total: number): Grade {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 50) return "C";
  return "D";
}

/**
 * Weighted 0–100 total + per-category 0–100 subscores + grade.
 * Deterministic: same checks → same output. Within a category every
 * check counts equally; categories combine 40 / 35 / 25.
 */
export function scoreFromChecks(checks: Check[]): Scores {
  const categories: CheckCategory[] = ["readability", "visibility", "technical"];
  const sub: Record<CheckCategory, number> = {
    readability: 0,
    visibility: 0,
    technical: 0,
  };
  for (const category of categories) {
    const group = checks.filter((c) => c.category === category);
    if (group.length === 0) {
      sub[category] = 0;
      continue;
    }
    const points = group.reduce((sum, c) => sum + STATUS_POINTS[c.status], 0);
    sub[category] = Math.round((points / group.length) * 100);
  }
  const total = Math.round(
    sub.readability * CATEGORY_WEIGHTS.readability +
      sub.visibility * CATEGORY_WEIGHTS.visibility +
      sub.technical * CATEGORY_WEIGHTS.technical
  );
  return {
    total,
    readability: sub.readability,
    visibility: sub.visibility,
    technical: sub.technical,
    grade: gradeForScore(total),
  };
}
