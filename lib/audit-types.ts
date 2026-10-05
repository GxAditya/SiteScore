/** Shared client-safe audit types (mirror the POST /api/audit contract). */

export type CheckStatus = "pass" | "warn" | "fail";
export type CheckCategory = "readability" | "visibility" | "technical";
export type FixPriority = "P0" | "P1" | "P2";
export type ReportTabId = "overview" | "fixes" | "visibility" | "readability" | "evidence";

export interface AuditCheck {
  id: string;
  category: CheckCategory;
  status: CheckStatus;
  label: string;
  detail: string;
  evidence: string;
}

export interface AuditFix {
  priority: FixPriority;
  title: string;
  why: string;
  how: string;
  codeBefore: string;
  codeAfter: string;
}

export interface SerpEntry {
  position: number | null;
  siteName: string;
  title: string;
  url: string;
  snippet: string;
}

export interface FetchHtml {
  url?: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  language?: string;
  author?: string;
  publishedDate?: string;
  textLength?: number;
  excerpt?: string;
  linkCount?: number;
  imageLinkCount?: number;
  latencyMs?: number;
  h1?: string;
  error?: string;
}

export interface FetchMarkdown {
  url?: string;
  finalUrl?: string;
  wordCount?: number;
  textLength?: number;
  excerpt?: string;
  latencyMs?: number;
  error?: string;
}

export interface AuditReport {
  input: {
    url: string;
    finalUrl: string;
    query: string;
    querySource: "user" | "auto";
    fetchedAt: string;
  };
  score: {
    total: number;
    readability: number;
    visibility: number;
    technical: number;
    grade?: string;
  };
  fetch: {
    html: FetchHtml;
    markdown: FetchMarkdown;
    redirected: boolean;
    wordCount: number;
    latencyMs: number;
  };
  search: {
    indexation: {
      query: string;
      indexed: boolean;
      matchUrl: string | null;
      totalResults: number;
      results: SerpEntry[];
      error?: string;
    };
    ranking: {
      query: string;
      rank: number | null;
      totalResults: number;
      results: SerpEntry[];
      error?: string;
    };
    competitors: SerpEntry[];
  };
  checks: AuditCheck[];
  fixes: AuditFix[];
  connection: {
    summary: string;
    correlation: string;
  };
  aiSummary: {
    text: string;
    provider: string;
    generated: boolean;
  };
  raw: {
    searchQueries: string[];
    fetchErrors: Array<{ url: string; error: string; status?: number }>;
  };
}

export interface ApiFailure {
  status: number;
  code: string;
  message: string;
  retryable?: boolean;
  docs?: string;
}

export function gradeFor(total: number): string {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 50) return "C";
  return "D";
}
