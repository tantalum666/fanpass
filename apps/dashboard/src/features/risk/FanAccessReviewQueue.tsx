import { Fragment, useState, type FormEvent } from "react";
import { ConsoleApiError, reviewFanSubmission } from "../../console/api";
import { shortId, titleCase } from "../../console/format";
import type { FanTaskSubmission } from "../../console/types";
import {
  Badge,
  EmptyState,
  Section,
  TableFrame,
  toneForStatus,
} from "../../components/ConsoleUi";

type ReviewDecision = "APPROVED" | "REJECTED";

export function FanAccessReviewQueue({
  eventTitle,
  submissions,
  onRefresh,
}: {
  eventTitle: string;
  submissions: FanTaskSubmission[];
  onRefresh: () => Promise<void>;
}) {
  const [review, setReview] = useState<{
    submissionId: string;
    decision: ReviewDecision;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function beginReview(submissionId: string, decision: ReviewDecision) {
    setReview({ submissionId, decision });
    setReason("");
    setError("");
  }

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!review) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await reviewFanSubmission(review.submissionId, {
        decision: review.decision,
        reason,
      });
      await onRefresh();
      setReview(null);
      setReason("");
    } catch (caught) {
      setError(
        caught instanceof ConsoleApiError
          ? caught.message
          : "The submission decision could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      description={`Manual task evidence scoped to ${eventTitle}. Every final decision requires a reason and is audited.`}
      title="Fan Access review"
    >
      {submissions.length === 0 ? (
        <EmptyState
          description="Only tasks that genuinely require human judgment appear here."
          title="No submissions"
        />
      ) : (
        <TableFrame>
          <table className="data-table fan-review-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>User</th>
                <th>Proof</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <Fragment key={submission.id}>
                  <tr>
                    <td>
                      <strong>{submission.taskTitle}</strong>
                    </td>
                    <td className="mono-cell">{shortId(submission.userId)}</td>
                    <td className="proof-cell">{submission.proof}</td>
                    <td>
                      <Badge tone={toneForStatus(submission.status)}>
                        {titleCase(submission.status)}
                      </Badge>
                    </td>
                    <td>
                      {submission.status === "PENDING" ? (
                        <div className="fan-review-actions">
                          <button
                            className="secondary-button"
                            onClick={() =>
                              beginReview(submission.id, "APPROVED")
                            }
                            type="button"
                          >
                            Approve
                          </button>
                          <button
                            className="danger-text"
                            onClick={() =>
                              beginReview(submission.id, "REJECTED")
                            }
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {review?.submissionId === submission.id ? (
                    <tr className="fan-review-reason-row">
                      <td colSpan={5}>
                        <form onSubmit={submit}>
                          <label>
                            {review.decision === "APPROVED"
                              ? "Approval reason"
                              : "Rejection reason"}
                            <input
                              autoFocus
                              maxLength={280}
                              onChange={(input) =>
                                setReason(input.target.value)
                              }
                              placeholder="Record the evidence used for this decision"
                              required
                              value={reason}
                            />
                          </label>
                          <div>
                            <button
                              className="secondary-button"
                              onClick={() => setReview(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className={
                                review.decision === "REJECTED"
                                  ? "danger-button"
                                  : undefined
                              }
                              disabled={saving}
                              type="submit"
                            >
                              {saving
                                ? "Saving…"
                                : `Confirm ${review.decision.toLowerCase()}`}
                            </button>
                          </div>
                          {error ? (
                            <p className="form-message form-message--error">
                              {error}
                            </p>
                          ) : null}
                        </form>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}
    </Section>
  );
}
