"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface EventOption {
  id: string;
  title: string;
}

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

export function GateStaffInviteForm({
  events,
  defaultEventId,
}: {
  events: EventOption[];
  defaultEventId?: string;
}) {
  const router = useRouter();
  const initialEventId = defaultEventId ?? events[0]?.id ?? "";
  const [eventId, setEventId] = useState(initialEventId);
  const [gate, setGate] = useState("A2");
  const [staffName, setStaffName] = useState("Gate Team Member");
  const [staffEmail, setStaffEmail] = useState("gate-a2@fanpass.test");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] =
    useState<GateAssignmentResponse | null>(null);

  const inviteToken = assignment?.inviteToken ?? "";
  const selectedEventTitle = useMemo(
    () => events.find((event) => event.id === eventId)?.title ?? "Selected event",
    [eventId, events],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setCopyStatus("idle");
    setError(null);

    try {
      const response = await fetch("/api/console/gate-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          gate,
          staffName,
          staffEmail,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            assignment?: GateAssignmentResponse;
          }
        | null;

      if (!response.ok || !payload?.assignment) {
        setAssignment(null);
        setError(payload?.message ?? "Gate staff assignment failed");
        return;
      }

      setAssignment(payload.assignment);
      router.refresh();
    } catch (submitError) {
      setAssignment(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gate staff assignment failed",
      );
    } finally {
      setIsSubmitting(false);
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
    <div className="gate-invite-workspace">
      <form className="form-grid single" onSubmit={handleSubmit}>
        <label>
          Event
          <select
            name="eventId"
            required
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gate
          <input
            name="gate"
            required
            maxLength={24}
            value={gate}
            onChange={(event) => setGate(event.target.value)}
          />
        </label>
        <label>
          Staff name
          <input
            name="staffName"
            required
            maxLength={120}
            value={staffName}
            onChange={(event) => setStaffName(event.target.value)}
          />
        </label>
        <label>
          Staff email
          <input
            name="staffEmail"
            required
            type="email"
            value={staffEmail}
            onChange={(event) => setStaffEmail(event.target.value)}
          />
        </label>
        <button type="submit" disabled={isSubmitting || events.length === 0}>
          {isSubmitting ? "Creating invite" : "Assign staff"}
        </button>
      </form>

      {error ? <div className="form-alert error">{error}</div> : null}

      {assignment && inviteToken ? (
        <div className="invite-token-panel" data-testid="staff-invite-token">
          <div>
            <span className="badge blue">ONE-TIME INVITE</span>
            <h3>{assignment.staffName}</h3>
            <p className="muted">
              {assignment.eventTitle || selectedEventTitle} · Gate{" "}
              {assignment.gate}
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
          <p className="muted">
            Token is shown once. Store it only long enough to deliver it to the
            staff member through the approved invite channel.
          </p>
          {copyStatus !== "idle" ? (
            <p className={copyStatus === "copied" ? "success-text" : "risk-text"}>
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
