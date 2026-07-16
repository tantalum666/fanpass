import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_BASE_URL,
  CONSOLE_ACCESS_TOKEN_COOKIE,
  type ConsoleAuthRecoveryMode,
  ConsoleAuthRequiredError,
  ConsoleMutationOriginError,
  ConsoleSessionHandoffError,
  assertConsoleMutationOrigin,
  assertConsoleSessionHandoff,
  clearConsoleHandoffCookie,
  clearConsoleSessionCookie,
  consoleAccessToken,
  consoleAuthHandoffUrl,
  consoleHandoffCookie,
  consoleMutationCorsHeaders,
  consoleSessionCookie,
  createConsoleHandoffState,
  privyCookieAccessToken,
} from "../lib/console-auth.js";
import { redactConsoleGateAssignmentResponse } from "../lib/gate-assignment-response.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const port = Number(
  process.env.FANPASS_CONSOLE_PORT ?? process.env.PORT ?? 3000,
);

interface PrivySessionResponse {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  walletAddress: string | null;
  authProvider: "privy";
  privyId: string;
  created: boolean;
  expiresAt: string | null;
}

interface PrivySessionRequestBody {
  accessToken?: unknown;
  handoff?: unknown;
  handoffState?: unknown;
  recovery?: unknown;
}

type PrivySessionFailureReason =
  | "failed"
  | "handoff"
  | "forbidden"
  | "rate"
  | "service"
  | "session";

class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

class UpstreamApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UpstreamApiError";
  }
}

const MAX_REQUEST_BODY_BYTES = 64 * 1024;

createServer(async (request, response) => {
  try {
    applySecurityHeaders(response);
    await routeRequest(request, response);
  } catch (error) {
    if (
      error instanceof RequestBodyError ||
      error instanceof UpstreamApiError
    ) {
      return sendJson(response, error.status, {
        ok: false,
        message: error.message,
      });
    }
    if (error instanceof ConsoleAuthRequiredError) {
      return sendJson(response, 401, { ok: false, message: error.message });
    }
    const message =
      error instanceof Error ? error.message : "FanPass Console request failed";
    sendJson(response, 500, { ok: false, message });
  }
}).listen(port, () => {
  console.log(
    JSON.stringify({
      ok: true,
      service: "fanpass-console",
      runtime: "vite-node-bff",
      port,
    }),
  );
});

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://fanpass.local").pathname;

  if (pathname === "/api/console/privy-handoff" && method === "GET") {
    return handlePrivyHandoffStart(response);
  }

  if (pathname === "/api/console/privy-session") {
    if (method === "POST") {
      return handlePrivySessionPost(request, response);
    }
    if (method === "DELETE") {
      return handlePrivySessionDelete(request, response);
    }
    if (method === "OPTIONS") {
      return handlePrivySessionOptions(request, response);
    }
  }

  if (pathname === "/api/console/operations" && method === "GET") {
    return handleOperations(request, response);
  }

  if (pathname === "/api/console/events" && method === "POST") {
    return handleCreateEvent(request, response);
  }

  const ticketTypeMatch = pathname.match(
    /^\/api\/console\/events\/([^/]+)\/ticket-types$/,
  );
  if (ticketTypeMatch && method === "POST") {
    return handleCreateTicketType(request, response, ticketTypeMatch[1]);
  }

  const fanCampaignMatch = pathname.match(
    /^\/api\/console\/events\/([^/]+)\/fan-access$/,
  );
  if (fanCampaignMatch && method === "POST") {
    return handleSaveFanCampaign(request, response, fanCampaignMatch[1]);
  }

  const fanSubmissionMatch = pathname.match(
    /^\/api\/console\/fan-access\/submissions\/([^/]+)\/decision$/,
  );
  if (fanSubmissionMatch && method === "POST") {
    return handleReviewFanSubmission(request, response, fanSubmissionMatch[1]);
  }

  if (pathname === "/api/console/gate-assignments" && method === "POST") {
    return handleCreateGateAssignment(request, response);
  }

  const inviteMatch = pathname.match(
    /^\/api\/console\/gate-assignments\/([^/]+)\/invites$/,
  );
  if (inviteMatch && method === "POST") {
    return handleRotateInvite(request, response, inviteMatch[1]);
  }

  const deactivateMatch = pathname.match(
    /^\/api\/console\/gate-assignments\/([^/]+)\/deactivate$/,
  );
  if (deactivateMatch && method === "POST") {
    return handleDeactivateGateAssignment(
      request,
      response,
      deactivateMatch[1],
    );
  }

  if (pathname.startsWith("/api/")) {
    return sendJson(response, 404, { ok: false, message: "Not found" });
  }

  return serveStatic(pathname, response);
}

