/** Shared audit-engine types (pure - no network, no Next.js). */

export type CheckCategory = "readability" | "visibility" | "technical";
export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  category: CheckCategory;
  status: CheckStatus;
  label: string;
  detail: string;
  /** Must cite measured values (lengths, counts, positions, URLs). */
  evidence: string;
}

export type FixPriority = "P0" | "P1" | "P2";

export interface Fix {
  priority: FixPriority;
  title: string;
  /** Must cite measured values - never generic. */
  why: string;
  how: string;
  codeBefore: string;
  codeAfter: string;
}

export type Grade = "A" | "B" | "C" | "D";

export interface Scores {
  total: number;
  readability: number;
  visibility: number;
  technical: number;
  grade: Grade;
}

export interface QueryDerivation {
  query: string;
  querySource: "user" | "auto";
}

export interface Connection {
  summary: string;
  correlation: string;
}
