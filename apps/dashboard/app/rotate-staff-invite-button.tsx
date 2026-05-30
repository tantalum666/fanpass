"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GateAssignmentResponse {
  id: string;
  eventTitle: string;
  gate: string;
  staffName: string;
  inviteToken?: string;
  invite?: {
    status: string;
    expiresAt: string;
  } | null;
}

export function RotateStaffInviteButton({
  assignmentId,
  staffName,
}: {
  assignmentId: string;
  staffName: string;
}) {
  const router = useRouter();
  const [assignment, setAssignment] =
    useState<GateAssignmentResponse | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const inviteToken = assignment?.inviteToken ?? "";

  async function rotateInvite() {
    setIsRotating(true);
    setError(null);
    setCopyStatus("idle");

    try {
      const response = await fetch(
        `/api/console/gate-assignments/${encodeURIComponent(
          assignmentId,
        )}/invites`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            assignment?: GateAssignmentResponse;
          }
        | null;

      if (!response.ok || !payload?.assignment) {
        setAssignment(null);
        setError(payload?.message ?? "Staff invite rotation failed");
        return;
      }

      setAssignment(payload.assignment);
      router.refresh();
    } catch (rotateError) {
      setAssignment(null);
      setError(
        rotateError instanceof Error
          ? rotateError.message
          : "Staff invite rotation failed",
      );
    } finally {
      setIsRotating(false);
    }
  }

  async function copyInviteToken() {
    if (!inviteToken) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteToken);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="assignment-action-stack">
      <button
        className="secondary-button"
        type="button"
        disabled={isRotating}
        onClick={rotateInvite}
      >
        {isRotating ? "Rotating" : "Rotate invite"}
      </button>

      {error ? <p className="risk-text compact">{error}</p> : null}

      {assignment && inviteToken ? (
        <div
          className="invite-token-panel compact"
          data-testid="rotated-staff-invite-token"
        >
          <div>
            <span className="badge blue">ROTATED INVITE</span>
            <h3>{assignment.staffName || staffName}</h3>
            <p className="muted">
              {assignment.eventTitle} · Gate {assignment.gate}
            </p>
          </div>
          <code>{inviteToken}</code>
          <div className="inline-actions">
            <button type="button" onClick={copyInviteToken}>
              Copy token
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setAssignment(null);
                setCopyStatus("idle");
              }}
            >
              Clear
            </button>
          </div>
          {copyStatus !== "idle" ? (
            <p
              className={
                copyStatus === "copied"
                  ? "success-text compact"
                  : "risk-text compact"
              }
            >
              {copyStatus === "copied"
                ? "Invite token copied."
                : "Clipboard access failed; select and copy the token manually."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
