import { NextResponse } from "next/server";
import {
  ConsoleAuthRequiredError,
  ConsoleMutationOriginError,
  assertConsoleMutationOrigin,
  consoleAccessToken,
} from "../../../../../../lib/api";
import { redactConsoleGateAssignmentResponse } from "../../../../../../lib/gate-assignment-response";

const API_BASE_URL =
  process.env.FANPASS_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId?: string }> },
) {
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

  const { assignmentId } = await params;
  const normalizedAssignmentId = assignmentId?.trim() ?? "";
  if (!normalizedAssignmentId) {
    return NextResponse.json(
      { ok: false, message: "Gate assignment is required" },
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

  const response = await fetch(
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
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message?: unknown }).message)
            : "Staff invite rotation failed",
      },
      { status: response.status },
    );
  }

  return NextResponse.json({
    ok: true,
    assignment: redactConsoleGateAssignmentResponse(payload),
  });
}
