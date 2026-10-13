import "server-only";

// Every failure of a JUDIT call becomes one of these classes, so callers can
// branch with `instanceof` instead of parsing messages.
//
// Rule for this file: messages and fields never carry the API key, request
// headers or full payloads. They hold only what is needed to diagnose:
// method, path (without query string), status and a truncated body.

export type JuditService = "lawsuits" | "requests" | "tracking";

export type JuditCallInfo = {
  service: JuditService;
  method: string;
  path: string;
};

export abstract class JuditError extends Error {
  abstract readonly kind: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

// Raised before any network activity, when the kill switch is off.
export class JuditLiveCallsDisabledError extends JuditError {
  readonly kind = "live_calls_disabled";

  constructor() {
    super(
      'Chamadas reais à JUDIT estão desligadas. Defina JUDIT_LIVE_CALLS="enabled" no ambiente do servidor para permiti-las.',
    );
  }
}

// Raised before any network activity, when a search key is not allowlisted
// or the input is not usable.
export class JuditGuardError extends JuditError {
  readonly kind = "guard";
}

// The request never got an HTTP response: DNS, connection refused, TLS, etc.
export class JuditNetworkError extends JuditError {
  readonly kind: "network" | "timeout" = "network";

  constructor(
    readonly call: JuditCallInfo,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(
      message ??
        `Falha de rede ao chamar ${call.method} ${call.service}${call.path}.`,
      options,
    );
  }
}

// We gave up waiting. The server may still have processed the request, so a
// timeout on a POST does NOT mean nothing was created (or charged).
export class JuditTimeoutError extends JuditNetworkError {
  override readonly kind = "timeout";

  constructor(
    call: JuditCallInfo,
    readonly timeoutMs: number,
  ) {
    super(
      call,
      `Tempo limite de ${timeoutMs}ms excedido em ${call.method} ${call.service}${call.path}. A JUDIT pode ter processado a requisição mesmo assim.`,
    );
  }
}

// HTTP 4xx/5xx: the call itself was rejected or failed on JUDIT's side.
export class JuditHttpError extends JuditError {
  readonly kind: "http" | "rate_limit" = "http";

  constructor(
    readonly call: JuditCallInfo,
    readonly status: number,
    // Truncated raw body, for diagnosis only.
    readonly bodySnippet: string,
    // `error.name` / `error.message` when the body follows one of the
    // documented error shapes (see README, "Contradictions").
    readonly errorName?: string,
    readonly errorMessage?: string,
  ) {
    super(
      `JUDIT respondeu HTTP ${status} em ${call.method} ${call.service}${call.path}` +
        (errorName ? ` (${errorName})` : "") +
        ".",
    );
  }
}

// Raw header values. Their exact semantics (e.g. whether X-RateLimit-Reset
// is a timestamp or a number of seconds) are not documented, so we do not
// interpret them here.
export type JuditRateLimitInfo = {
  retryAfter: string | null;
  limit: string | null;
  remaining: string | null;
  reset: string | null;
};

// HTTP 429. Docs: 180 requests per minute per key, sliding 60s window
// (https://docs.judit.io/essentialConcepts/rate-limits).
export class JuditRateLimitError extends JuditHttpError {
  override readonly kind = "rate_limit";

  constructor(
    call: JuditCallInfo,
    bodySnippet: string,
    readonly rateLimit: JuditRateLimitInfo,
    errorName?: string,
    errorMessage?: string,
  ) {
    super(call, 429, bodySnippet, errorName, errorMessage);
  }
}

// HTTP 200 whose body says `response_type: "application_error"`. The call
// was valid and processed; the *result* is a business exception such as
// LAWSUIT_NOT_FOUND. See client.ts for why this is not an HTTP error.
export class JuditApplicationError extends JuditError {
  readonly kind = "application_error";

  constructor(
    readonly call: JuditCallInfo,
    // String codes in the errors page, `number` in the OpenAPI spec.
    readonly code: string | number | undefined,
    readonly applicationMessage: string | undefined,
  ) {
    super(
      `JUDIT retornou application_error${code !== undefined ? ` ${code}` : ""} em ${call.method} ${call.service}${call.path}.`,
    );
  }
}

// HTTP 2xx with a body we cannot use: not JSON, or missing a field our schema
// requires. Only issue paths and codes are kept, never the received values,
// because they may contain lawsuit data.
export class JuditUnexpectedResponseError extends JuditError {
  readonly kind = "unexpected_response";

  constructor(
    readonly call: JuditCallInfo,
    readonly status: number,
    readonly issues: string[],
  ) {
    super(
      `Resposta inesperada da JUDIT em ${call.method} ${call.service}${call.path}: ${issues.join("; ")}`,
    );
  }
}