function handlePrivyHandoffStart(response: ServerResponse) {
  const state = createConsoleHandoffState();
  const authUrl = consoleAuthHandoffUrl(state);
  if (!authUrl) {
    return sendJson(response, 503, {
      ok: false,
      message: "Console authentication is not configured",
    });
  }

  response.setHeader("Set-Cookie", consoleHandoffCookie(state));
  return sendRedirect(response, 303, authUrl);
}

async function handleOperations(
  request: IncomingMessage,
  response: ServerResponse,
) {
  try {
    const operations = await apiGet("/alpha/operations", request);
    sendJson(response, 200, operations);
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return sendJson(response, 401, { ok: false, message: error.message });
    }
    throw error;
  }
}

async function handleCreateEvent(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const originRequest = requestToFetchRequest(request);
  const guard = assertMutationOrigin(originRequest, response);
  if (!guard) {
    return;
  }

  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const title = stringField(body?.title);
  const venueName = stringField(body?.venueName);
  const city = stringField(body?.city) || "Hong Kong";
  const startTime = stringField(body?.startTime);
  const endTime = stringField(body?.endTime);

  if (!title || !venueName || !startTime || !endTime) {
    return sendJson(response, 400, {
      ok: false,
      message: "Event title, venue, start, and end are required",
    });
  }

  const event = await apiPost(
    "/alpha/events",
    {
      title,
      venueName,
      city,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    },
    request,
  );
  sendJson(response, 200, { ok: true, event });
}

async function handleCreateTicketType(
  request: IncomingMessage,
  response: ServerResponse,
  eventIdParam: string,
) {
  const originRequest = requestToFetchRequest(request);
  const guard = assertMutationOrigin(originRequest, response);
  if (!guard) {
    return;
  }

  const eventId = decodeURIComponent(eventIdParam).trim();
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const name = stringField(body?.name);
  const faceValue = numberField(body?.faceValue);
  const supply = numberField(body?.supply);
  const resaleCap = numberField(body?.resaleCap);
  const maxTransferCount = numberField(body?.maxTransferCount);

  if (!eventId || !name || faceValue <= 0 || supply <= 0) {
    return sendJson(response, 400, {
      ok: false,
      message: "Event, ticket type, face value, and supply are required",
    });
  }

  const ticketType = await apiPost(
    `/alpha/events/${encodeURIComponent(eventId)}/ticket-types`,
    {
      name,
      faceValue,
      currency: "HKD",
      supply,
      transferable: body?.transferable === true,
      resaleCap: resaleCap > 0 ? resaleCap : undefined,
      maxTransferCount,
    },
    request,
  );
  sendJson(response, 200, { ok: true, ticketType });
}

