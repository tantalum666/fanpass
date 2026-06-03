import { NextResponse } from "next/server";
import {
  CONSOLE_ACCESS_TOKEN_COOKIE,
  ConsoleMutationOriginError,
  assertConsoleMutationOrigin,
  consoleMutationCorsHeaders,
} from "../../../../lib/api";

const API_BASE_URL =
  process.env.FANPASS_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

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

export async function POST(request: Request) {
  const corsHeaders = consoleMutationCorsHeaders(request);
  try {
    assertConsoleMutationOrigin(request);
  } catch (error) {
    if (error instanceof ConsoleMutationOriginError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 403, headers: corsHeaders },
      );
    }
    throw error;
  }

  const body = (await request.json().catch(() => null)) as {
    accessToken?: unknown;
  } | null;
  const accessToken =
    typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Privy access token is required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const response = await fetch(`${API_BASE_URL}/auth/privy/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  const session = (await response.json().catch(() => null)) as
    | PrivySessionResponse
    | { message?: string }
    | null;

  if (!response.ok || !session || !("role" in session)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          session && "message" in session && session.message
            ? session.message
            : "Privy session sync failed",
      },
      { status: response.status || 401, headers: corsHeaders },
    );
  }

  if (session.role !== "ORGANIZER" && session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "Console requires organizer or admin access" },
      { status: 403, headers: corsHeaders },
    );
  }

  const result = NextResponse.json(
    {
      ok: true,
      userId: session.userId,
      displayName: session.displayName,
      role: session.role,
      expiresAt: session.expiresAt,
    },
    { headers: corsHeaders },
  );
  result.cookies.set(CONSOLE_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionLikeConsole(),
    path: "/",
    maxAge: maxAgeSeconds(session.expiresAt),
  });
  return result;
}

export async function DELETE(request: Request) {
  const corsHeaders = consoleMutationCorsHeaders(request);
  try {
    assertConsoleMutationOrigin(request);
  } catch (error) {
    if (error instanceof ConsoleMutationOriginError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 403, headers: corsHeaders },
      );
    }
    throw error;
  }

  const result = NextResponse.json({ ok: true }, { headers: corsHeaders });
  result.cookies.delete(CONSOLE_ACCESS_TOKEN_COOKIE);
  return result;
}

export async function OPTIONS(request: Request) {
  const corsHeaders = consoleMutationCorsHeaders(request);
  try {
    assertConsoleMutationOrigin(request);
  } catch (error) {
    if (error instanceof ConsoleMutationOriginError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 403, headers: corsHeaders },
      );
    }
    throw error;
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function maxAgeSeconds(expiresAt: string | null) {
  if (!expiresAt) {
    return 55 * 60;
  }
  const seconds = Math.floor(
    (new Date(expiresAt).getTime() - Date.now()) / 1000,
  );
  return Math.max(60, Math.min(seconds, 55 * 60));
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
