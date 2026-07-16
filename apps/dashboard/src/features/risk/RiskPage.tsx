import { formatDateTime, shortId, titleCase } from "../../console/format";
import type { AlphaOperations, EventOperationsView } from "../../console/types";
import {
  Badge,
  EmptyState,
  PageHeader,
  Section,
  StatStrip,
  TableFrame,
  toneForStatus,
} from "../../components/ConsoleUi";
import { FanAccessCampaignPanel } from "./FanAccessCampaignPanel";
import { FanAccessReviewQueue } from "./FanAccessReviewQueue";

export function RiskPage({
  operations,
  eventView,
  onRefresh,
}: {
  operations: AlphaOperations;
  eventView: EventOperationsView;
  onRefresh: () => Promise<void>;
}) {
  const pendingReviews = eventView.fanTaskSubmissions.filter(
    (item) => item.status === "PENDING",
  ).length;
  const failedJobs = operations.sideEffects.filter(
    (item) => item.status === "FAILED",
  ).length;
  const pendingJobs = operations.sideEffects.filter(
    (item) => item.status === "PENDING",
  ).length;
  const campaign =
    eventView.fanCampaigns.find((item) => item.status !== "ARCHIVED") ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Control plane"
        title="Risk & audit"
        description="Review exceptions, durable background work, Fan Access submissions, and the scoped audit trail."
      />
      <StatStrip
        items={[
          {
            label: "Pending reviews",
            value: pendingReviews,
            meta: `${eventView.fanTaskSubmissions.length} Fan Access submissions`,
          },
          {
            label: "Failed jobs",
            value: failedJobs,
            meta: failedJobs ? "Investigation required" : "No failures",
          },
          {
            label: "Pending jobs",
            value: pendingJobs,
            meta: `${operations.sideEffects.length} workspace-scoped jobs`,
          },
          {
            label: "Audit entries",
            value: operations.auditLogs.length,
            meta: operations.privacy.piiRedacted
              ? "PII redacted"
              : "Admin detail visible",
          },
        ]}
      />

      <FanAccessCampaignPanel
        campaign={campaign}
        event={eventView.event}
        onRefresh={onRefresh}
      />

      <FanAccessReviewQueue
        eventTitle={eventView.event.title}
        onRefresh={onRefresh}
        submissions={eventView.fanTaskSubmissions}
      />

      <div className="content-columns content-columns--risk">
        <Section
          title="Background jobs"
          description="Durable payment, ownership, and settlement side effects."
        >
          {operations.sideEffects.length === 0 ? (
            <EmptyState
              title="No background jobs"
              description="No workspace-scoped jobs are currently recorded."
            />
          ) : (
            <TableFrame>
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.sideEffects.map((effect) => (
                    <tr key={effect.id}>
                      <td className="mono-cell">{shortId(effect.id)}</td>
                      <td>{titleCase(effect.type)}</td>
                      <td>
                        <Badge tone={toneForStatus(effect.status)}>
                          {titleCase(effect.status)}
                        </Badge>
                      </td>
                      <td>{effect.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
          )}
        </Section>

        <Section
          title="Audit log"
          description="Latest scoped lifecycle changes across the workspace."
        >
          {operations.auditLogs.length === 0 ? (
            <EmptyState
              title="No audit entries"
              description="Lifecycle changes will appear here."
            />
          ) : (
            <TableFrame>
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.createdAt)}</td>
                      <td>{titleCase(log.action)}</td>
                      <td>
                        {titleCase(log.entityType)}{" "}
                        <span className="mono-cell">
                          {shortId(log.entityId)}
                        </span>
                      </td>
                      <td className="mono-cell">{shortId(log.actorId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
          )}
        </Section>
      </div>
    </>
  );
}