async function handleCreateGateAssignment(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const originRequest = requestToFetchRequest(request);
  const guard = assertMutationOrigin(originRequest, response);
  if (!guard) {
    return;
  }

  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const eventId = stringField(body?.eventId);
  const gate = stringField(body?.gate);
  const staffName = stringField(body?.staffName);
  const staffEmail = stringField(body?.staffEmail);

  if (!eventId || !gate || !staffName || !staffEmail) {
    return sendJson(response, 400, {
      ok: false,
      message: "Event, gate, staff name, and staff email are required",
    });
  }

  try {
    const accessToken = await consoleAccessToken(cookieSource(request));
    const upstream = await fetch(`${API_BASE_URL}/alpha/gate-assignments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId,
        gate,
        staffName,
        staffEmail,
      }),
      cache: "no-store",
    });
    const payload = (await upstream.json().catch(() => null)) as unknown;
    if (!upstream.ok) {
      return sendJson(response, upstream.status, {
        ok: false,
        message: responseMessage(payload, "Gate staff assignment failed"),
      });
    }
    sendJson(response, 200, {
      ok: true,
      assignment: redactConsoleGateAssignmentResponse(payload),
    });
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return sendJson(response, 401, { ok: false, message: error.message });
    }
    throw error;
  }
}

async function handleSaveFanCampaign(
  request: IncomingMessage,
  response: ServerResponse,
  eventIdParam: string,
) {
  const originRequest = requestToFetchRequest(request);
  if (!assertMutationOrigin(originRequest, response)) {
    return;
  }

  const eventId = decodeURIComponent(eventIdParam).trim();
  const body = await readJsonRecord(request);
  if (!eventId) {
    return sendJson(response, 400, {
      ok: false,
      message: "Event is required",
    });
  }
  const campaign = await apiPost(
    `/fan-access/events/${encodeURIComponent(eventId)}/campaign`,
    body,
    request,
  );
  sendJson(response, 200, campaign);
}

async function handleReviewFanSubmission(
  request: IncomingMessage,
  response: ServerResponse,
  submissionIdParam: string,
) {
  const originRequest = requestToFetchRequest(request);
  if (!assertMutationOrigin(originRequest, response)) {
    return;
  }

  const submissionId = decodeURIComponent(submissionIdParam).trim();
  const body = await readJsonRecord(request);
  if (!submissionId) {
    return sendJson(response, 400, {
      ok: false,
      message: "Submission is required",
    });
  }
  const submission = await apiPost(
    `/fan-access/submissions/${encodeURIComponent(submissionId)}/decision`,
    body,
    request,
  );
  sendJson(response, 200, submission);
}

async function handleRotateInvite(
  request: IncomingMessage,
  response: ServerResponse,
  assignmentIdParam: string,
) {
  const originRequest = requestToFetchRequest(request);
  const guard = assertMutationOrigin(originRequest, response);
  if (!guard) {
    return;
  }

  const normalizedAssignmentId = decodeURIComponent(assignmentIdParam).trim();
  if (!normalizedAssignmentId) {
    return sendJson(response, 400, {
      ok: false,
      message: "Gate assignment is required",
    });
  }

  try {
    const accessToken = await consoleAccessToken(cookieSource(request));
    const upstream = await fetch(
      `${API_BASE_URL}/alpha/gate-assignments/${encodeURIComponent(
        normalizedAssignmentId,
      )}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );
    const payload = (await upstream.json().catch(() => null)) as unknown;
    if (!upstream.ok) {
      return sendJson(response, upstream.status, {
        ok: false,
        message: responseMessage(payload, "Staff invite rotation failed"),
      });
    }
    sendJson(response, 200, {
      ok: true,
      assignment: redactConsoleGateAssignmentResponse(payload),
    });
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return sendJson(response, 401, { ok: false, message: error.message });
    }
    throw error;
  }
}

async function handleDeactivateGateAssignment(
  request: IncomingMessage,
  response: ServerResponse,
  assignmentIdParam: string,
) {
  const originRequest = requestToFetchRequest(request);
  const guard = assertMutationOrigin(originRequest, response);
  if (!guard) {
    return;
  }

  const normalizedAssignmentId = decodeURIComponent(assignmentIdParam).trim();
  if (!normalizedAssignmentId) {
    return sendJson(response, 400, {
      ok: false,
      message: "Gate assignment is required",
    });
  }

  try {
    const assignment = await apiPost(
      `/alpha/gate-assignments/${encodeURIComponent(
        normalizedAssignmentId,
      )}/deactivate`,
      {},
      request,
    );
    sendJson(response, 200, { ok: true, assignment });
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return sendJson(response, 401, { ok: false, message: error.message });
    }
    throw error;
  }
}

