import {
  formatMoney,
  formatPercent,
  formatTime,
  titleCase,
} from "../../console/format";
import { issuedForTicketType, sellThrough } from "../../console/operations";
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

export function OverviewPage({
  operations,
  eventView,
}: {
  operations: AlphaOperations;
  eventView: EventOperationsView;
}) {
  const { event } = eventView;
  const totalSupply = event.ticketTypes.reduce(
    (sum, type) => sum + type.supply,
    0,
  );
  const issued = eventView.tickets.length;
  const accepted = eventView.checkins.filter(
    (checkin) => checkin.result === "ACCEPTED",
  ).length;
  const capturedRevenue = eventView.payments
    .filter((payment) => payment.captureStatus === "CAPTURED")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const openOrders = eventView.orders.filter(
    (order) => order.status === "OPEN",
  ).length;
  const alerts = buildAlerts(operations, eventView);
  const activity = buildActivity(eventView).slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="Event workspace"
        title="Overview"
        description={`A current operating view of ${event.title}, from inventory through event entry.`}
      />

      <StatStrip
        items={[
          {
            label: "Tickets issued",
            value: issued.toLocaleString("en-HK"),
            meta: `${formatPercent(totalSupply ? (issued / totalSupply) * 100 : 0)} of supply`,
          },
          {
            label: "Captured revenue",
            value: formatMoney(capturedRevenue),
            meta: `${eventView.payments.length} payment records`,
          },
          {
            label: "Open orders",
            value: openOrders,
            meta: `${eventView.trades.length} settled trades`,
          },
          {
            label: "Checked in",
            value: accepted,
            meta: issued
              ? `${formatPercent((accepted / issued) * 100)} of issued`
              : "No issued tickets",
          },
        ]}
      />

      <div className="content-columns content-columns--overview">
        <Section
          title="Inventory pace"
          description="Issued inventory by ticket type. Resale does not count as a new issue."
        >
          {event.ticketTypes.length === 0 ? (
            <EmptyState
              title="No ticket types"
              description="Add a ticket type from Events before opening sales."
            />
          ) : (
            <div className="inventory-progress-list">
              {event.ticketTypes.map((ticketType) => {
                const issuedCount = issuedForTicketType(
                  eventView,
                  ticketType.id,
                );
                const percentage = sellThrough(eventView, ticketType);
                return (
                  <div className="inventory-progress" key={ticketType.id}>
                    <div>
                      <strong>{ticketType.name}</strong>
                      <span>
                        {issuedCount.toLocaleString("en-HK")} /{" "}
                        {ticketType.supply.toLocaleString("en-HK")} issued
                      </span>
                    </div>
                    <strong>{formatPercent(percentage)}</strong>
                    <div
                      className="progress-track"
                      aria-label={`${ticketType.name} ${formatPercent(percentage)} issued`}
                    >
                      <span
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          title="Needs attention"
          description="Exceptions that may require an operator decision."
        >
          {alerts.length === 0 ? (
            <div className="healthy-state">
              <span className="healthy-dot" />
              <div>
                <strong>No active exceptions</strong>
                <p>
                  Inventory, entry, staff access, and background jobs are clear.
                </p>
              </div>
            </div>
          ) : (
            <ul className="attention-list">
              {alerts.map((alert) => (
                <li key={alert.label}>
                  <span
                    className={`attention-mark attention-mark--${alert.tone}`}
                  />
                  <div>
                    <strong>{alert.label}</strong>
                    <p>{alert.detail}</p>
                  </div>
                  <span>{alert.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Recent activity"
        description="Latest sales, entry, and access events for this event."
      >
        {activity.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Operational activity will appear after orders, scans, or staff assignments are created."
          />
        ) : (
          <TableFrame>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Area</th>
                  <th>Activity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTime(item.at)}</td>
                    <td>{item.area}</td>
                    <td>{item.label}</td>
                    <td>
                      <Badge tone={toneForStatus(item.status)}>
                        {titleCase(item.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>
    </>
  );
}

function buildAlerts(
  operations: AlphaOperations,
  eventView: EventOperationsView,
) {
  const rejectedScans = eventView.checkins.filter(
    (checkin) => checkin.result !== "ACCEPTED",
  ).length;
  const pendingInvites = eventView.gateAssignments.filter(
    (assignment) => assignment.active && !assignment.linked,
  ).length;
  const pendingReviews = eventView.fanTaskSubmissions.filter(
    (submission) => submission.status === "PENDING",
  ).length;
  const failedJobs = operations.sideEffects.filter(
    (effect) => effect.status === "FAILED",
  ).length;

  return [
    {
      label: "Rejected entry scans",
      detail: "Review duplicate or invalid credentials.",
      count: rejectedScans,
      tone: "danger",
    },
    {
      label: "Unlinked gate staff",
      detail: "Invite is pending for an active assignment.",
      count: pendingInvites,
      tone: "warning",
    },
    {
      label: "Fan Access reviews",
      detail: "Submissions are waiting for a decision.",
      count: pendingReviews,
      tone: "info",
    },
    {
      label: "Failed background jobs",
      detail: "Workspace-scoped side effects need investigation.",
      count: failedJobs,
      tone: "danger",
    },
  ].filter((alert) => alert.count > 0);
}

function buildActivity(eventView: EventOperationsView) {
  return [
    ...eventView.orders.map((order) => ({
      id: `order-${order.id}`,
      at: order.createdAt,
      area: "Sales",
      label: `${titleCase(order.side)} order at ${formatMoney(order.price)}`,
      status: order.status,
    })),
    ...eventView.checkins.map((checkin) => ({
      id: `checkin-${checkin.id}`,
      at: checkin.checkedInAt,
      area: "Entry",
      label: `Gate ${checkin.gate} scan`,
      status: checkin.result,
    })),
    ...eventView.gateAssignments.map((assignment) => ({
      id: `assignment-${assignment.id}`,
      at: assignment.createdAt,
      area: "Team",
      label: `${assignment.staffName} assigned to Gate ${assignment.gate}`,
      status: assignment.active ? "ACTIVE" : "INACTIVE",
    })),
  ].sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
}
