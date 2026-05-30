import { NextResponse } from "next/server";
import {
  ConsoleAuthRequiredError,
  ConsoleMutationOriginError,
  assertConsoleMutationOrigin,
  consoleAccessToken,
} from "../../../../lib/api";
import { redactConsoleGateAssignmentResponse } from "../../../../lib/gate-assignment-response";

const API_BASE_URL =
  process.env.FANPASS_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

interface CreateGateAssignmentBody {
  eventId?: unknown;
  gate?: unknown;
  staffName?: unknown;
  staffEmail?: unknown;
}

export async function POST(request: Request) {
  try {
    assertConsoleMutationOrigin(request);
  } catch (error) {
    if (error instanceof ConsoleMutationOriginError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 403 },
      );
    }
    throw error;
  }

  const body = (await request
    .json()
    .catch(() => null)) as CreateGateAssignmentBody | null;
  const eventId = stringField(body?.eventId);
  const gate = stringField(body?.gate);
  const staffName = stringField(body?.staffName);
  const staffEmail = stringField(body?.staffEmail);

  if (!eventId || !gate || !staffName || !staffEmail) {
    return NextResponse.json(
      {
        ok: false,
        message: "Event, gate, staff name, and staff email are required",
      },
      { status: 400 },
    );
  }

  let accessToken: string;
  try {
    accessToken = await consoleAccessToken();
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 401 },
      );
    }
    throw error;
  }

  const response = await fetch(`${API_BASE_URL}/alpha/gate-assignments`, {
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
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message?: unknown }).message)
            : "Gate staff assignment failed",
      },
      { status: response.status },
    );
  }

  return NextResponse.json({
    ok: true,
    assignment: redactConsoleGateAssignmentResponse(payload),
  });
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