async function handlePrivySessionPost(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const originRequest = requestToFetchRequest(request);
  const corsHeaders = consoleMutationCorsHeaders(originRequest);
  setHeaders(response, corsHeaders);
  const formRequest =
    requestContentType(request) === "application/x-www-form-urlencoded";

  let body: PrivySessionRequestBody | null;
  try {
    body = await readPrivySessionBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return sendPrivySessionFailure(
        response,
        formRequest,
        error.status,
        error.message,
      );
    }
    throw error;
  }
  const topLevelHandoff = formRequest && body?.handoff === "top-level";
  const recoveryMode = readConsoleAuthRecoveryMode(body?.recovery);
  try {
    if (topLevelHandoff) {
      assertConsoleSessionHandoff(request.headers.cookie, body?.handoffState);
    } else {
      assertConsoleMutationOrigin(originRequest);
    }
  } catch (error) {
    if (
      error instanceof ConsoleMutationOriginError ||
      error instanceof ConsoleSessionHandoffError
    ) {
      return sendPrivySessionFailure(
        response,
        topLevelHandoff,
        403,
        error.message,
        "handoff",
      );
    }
    throw error;
  }

  if (topLevelHandoff) {
    response.setHeader("Set-Cookie", clearConsoleHandoffCookie());
  }
  const bodyAccessToken =
    typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  const accessToken =
    privyCookieAccessToken(request.headers.cookie) ?? bodyAccessToken;
  if (!accessToken) {
    if (topLevelHandoff) {
      return sendPrivySessionRecovery(response, recoveryMode);
    }
    return sendPrivySessionFailure(
      response,
      topLevelHandoff,
      400,
      "Privy access token is required",
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/auth/privy/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });
  } catch {
    return sendPrivySessionFailure(
      response,
      topLevelHandoff,
      503,
      "Privy session service is unavailable",
      "service",
    );
  }
  const session = (await upstream.json().catch(() => null)) as
    | PrivySessionResponse
    | { message?: string }
    | null;

  if (!upstream.ok || !session || !("role" in session)) {
    if (topLevelHandoff && upstream.status === 401) {
      logPrivySessionExchange({
        outcome: "recovery",
        upstreamStatus: upstream.status,
        failureReason: "session",
        recoveryMode,
      });
      return sendPrivySessionRecovery(response, recoveryMode);
    }
    const failureReason = privySessionFailureReason(upstream.status);
    logPrivySessionExchange({
      outcome: "rejected",
      upstreamStatus: upstream.status || 401,
      failureReason,
      recoveryMode,
    });
    return sendPrivySessionFailure(
      response,
      topLevelHandoff,
      upstream.status || 401,
      session && "message" in session && session.message
        ? session.message
        : "Privy session sync failed",
      failureReason,
    );
  }

  if (session.role !== "ORGANIZER" && session.role !== "ADMIN") {
    logPrivySessionExchange({
      outcome: "rejected",
      upstreamStatus: 403,
      failureReason: "forbidden",
      recoveryMode,
    });
    return sendPrivySessionFailure(
      response,
      topLevelHandoff,
      403,
      "Console requires organizer or admin access",
      "forbidden",
    );
  }

  response.setHeader(
    "Set-Cookie",
    topLevelHandoff
      ? [
          clearConsoleHandoffCookie(),
          consoleSessionCookie(accessToken, session.expiresAt),
        ]
      : consoleSessionCookie(accessToken, session.expiresAt),
  );
  logPrivySessionExchange({
    outcome: "accepted",
    upstreamStatus: upstream.status,
    failureReason: null,
    recoveryMode,
  });
  if (topLevelHandoff) {
    return sendRedirect(response, 303, "/");
  }
  return sendJson(response, 200, {
    ok: true,
    userId: session.userId,
    displayName: session.displayName,
    role: session.role,
    expiresAt: session.expiresAt,
  });
}

