import {
  formatDateTime,
  formatPercent,
  shortId,
  titleCase,
} from "../../console/format";
import type { EventOperationsView } from "../../console/types";
import {
  Badge,
  EmptyState,
  PageHeader,
  Section,
  StatStrip,
  TableFrame,
  toneForStatus,
} from "../../components/ConsoleUi";

export function EntryPage({ eventView }: { eventView: EventOperationsView }) {
  const accepted = eventView.checkins.filter(
    (checkin) => checkin.result === "ACCEPTED",
  ).length;
  const rejected = eventView.checkins.length - accepted;
  const activeAssignments = eventView.gateAssignments.filter(
    (assignment) => assignment.active,
  );
  const gates = gateSummary(eventView);

  return (
    <>
      <PageHeader
        eyebrow="Event day"
        title="Entry"
        description="Monitor throughput, exceptions, and gate coverage for the selected event."
      />
      <StatStrip
        items={[
          {
            label: "Total scans",
            value: eventView.checkins.length,
            meta: eventView.checkins.length
              ? "Live event records"
              : "No scans yet",
          },
          {
            label: "Accepted",
            value: accepted,
            meta: eventView.checkins.length
              ? `${formatPercent((accepted / eventView.checkins.length) * 100)} acceptance`
              : "—",
          },
          {
            label: "Rejected",
            value: rejected,
            meta: rejected ? "Needs exception review" : "No exceptions",
          },
          {
            label: "Active gates",
            value: gates.length,
            meta: `${activeAssignments.length} staff assignments`,
          },
        ]}
      />

      <Section
        title="Gate status"
        description="Coverage and throughput summarized by gate."
      >
        {gates.length === 0 ? (
          <EmptyState
            title="No active gates"
            description="Assign event staff from Team to establish gate coverage."
          />
        ) : (
          <TableFrame>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>Assigned staff</th>
                  <th>Accepted</th>
                  <th>Rejected</th>
                  <th>Latest scan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {gates.map((gate) => (
                  <tr key={gate.gate}>
                    <td>
                      <strong>Gate {gate.gate}</strong>
                    </td>
                    <td>
                      {gate.staffNames.length
                        ? gate.staffNames.join(", ")
                        : "Unassigned"}
                    </td>
                    <td>{gate.accepted}</td>
                    <td>{gate.rejected}</td>
                    <td>
                      {gate.latestScan
                        ? formatDateTime(gate.latestScan)
                        : "No scans"}
                    </td>
                    <td>
                      <Badge tone={gate.active ? "success" : "warning"}>
                        {gate.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      <Section
        title="Recent check-ins"
        description="Accepted and rejected credential scans for this event."
      >
        {eventView.checkins.length === 0 ? (
          <EmptyState
            title="No check-ins"
            description="Scans from FanPass Ops will appear here."
          />
        ) : (
          <TableFrame>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Gate</th>
                  <th>Ticket</th>
                  <th>Scanner</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {eventView.checkins.map((checkin) => (
                  <tr key={checkin.id}>
                    <td>{formatDateTime(checkin.checkedInAt)}</td>
                    <td>Gate {checkin.gate}</td>
                    <td className="mono-cell">{shortId(checkin.ticketId)}</td>
                    <td>
                      {checkin.scannerEmail ??
                        `Staff ${shortId(checkin.scannerUserId)}`}
                    </td>
                    <td>
                      <Badge tone={toneForStatus(checkin.result)}>
                        {titleCase(checkin.result)}
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

function gateSummary(eventView: EventOperationsView) {
  const gates = new Map<
    string,
    {
      gate: string;
      staffNames: string[];
      accepted: number;
      rejected: number;
      latestScan: string | null;
      active: boolean;
    }
  >();

  for (const assignment of eventView.gateAssignments) {
    const current = gates.get(assignment.gate) ?? {
      gate: assignment.gate,
      staffNames: [],
      accepted: 0,
      rejected: 0,
      latestScan: null,
      active: false,
    };
    current.staffNames.push(assignment.staffName);
    current.active ||= assignment.active;
    gates.set(assignment.gate, current);
  }

  for (const checkin of eventView.checkins) {
    const current = gates.get(checkin.gate) ?? {
      gate: checkin.gate,
      staffNames: [],
      accepted: 0,
      rejected: 0,
      latestScan: null,
      active: false,
    };
    if (checkin.result === "ACCEPTED") {
      current.accepted += 1;
    } else {
      current.rejected += 1;
    }
    if (
      !current.latestScan ||
      Date.parse(checkin.checkedInAt) > Date.parse(current.latestScan)
    ) {
      current.latestScan = checkin.checkedInAt;
    }
    gates.set(checkin.gate, current);
  }

  return Array.from(gates.values()).sort((left, right) =>
    left.gate.localeCompare(right.gate),
  );
}
