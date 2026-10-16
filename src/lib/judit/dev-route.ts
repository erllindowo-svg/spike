import "server-only";

import { z } from "zod";

import { getServerEnv } from "@/lib/env";

import {
  JuditApplicationError,
  JuditError,
  JuditDuplicateCallError,
  JuditGuardError,
  JuditLocalRateLimitError,
  JuditHttpError,
  JuditLiveCallsDisabledError,
  JuditRateLimitError,
  JuditUnexpectedResponseError,
} from "./errors";

// Shared logic for the manual-testing routes under src/app/api/dev/judit.
//
// Why these routes must not exist in production: each call spends JUDIT
// credits and returns lawsuit and registration data. A public route has no
// way to know who is calling, so anyone who finds the URL could drain the
// key's credits (a cost attack) or use our key to look up people. The
// allowlist limits *what* can be searched, not *who* searches. So the routes
// answer 404 unless the server runs in development AND the kill switch is on.

export function devJuditRoutesEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    getServerEnv("JUDIT_LIVE_CALLS") === "enabled"
  );
}

export function notFoundResponse(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}

type InputResult<T> = { ok: true; data: T } | { ok: false; response: Response };

// Parses the JSON body against a strict schema at the route boundary.
export async function readInput<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<InputResult<z.infer<Schema>>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: invalidInput(["corpo não é JSON"]) };
  }
  return validate(schema, json);
}

// Parses query string parameters (all strings; use z.coerce for numbers).
export function readQuery<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): InputResult<z.infer<Schema>> {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return validate(schema, query);
}

function validate<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): InputResult<z.infer<Schema>> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      response: invalidInput(
        parsed.error.issues.map(
          (issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`,
        ),
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

function invalidInput(issues: string[]): Response {
  return Response.json(
    { error: { kind: "invalid_input", issues } },
    { status: 400 },
  );
}

// Turns a thrown error into a JSON response with only diagnostic fields.
// The status code describes *our* route's view of the failure: 502/504 mean
// "the upstream (JUDIT) failed", not that this route is broken.
export function errorResponse(error: unknown): Response {
  if (!(error instanceof JuditError)) {
    // Unknown errors are not echoed: their message could contain anything.
    console.error("[dev/judit] unexpected error", error);
    return Response.json(
      { error: { kind: "internal", message: "Erro inesperado no servidor." } },
      { status: 500 },
    );
  }

  const base = { kind: error.kind, name: error.name, message: error.message };

  if (error instanceof JuditLiveCallsDisabledError) {
    return Response.json({ error: base }, { status: 503 });
  }
  // Cost protections: per-minute limit (429) and duplicate call (409).
  if (error instanceof JuditLocalRateLimitError) {
    return Response.json({ error: base }, { status: 429 });
  }
  if (error instanceof JuditDuplicateCallError) {
    return Response.json({ error: base }, { status: 409 });
  }
  if (error instanceof JuditGuardError) {
    return Response.json({ error: base }, { status: 403 });
  }
  if (error instanceof JuditRateLimitError) {
    return Response.json(
      { error: { ...base, rateLimit: error.rateLimit } },
      { status: 429 },
    );
  }
  if (error instanceof JuditHttpError) {
    return Response.json(
      {
        error: {
          ...base,
          upstreamStatus: error.status,
          errorName: error.errorName,
          errorMessage: error.errorMessage,
          bodySnippet: error.bodySnippet,
        },
      },
      { status: 502 },
    );
  }
  if (error instanceof JuditApplicationError) {
    return Response.json(
      {
        error: {
          ...base,
          code: error.code,
          applicationMessage: error.applicationMessage,
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof JuditUnexpectedResponseError) {
    return Response.json(
      { error: { ...base, issues: error.issues } },
      { status: 502 },
    );
  }
  // Network failure or timeout.
  return Response.json(
    { error: base },
    { status: error.kind === "timeout" ? 504 : 502 },
  );
}
