export interface ConsoleGateAssignmentResponse {
  id: string;
  eventTitle: string;
  gate: string;
  staffName: string;
  inviteToken?: string;
  invite: {
    status: string;
    expiresAt: string;
  } | null;
}

export function redactConsoleGateAssignmentResponse(
  payload: unknown,
): ConsoleGateAssignmentResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gate assignment response was empty");
  }

  const record = payload as Record<string, unknown>;
  const invite = objectField(record.invite);
  const redacted: ConsoleGateAssignmentResponse = {
    id: requiredString(record.id, "assignment id"),
    eventTitle: optionalString(record.eventTitle),
    gate: requiredString(record.gate, "gate"),
    staffName: requiredString(record.staffName, "staff name"),
    invite: invite
      ? {
          status: requiredString(invite.status, "invite status"),
          expiresAt: requiredString(invite.expiresAt, "invite expiry"),
        }
      : null,
  };

  const inviteToken = optionalString(record.inviteToken);
  if (inviteToken) {
    redacted.inviteToken = inviteToken;
  }

  return redacted;
}

function objectField(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Gate assignment response missing ${label}`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