function sendPrivySessionFailure(
  response: ServerResponse,
  topLevelHandoff: boolean,
  status: number,
  message: string,
  reason: PrivySessionFailureReason = "failed",
) {
  if (topLevelHandoff) {
    return sendRedirect(response, 303, "/?auth=" + reason);
  }
  return sendJson(response, status, { ok: false, message });
}

function privySessionFailureReason(status: number): PrivySessionFailureReason {
  if (status === 429) {
    return "rate";
  }
  if (status >= 500) {
    return "service";
  }
  return "failed";
}

function logPrivySessionExchange(input: {
  outcome: "accepted" | "recovery" | "rejected";
  upstreamStatus: number;
  failureReason: PrivySessionFailureReason | null;
  recoveryMode: ConsoleAuthRecoveryMode | null;
}) {
  const payload = JSON.stringify({
    event: "console_privy_session_exchange",
    outcome: input.outcome,
    upstreamStatus: input.upstreamStatus,
    failureReason: input.failureReason,
    recoveryMode: input.recoveryMode ?? "initial",
  });
  if (input.outcome === "accepted") {
    console.info(payload);
    return;
  }
  console.warn(payload);
}

function sendPrivySessionRecovery(
  response: ServerResponse,
  currentMode: ConsoleAuthRecoveryMode | null,
) {
  if (currentMode === "reauth") {
    return sendPrivySessionFailure(
      response,
      true,
      401,
      "Privy session verification failed after re-authentication",
      "session",
    );
  }

  const nextMode: ConsoleAuthRecoveryMode =
    currentMode === "refresh" ? "reauth" : "refresh";
  const state = createConsoleHandoffState();
  const authUrl = consoleAuthHandoffUrl(state, nextMode);
  if (!authUrl) {
    return sendPrivySessionFailure(
      response,
      true,
      503,
      "Console authentication recovery is not configured",
      "service",
    );
  }

  response.setHeader("Set-Cookie", consoleHandoffCookie(state));
  return sendRedirect(response, 303, authUrl);
}

function readConsoleAuthRecoveryMode(
  value: unknown,
): ConsoleAuthRecoveryMode | null {
  return value === "refresh" || value === "reauth" ? value : null;
}

function handlePrivySessionDelete(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const originRequest = requestToFetchRequest(request);
  const corsHeaders = consoleMutationCorsHeaders(originRequest);
  setHeaders(response, corsHeaders);
  try {
    assertConsoleMutationOrigin(originRequest);
  } catch (error) {
    if (error instanceof ConsoleMutationOriginError) {
      return sendJson(response, 403, { ok: false, message: error.message });
    }
    throw error;
  }

  response.setHeader("Set-Cookie", clearConsoleSessionCookie());
  return sendJson(response, 200, { ok: true });
}

function handlePrivySessionOptions(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const originRequest = requestToFetchRequest(request);
  const corsHeaders = consoleMutationCorsHeaders(originRequest);
  setHeaders(response, corsHeaders);
  try {
    assertConsoleMutationOrigin(originRequest);
  } catch (error) {
    if (error instanceof ConsoleMutationOriginError) {
      return sendJson(response, 403, { ok: false, message: error.message });
    }
    throw error;
  }
  response.writeHead(204);
  response.end();
}

function assertMutationOrigin(request: Request, response: ServerResponse) {
  try {
    assertConsoleMutationOrigin(request);
    return true;
  } catch (error) {
    if (error instanceof ConsoleMutationOriginError) {
      sendJson(response, 403, { ok: false, message: error.message });
      return false;
    }
    throw error;
  }
}

