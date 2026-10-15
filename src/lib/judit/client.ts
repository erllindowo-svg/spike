import "server-only";

import type { z } from "zod";

import { getServerEnv } from "@/lib/env";

import {
  JuditApplicationError,
  JuditHttpError,
  JuditNetworkError,
  JuditRateLimitError,
  JuditTimeoutError,
  JuditUnexpectedResponseError,
  type JuditCallInfo,
  type JuditService,
} from "./errors";
import { assertLiveCallsEnabled } from "./guard";
import {
  applicationErrorSchema,
  httpErrorBodySchema,
  type ApplicationErrorItem,
} from "./schemas/common";

// Shared fetch wrapper: the only place that knows the base URLs, the auth
// header, the timeout and how failures map to error classes.
//
// No automatic retries, on purpose. POST /requests and POST /tracking create
// billable work on JUDIT's side. If a POST times out or the connection drops
// after JUDIT received it, retrying would create a second request or tracking
// and could charge twice. The docs mention no idempotency key for these
// endpoints, so the safe default is to surface the error and let a human (or a
// later, explicit policy) decide.

const BASE_URLS: Record<JuditService, string> = {
  lawsuits: "https://lawsuits.production.judit.io",
  requests: "https://requests.production.judit.io",
  tracking: "https://tracking.production.judit.io",
};

const DEFAULT_TIMEOUT_MS = 15_000;
const BODY_SNIPPET_LIMIT = 500;

export type JuditQuery = Record<string, string | number | boolean | undefined>;

export type JuditRequest<Schema extends z.ZodType> = {
  service: JuditService;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: JuditQuery;
  body?: unknown;
  schema: Schema;
  timeoutMs?: number;
  // Some non-2xx answers carry a normal result, e.g. POST /lawsuits answers
  // 404 with `has_lawsuits: false` when nothing is found. This predicate
  // must recognize that exact documented body; anything else (such as a
  // 404 error body) stays an HTTP error. Accepted bodies still go through
  // `schema`.
  acceptErrorBody?: (status: number, body: unknown) => boolean;
};

export async function juditRequest<Schema extends z.ZodType>(
  request: JuditRequest<Schema>,
): Promise<z.infer<Schema>> {
  // Runs before reading the key or touching the network.
  assertLiveCallsEnabled();

  const apiKey = getServerEnv("JUDIT_API_KEY");
  const call: JuditCallInfo = {
    service: request.service,
    method: request.method,
    path: request.path,
  };
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  let text: string;
  try {
    response = await fetch(buildUrl(request), {
      method: request.method,
      headers: {
        // Docs: auth is the custom `api-key` header, not `Authorization:
        // Bearer` (https://docs.judit.io/introduction/authentication).
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
      cache: "no-store",
    });
    // The body is read under the same timeout: a server that sends headers
    // and then stalls is also a timeout.
    text = await response.text();
  } catch (error) {
    if (timedOut) throw new JuditTimeoutError(call, timeoutMs);
    // Only the error message is kept as the cause; the request options (and
    // therefore the key) are never attached.
    throw new JuditNetworkError(call, undefined, {
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }

  // JUDIT echoes the callback_url back (request details, webhook tags), and
  // that URL carries our webhook token. Masking it here, where every JUDIT
  // body passes, keeps it out of dev route output, logs and stored records.
  // The app never needs the token from a response: it builds the URL itself.
  const webhookToken = webhookTokenToMask();
  if (webhookToken) text = redact(text, webhookToken);

  if (!response.ok) {
    const body = parseJson(text);
    if (request.acceptErrorBody?.(response.status, body)) {
      const accepted = request.schema.safeParse(body);
      if (accepted.success) return accepted.data;
    }
    throw toHttpError(call, response, redact(text, apiKey));
  }

  const json = parseJson(text);
  if (json === INVALID_JSON) {
    throw new JuditUnexpectedResponseError(call, response.status, [
      "corpo não é JSON válido",
    ]);
  }

  // HTTP error vs application error: the HTTP status says whether JUDIT
  // accepted and processed *the call* (auth ok, payload valid, server up).
  // An application error comes with HTTP 200 and says the *result* of a
  // valid call is a business exception, e.g. LAWSUIT_NOT_FOUND or
  // SECRECY_RESTRICTED. So HTTP 200 alone does not mean business success;
  // the body must be checked (https://docs.judit.io/resource/errors).
  const applicationError = findApplicationError(json);
  if (applicationError) {
    throw new JuditApplicationError(
      call,
      applicationError.response_data?.code,
      applicationError.response_data?.message,
    );
  }

  const parsed = request.schema.safeParse(json);
  if (!parsed.success) {
    throw new JuditUnexpectedResponseError(
      call,
      response.status,
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.code}`,
      ),
    );
  }
  return parsed.data;
}

function buildUrl({ service, path, query }: JuditRequest<z.ZodType>): URL {
  const url = new URL(path, BASE_URLS[service]);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

function toHttpError(
  call: JuditCallInfo,
  response: Response,
  text: string,
): JuditHttpError {
  const snippet = text.slice(0, BODY_SNIPPET_LIMIT);
  const parsed = httpErrorBodySchema.safeParse(parseJson(text));
  const body = parsed.success ? parsed.data : undefined;
  const nested = typeof body?.error === "object" ? body.error : undefined;
  const errorName =
    nested?.name ?? (typeof body?.error === "string" ? body.error : undefined);
  const errorMessage = nested?.message ?? body?.message;

  if (response.status === 429) {
    return new JuditRateLimitError(
      call,
      snippet,
      {
        retryAfter: response.headers.get("retry-after"),
        limit: response.headers.get("x-ratelimit-limit"),
        remaining: response.headers.get("x-ratelimit-remaining"),
        reset: response.headers.get("x-ratelimit-reset"),
      },
      errorName,
      errorMessage,
    );
  }
  return new JuditHttpError(
    call,
    response.status,
    snippet,
    errorName,
    errorMessage,
  );
}

// Detects a body that, as a whole, is an application error:
// - the body itself has `response_type: "application_error"`
//   (shape of GET /responses/{id} in the OpenAPI spec);
// - or it has a non-empty `responses` array where every item is one
//   (example in https://docs.judit.io/resource/errors).
// Paginated lists (`page_data`) are not checked here: there, an
// application_error item is one result among others, handled by the caller.
function findApplicationError(json: unknown): ApplicationErrorItem | null {
  const direct = applicationErrorSchema.safeParse(json);
  if (direct.success) return direct.data;

  if (isRecord(json) && Array.isArray(json.responses)) {
    const items = json.responses.map((item) =>
      applicationErrorSchema.safeParse(item),
    );
    if (items.length > 0 && items.every((item) => item.success)) {
      return items[0].data ?? null;
    }
  }
  return null;
}

const INVALID_JSON = Symbol("invalid-json");

function parseJson(text: string): unknown {
  // Some endpoints (e.g. DELETE) may answer with an empty body.
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return INVALID_JSON;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// An invalid JUDIT_WEBHOOK_TOKEN is reported by the webhook route. Here it
// only means there is no token to mask, so JUDIT calls keep working.
function webhookTokenToMask(): string | undefined {
  try {
    return getServerEnv("JUDIT_WEBHOOK_TOKEN");
  } catch {
    return undefined;
  }
}

// Defense in depth: if a body ever echoed the key back, it would not reach
// our error objects.
function redact(text: string, secret: string): string {
  return text.split(secret).join("[REDACTED]");
}
