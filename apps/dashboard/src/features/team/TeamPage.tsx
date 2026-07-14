import { useState, type FormEvent } from "react";
import {
  ConsoleApiError,
  createGateAssignment,
  deactivateGateAssignment,
  rotateGateInvite,
} from "../../console/api";
import { formatDateTime, shortId, titleCase } from "../../console/format";
import type {
  EventOperationsView,
  GateAssignmentResponse,
} from "../../console/types";
import { ConsoleIcon } from "../../components/ConsoleIcon";
import {
  Badge,
  EmptyState,
  PageHeader,
  Section,
  TableFrame,
  toneForStatus,
} from "../../components/ConsoleUi";

export function TeamPage({
  eventView,
  onRefresh,
}: {
  eventView: EventOperationsView;
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [invite, setInvite] = useState<GateAssignmentResponse | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="Team"
        description="Grant the minimum event and gate access needed for onsite operations."
        actions={
          <button onClick={() => setShowForm(true)} type="button">
            <ConsoleIcon name="plus" size={16} />
            Assign gate staff
          </button>
        }
      />

      {invite?.inviteToken ? (
        <InviteTokenNotice invite={invite} onClear={() => setInvite(null)} />
      ) : null}

      <Section
        title="Gate staff assignments"
        description={`${eventView.event.title} · each assignment is limited to one event and gate.`}
      >
        {eventView.gateAssignments.length === 0 ? (
          <EmptyState
            title="No staff assignments"
            description="Assign gate staff when the event-day operating plan is ready."
            action={
              <button onClick={() => setShowForm(true)}>
                Assign gate staff
              </button>
            }
          />
        ) : (
          <TableFrame>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Gate</th>
                  <th>Access</th>
                  <th>Invite</th>
                  <th>Created</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {eventView.gateAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <strong>{assignment.staffName}</strong>
                      <small>
                        {assignment.staffEmail ??
                          `Staff ${shortId(assignment.staffUserId)}`}
                      </small>
                    </td>
                    <td>Gate {assignment.gate}</td>
                    <td>
                      <Badge tone={assignment.active ? "success" : "warning"}>
                        {assignment.active ? "Active" : "Revoked"}
                      </Badge>
                      <small>
                        {assignment.linked ? "Privy linked" : "Not linked"}
                      </small>
                    </td>
                    <td>
                      {assignment.invite ? (
                        <>
                          <Badge tone={toneForStatus(assignment.invite.status)}>
                            {titleCase(assignment.invite.status)}
                          </Badge>
                          <small>
                            Expires{" "}
                            {formatDateTime(assignment.invite.expiresAt)}
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatDateTime(assignment.createdAt)}</td>
                    <td>
                      {assignment.active ? (
                        <AssignmentActions
                          assignmentId={assignment.id}
                          canRotate={!assignment.linked}
                          onInvite={setInvite}
                          onRefresh={onRefresh}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      {showForm ? (
        <AssignmentComposer
          eventId={eventView.event.id}
          eventTitle={eventView.event.title}
          onClose={() => setShowForm(false)}
          onCreated={(created) => {
            setInvite(created);
            setShowForm(false);
          }}
          onRefresh={onRefresh}
        />
      ) : null}
    </>
  );
}

function AssignmentActions({
  assignmentId,
  canRotate,
  onInvite,
  onRefresh,
}: {
  assignmentId: string;
  canRotate: boolean;
  onInvite: (invite: GateAssignmentResponse) => void;
  onRefresh: () => Promise<void>;
}) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function rotate() {
    setBusy(true);
    setError("");
    try {
      const response = await rotateGateInvite(assignmentId);
      onInvite(response.assignment);
      await onRefresh();
    } catch (caught) {
      setError(
        caught instanceof ConsoleApiError
          ? caught.message
          : "Invite rotation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError("");
    try {
      await deactivateGateAssignment(assignmentId);
      await onRefresh();
      setConfirmRevoke(false);
    } catch (caught) {
      setError(
        caught instanceof ConsoleApiError
          ? caught.message
          : "Assignment revocation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row-actions">
      {canRotate ? (
        <button
          aria-label="Rotate invite"
          className="icon-button"
          disabled={busy}
          onClick={() => void rotate()}
          title="Rotate invite"
          type="button"
        >
          <ConsoleIcon name="refresh" size={16} />
        </button>
      ) : null}
      <button
        aria-label="Revoke access"
        className="icon-button icon-button--danger"
        disabled={busy}
        onClick={() => setConfirmRevoke(true)}
        title="Revoke access"
        type="button"
      >
        <ConsoleIcon name="risk" size={16} />
      </button>
      {error ? <p className="row-action-error">{error}</p> : null}
      {confirmRevoke ? (
        <div className="confirmation-layer" role="presentation">
          <button
            aria-label="Cancel revocation"
            className="confirmation-backdrop"
            onClick={() => setConfirmRevoke(false)}
            type="button"
          />
          <section
            aria-labelledby="revoke-title"
            aria-modal="true"
            className="confirmation-dialog"
            role="dialog"
          >
            <h2 id="revoke-title">Revoke gate access?</h2>
            <p>
              The staff member will no longer be able to operate this event and
              gate.
            </p>
            <div>
              <button
                className="secondary-button"
                onClick={() => setConfirmRevoke(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void revoke()}
                type="button"
              >
                {busy ? "Revoking…" : "Revoke access"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AssignmentComposer({
  eventId,
  eventTitle,
  onClose,
  onCreated,
  onRefresh,
}: {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
  onCreated: (assignment: GateAssignmentResponse) => void;
  onRefresh: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await createGateAssignment({
        eventId,
        gate: String(form.get("gate") ?? ""),
        staffName: String(form.get("staffName") ?? ""),
        staffEmail: String(form.get("staffEmail") ?? ""),
      });
      await onRefresh();
      onCreated(result.assignment);
    } catch (caught) {
      setError(
        caught instanceof ConsoleApiError
          ? caught.message
          : "Staff assignment failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="composer-layer" role="presentation">
      <button
        aria-label="Close form"
        className="composer-backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby="assignment-title"
        aria-modal="true"
        className="composer-panel"
        role="dialog"
      >
        <header>
          <div>
            <h2 id="assignment-title">Assign gate staff</h2>
            <p>Grant scoped access to {eventTitle}.</p>
          </div>
          <button
            aria-label="Close form"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <ConsoleIcon name="close" />
          </button>
        </header>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Gate
            <input maxLength={24} name="gate" required />
          </label>
          <label>
            Staff name
            <input maxLength={120} name="staffName" required />
          </label>
          <label>
            Staff email
            <input name="staffEmail" required type="email" />
          </label>
          <p className="form-help">
            A one-time invite token will be shown once after the assignment is
            created.
          </p>
          {error ? (
            <p className="form-message form-message--error">{error}</p>
          ) : null}
          <div className="composer-actions">
            <button
              className="secondary-button"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button disabled={saving} type="submit">
              {saving ? "Assigning…" : "Assign staff"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function InviteTokenNotice({
  invite,
  onClear,
}: {
  invite: GateAssignmentResponse;
  onClear: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const token = invite.inviteToken ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section className="invite-notice" data-testid="staff-invite-token">
      <div>
        <Badge tone="info">One-time invite</Badge>
        <h2>Deliver this token securely</h2>
        <p>
          {invite.staffName} · Gate {invite.gate}. It will not be shown again
          after this notice is cleared.
        </p>
      </div>
      <code>{token}</code>
      <div className="invite-actions">
        <button onClick={() => void copy()} type="button">
          {copyState === "copied" ? "Copied" : "Copy token"}
        </button>
        <button className="secondary-button" onClick={onClear} type="button">
          Clear
        </button>
      </div>
      {copyState === "failed" ? (
        <p className="form-message form-message--error">
          Clipboard access failed. Select and copy the token manually.
        </p>
      ) : null}
    </section>
  );
}