async function apiGet(pathname: string, request: IncomingMessage) {
  const accessToken = await consoleAccessToken(cookieSource(request));
  const upstream = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw new UpstreamApiError(
      responseMessage(payload, `API request failed: ${upstream.status}`),
      upstream.status,
    );
  }
  return payload;
}

async function apiPost(
  pathname: string,
  body: Record<string, unknown>,
  request: IncomingMessage,
) {
  const accessToken = await consoleAccessToken(cookieSource(request));
  const upstream = await fetch(`${API_BASE_URL}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw new UpstreamApiError(
      responseMessage(payload, `API request failed: ${upstream.status}`),
      upstream.status,
    );
  }
  return payload;
}

function requestToFetchRequest(request: IncomingMessage) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(name, value.join(", "));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return new Request(`http://fanpass.local${request.url ?? "/"}`, {
    method: request.method,
    headers,
  });
}

function cookieSource(request: IncomingMessage) {
  return { cookieHeader: request.headers.cookie ?? null };
}

async function readJsonBody(request: IncomingMessage) {
  const rawBody = await readRequestBody(request);
  if (!rawBody) {
    return null;
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new RequestBodyError("Request body must be valid JSON", 400);
  }
}

async function readJsonRecord(request: IncomingMessage) {
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestBodyError("Request body must be a JSON object", 400);
  }
  return body as Record<string, unknown>;
}

async function readPrivySessionBody(request: IncomingMessage) {
  const rawBody = await readRequestBody(request);
  if (!rawBody) {
    return null;
  }

  const contentType = requestContentType(request);
  if (contentType === "application/json") {
    try {
      return JSON.parse(rawBody) as PrivySessionRequestBody;
    } catch {
      throw new RequestBodyError("Request body must be valid JSON", 400);
    }
  }
  if (contentType === "application/x-www-form-urlencoded") {
    const fields = new URLSearchParams(rawBody);
    return {
      accessToken: fields.get("accessToken"),
      handoff: fields.get("handoff"),
      handoffState: fields.get("handoffState"),
      recovery: fields.get("recovery"),
    } satisfies PrivySessionRequestBody;
  }
  throw new RequestBodyError("Unsupported request content type", 415);
}

function requestContentType(request: IncomingMessage) {
  return String(request.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyError("Request body is too large", 413);
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return "";
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(pathname: string, response: ServerResponse) {
  const requestedPath =
    pathname === "/"
      ? path.join(publicDir, "index.html")
      : path.join(publicDir, pathname);
  const normalizedPath = path.normalize(requestedPath);
  const safePath = normalizedPath.startsWith(publicDir)
    ? normalizedPath
    : path.join(publicDir, "index.html");
  const filePath = existsSync(safePath)
    ? safePath
    : path.join(publicDir, "index.html");

  if (!existsSync(filePath)) {
    return sendJson(response, 503, {
      ok: false,
      message:
        "FanPass Console build artifacts are missing. Run npm run build -w apps/dashboard.",
    });
  }

  response.setHeader("Content-Type", contentType(filePath));
  createReadStream(filePath).pipe(response);
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendRedirect(response: ServerResponse, status: 303, location: string) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Location", location);
  response.end();
}

function setHeaders(response: ServerResponse, headers: Record<string, string>) {
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
}

function applySecurityHeaders(response: ServerResponse) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      `connect-src 'self' ${API_BASE_URL} ${API_BASE_URL.replace(/^http/, "ws")}`,
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  if (isProductionLikeConsole()) {
    response.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  }
}

function isProductionLikeConsole() {
  const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
  const fanpassEnv = String(process.env.FANPASS_ENV ?? "").toLowerCase();
  return (
    nodeEnv === "production" ||
    fanpassEnv === "production" ||
    fanpassEnv === "staging"
  );
}

function responseMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "message" in payload
    ? String((payload as { message?: unknown }).message)
    : fallback;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberField(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function contentType(filePath: string) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}
