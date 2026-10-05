/** SiteScore audit engine — pure functions, no network. Importable by /api/audit. */

export type {
  Check,
  CheckCategory,
  CheckStatus,
  Fix,
  FixPriority,
  Scores,
  Grade,
  QueryDerivation,
  Connection,
} from "./types";

export {
  deriveQuery,
  deriveQueryFromHtml,
  stripSiteSuffix,
  capQuery,
  firstWords,
  domainFromUrl,
  MAX_QUERY_LENGTH,
} from "./derive-query";
export type { DeriveQueryOptions } from "./derive-query";

export {
  parsePageFacts,
  buildChecks,
  countWords,
  normalizeUrl,
  hostOf,
  tokenizeQuery,
} from "./analyze";
export type { AnalyzeInput, PageFacts, SearchResultItem } from "./analyze";

export { scoreFromChecks, gradeForScore, CATEGORY_WEIGHTS } from "./score";

export { buildFixes, candidateTitle, candidateMeta } from "./fixes";
export type { FixesInput } from "./fixes";

export { buildConnection } from "./connect";
export type { ConnectionInput } from "./connect";

export { runAuditEngine } from "./engine";
export type { EngineInput, EngineOutput } from "./engine";
