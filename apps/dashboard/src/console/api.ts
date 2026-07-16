import type {
  AlphaOperations,
  FanCampaignTask,
  GateAssignmentResponse,
} from "./types";

export class ConsoleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface CreateEventInput {
  title: string;
  venueName: string;
  city: string;
  startTime: string;
  endTime: string;
}

export interface CreateTicketTypeInput {
  name: string;
  faceValue: number;
  supply: number;
  resaleCap?: number;
  maxTransferCount: number;
  transferable: boolean;
}

export interface CreateGateAssignmentInput {
  eventId: string;
  gate: string;
  staffName: string;
  staffEmail: string;
}

export interface SaveFanCampaignInput {
  title: string;
  description: string;
  rewardTitle: string;
  rewardDescription: string;
  rewardSupply: number;
  qualificationPoints: number;
  allocationMethod: "EQUAL_DRAW" | "GUARANTEED";
  status: "DRAFT" | "ACTIVE";
  startsAt: string;
  closesAt: string;
  tasks: Array<
    Pick<
      FanCampaignTask,
      | "title"
      | "description"
      | "taskType"
      | "points"
      | "verificationMethod"
      | "verificationLabel"
      | "actionKind"
      | "optional"
    > & { id?: string }
  >;
}

export async function loadOperations() {
  return request<AlphaOperations>("/api/console/operations");
}

export async function createEvent(input: CreateEventInput) {
  return request<unknown>("/api/console/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createTicketType(
  eventId: string,
  input: CreateTicketTypeInput,
) {
  return request<unknown>(
    `/api/console/events/${encodeURIComponent(eventId)}/ticket-types`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createGateAssignment(input: CreateGateAssignmentInput) {
  return request<{ ok: boolean; assignment: GateAssignmentResponse }>(
    "/api/console/gate-assignments",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function rotateGateInvite(assignmentId: string) {
  return request<{ ok: boolean; assignment: GateAssignmentResponse }>(
    `/api/console/gate-assignments/${encodeURIComponent(assignmentId)}/invites`,
    { method: "POST" },
  );
}

export async function deactivateGateAssignment(assignmentId: string) {
  return request<unknown>(
    `/api/console/gate-assignments/${encodeURIComponent(assignmentId)}/deactivate`,
    { method: "POST" },
  );
}

export async function saveFanCampaign(
  eventId: string,
  input: SaveFanCampaignInput,
) {
  return request<unknown>(
    `/api/console/events/${encodeURIComponent(eventId)}/fan-access`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function reviewFanSubmission(
  submissionId: string,
  input: { decision: "APPROVED" | "REJECTED"; reason: string },
) {
  return request<unknown>(
    `/api/console/fan-access/submissions/${encodeURIComponent(submissionId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init.headers,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string })
    | null;

  if (!response.ok) {
    throw new ConsoleApiError(
      payload?.message ?? "The Console request could not be completed.",
      response.status,
    );
  }

  return payload as T;
}
