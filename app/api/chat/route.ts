import { NextRequest, NextResponse } from "next/server";
import { ChatBodySchema } from "@/lib/chat";
import { answerChatQuestion } from "@/lib/llm";
import { gateAuditRequest } from "@/lib/security/gate";
import { auditLog } from "@/lib/security/audit-log";
import { securityConfig, allowPlatformKey } from "@/lib/security/config";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/chat - answer a follow-up question about a finished audit.
//
// Deliberately does NOT touch the TinyFish Search or Fetch APIs. The report the
// user is already looking at is the whole source of truth; this call spends
// nothing but one bounded generation.
//
// A missing or failing LLM is not an error: the route answers 200 with
// generated:false and a machine-readable reason, so the client can fall back to
// the rule-based text it already holds.
// ---------------------------------------------------------------------------

/**
 * Ceiling on the whole envelope. Sized above the largest digest the contract in
 * lib/chat can produce even with every field at its cap, so a valid-but-heavy
 * report is never turned away; the per-field limits are what actually bound the
 * prompt, via llmMaxPromptChars.
 */
const MAX_BODY_BYTES = 256 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

function jsonError(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (typeof extra?.retryAfterSec === "number" && extra.retryAfterSec > 0) {
    headers["Retry-After"] = String(Math.min(Math.ceil(extra.retryAfterSec), 86_400));
  }
  return NextResponse.json({ error, message, ...extra }, { status, headers });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const cfg = securityConfig();

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "invalid_request", "Request body is too large.");
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonError(413, "invalid_request", "Request body is too large.");
    }
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON.");
  }

  const parsed = ChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid request body.");
  }

  const { question, history, digest } = parsed.data;
  const bodyKey = (parsed.data.tinyfishKey ?? "").trim();

  // Same pre-flight gate as an audit: identity, rate limits, concurrency and
  // the platform-key budgets all run before anything reaches the model, so a
  // rejected question costs the site owner nothing.
  const gate = await gateAuditRequest({
    req,
    byokKey: bodyKey || null,
    wantsLlm: parsed.data.llmProvider === "gemini",
  });
  if (!gate.ok) {
    return jsonError(gate.status, gate.code, gate.message, {
      retryable: gate.status === 429 || gate.status === 503,
      retryAfterSec: gate.retryAfterSec,
    });
  }
  const { identity } = gate;

  // The concurrency slot must be returned on every exit path. Releasing is
  // idempotent so the finally below can run unconditionally.
  let gateReleased = false;
  const release = async () => {
    if (gateReleased) return;
    gateReleased = true;
    await gate.release();
  };

  try {
    const answer = await answerChatQuestion(
      { digest, question, history },
      {
        llmKey: parsed.data.llmKey,
        llmProvider: parsed.data.llmProvider,
        /**
         * The platform Gemini key is opt-in under exactly the same rules as the
         * platform TinyFish key. Passing "" stops the reach for GEMINI_API_KEY
         * when platform keys are disabled, so anonymous traffic can never be
         * billed to the developer.
         */
        envKey: allowPlatformKey() ? undefined : "",
        maxOutputTokens: cfg.cost.llmMaxOutputTokens,
        maxPromptChars: cfg.cost.llmMaxPromptChars,
        timeoutMs: 25_000,
      }
    );

    auditLog({
      event: "chat.call",
      requestId: identity.requestId,
      actorId: identity.actorId,
      keyId: identity.keyId,
      keySource: identity.keySource,
      model: "gemini-2.0-flash",
      status: answer.generated ? "ok" : (answer.warning ?? "skipped"),
      latencyMs: Date.now() - startedAt,
      totalTokens: answer.usage?.totalTokens,
      promptTokens: answer.usage?.promptTokens,
      outputTokens: answer.usage?.outputTokens,
      // Question text is user content and is never logged; size is enough to
      // spot abuse.
      detail: `question_chars:${question.length} history_turns:${history.length}`,
    });

    return NextResponse.json(
      {
        answer: answer.text,
        generated: answer.generated,
        provider: answer.provider,
        ...(answer.warning ? { reason: answer.warning } : {}),
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (e) {
    auditLog({
      event: "chat.failed",
      requestId: identity.requestId,
      actorId: identity.actorId,
      keyId: identity.keyId,
      keySource: identity.keySource,
      status: "internal_error",
      latencyMs: Date.now() - startedAt,
      detail: e instanceof Error ? e.name : "unknown",
    });
    return jsonError(500, "internal_error", "Could not answer that question.", { retryable: true });
  } finally {
    await release();
  }
}
