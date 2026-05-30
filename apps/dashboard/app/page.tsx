import { revalidatePath } from "next/cache";
import { ConsoleAuthRequiredError, apiGet, apiPost } from "../lib/api";
import { ConsoleLoginForm } from "./console-login-form";
import { GateStaffInviteForm } from "./gate-staff-invite-form";
import { OrderbookLivePanel } from "./orderbook-live-panel";
import { RotateStaffInviteButton } from "./rotate-staff-invite-button";

export const dynamic = "force-dynamic";

interface AlphaEvent {
  id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  venue?: {
    id?: string;
    name: string;
    city: string;
    capacity?: number;
  };
  ticketTypes: {
    id: string;
    name: string;
    faceValue: number;
    currency: string;
    supply: number;
    transferable: boolean;
    resaleCap: number | null;
    maxTransferCount: number;
  }[];
}

interface AlphaOperations {
  ok: boolean;
  dataSource: string;
  privacy: {
    viewerRole: "FAN" | "ORGANIZER" | "GATE_STAFF" | "ADMIN";
    piiVisible: boolean;
    piiRedacted: boolean;
  };
  events: AlphaEvent[];
  market: {
    eventId: string;
    eventTitle: string;
    ticketTypeId: string;
    ticketTypeName: string;
    currency: string;
    faceValue: number;
    resaleCap: number | null;
    bids: { price: number; quantity: number }[];
    asks: { price: number; quantity: number }[];
    lastTradePrice: number | null;
    floorPrice: number | null;
    highestBid: number | null;
    spread: number | null;
    volume: number;
    premiumPercent: number | null;
    priceHistory: {
      tradeId: string;
      price: number;
      fee: number;
      premiumPercent: number;
      createdAt: string;
    }[];
  } | null;
  tickets: {
    id: string;
    tokenId: string | null;
    eventTitle: string;
    ticketTypeName: string;
    transferable: boolean;
    ownerId: string;
    ownerEmail: string | null;
    status: string;
    transferCount: number;
  }[];
  orders: {
    id: string;
    userId: string;
    ticketId: string | null;
    side: "BUY" | "SELL";
    price: number;
    remainingQuantity: number;
    status: string;
    createdAt: string;
  }[];
  trades: {
    id: string;
    buyOrderId: string;
    sellOrderId: string;
    ticketId: string;
    eventId: string;
    eventTitle: string;
    ticketTypeId: string;
    ticketTypeName: string;
    price: number;
    fee: number;
    settlementStatus: string;
    createdAt: string;
  }[];
  sideEffects: {
    id: string;
    type: string;
    status: string;
    aggregateType: string;
    aggregateId: string;
    attempts: number;
    lastError: string | null;
    payload: unknown | null;
    createdAt: string;
    completedAt: string | null;
  }[];
  gateAssignments: {
    id: string;
    eventId: string;
    eventTitle: string;
    gate: string;
    active: boolean;
    linked: boolean;
    staffUserId: string;
    staffName: string;
    staffEmail: string | null;
    invite: {
      id: string;
      status: string;
      expiresAt: string;
      acceptedAt: string | null;
    } | null;
    createdAt: string;
  }[];
  checkins: {
    id: string;
    ticketId: string;
    scannerEmail: string | null;
    scannerUserId: string;
    gate: string;
    nonce: string | null;
    result: string;
    checkedInAt: string;
  }[];
  fanTaskSubmissions: {
    id: string;
    userId: string;
    taskTitle: string;
    proof: string;
    status: string;
  }[];
  auditLogs: {
    id: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
  }[];
}

async function createEventAction(formData: FormData) {
  "use server";

  const title = String(formData.get("title") ?? "").trim();
  const venueName = String(formData.get("venueName") ?? "").trim();
  const city = String(formData.get("city") ?? "Hong Kong").trim();
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");

  if (!title || !venueName || !startTime || !endTime) {
    return;
  }

  await apiPost<AlphaEvent, Record<string, unknown>>("/alpha/events", {
    title,
    venueName,
    city,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
  });
  revalidatePath("/");
}

async function createTicketTypeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("eventId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const faceValue = Number(formData.get("faceValue") ?? 0);
  const supply = Number(formData.get("supply") ?? 0);
  const resaleCapValue = Number(formData.get("resaleCap") ?? 0);
  const maxTransferCount = Number(formData.get("maxTransferCount") ?? 0);

  if (!eventId || !name || faceValue <= 0 || supply <= 0) {
    return;
  }

  await apiPost<AlphaEvent["ticketTypes"][number], Record<string, unknown>>(
    `/alpha/events/${eventId}/ticket-types`,
    {
      name,
      faceValue,
      currency: "HKD",
      supply,
      transferable: formData.get("transferable") === "on",
      resaleCap: resaleCapValue > 0 ? resaleCapValue : undefined,
      maxTransferCount,
    },
  );
  revalidatePath("/");
}

async function deactivateGateAssignmentAction(formData: FormData) {
  "use server";

  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!assignmentId) {
    return;
  }

  await apiPost<
    AlphaOperations["gateAssignments"][number],
    Record<string, unknown>
  >(`/alpha/gate-assignments/${assignmentId}/deactivate`, {});
  revalidatePath("/");
}

export default async function DashboardPage() {
  let operations: AlphaOperations;
  try {
    operations = await apiGet<AlphaOperations>("/alpha/operations");
  } catch (error) {
    if (error instanceof ConsoleAuthRequiredError) {
      return <LockedConsole />;
    }
    throw error;
  }
  const events = operations.events;
  const firstEvent = events[0];
  const firstTicketType = firstEvent?.ticketTypes[0];

  const activeTickets = operations.tickets.filter(
    (ticket) => ticket.status !== "REDEEMED",
  ).length;
  const redeemedTickets = operations.tickets.filter(
    (ticket) => ticket.status === "REDEEMED",
  ).length;
  const floor =
    operations.market?.floorPrice ??
    operations.market?.lastTradePrice ??
    firstTicketType?.faceValue ??
    0;
  const acceptedCheckins = operations.checkins.filter(
    (checkin) => checkin.result === "ACCEPTED",
  ).length;
  const activeGateAssignments = operations.gateAssignments.filter(
    (assignment) => assignment.active,
  ).length;
  const openOrders = operations.orders.filter(
    (order) => order.status === "OPEN",
  ).length;
  const pendingSideEffects = operations.sideEffects.filter(
    (sideEffect) => sideEffect.status === "PENDING",
  ).length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>FanPass Console</strong>
          <span>Organizer and admin workspace for Alpha operations</span>
        </div>
        <div className="topbar-meta">
          <span className="muted">API: localhost:4000</span>
          <span
            className={`badge ${operations.privacy.piiRedacted ? "orange" : "green"}`}
          >
            {operations.privacy.piiRedacted
              ? "PII redacted"
              : "Admin PII visible"}
          </span>
        </div>
      </header>

      <nav className="workspace-nav" aria-label="Console workspace">
        <ConsoleNavItem
          href="#overview"
          label="Overview"
          roles="Organizer Admin"
          active
        />
        <ConsoleNavItem
          href="#inventory"
          label="Inventory"
          roles="Organizer Admin"
        />
        <ConsoleNavItem href="#market" label="Market" roles="Admin" />
        <ConsoleNavItem href="#gate" label="Gate Ops" roles="Organizer Admin" />
        <ConsoleNavItem
          href="#fan-access"
          label="Fan Access"
          roles="Organizer Admin"
        />
        <ConsoleNavItem href="#audit" label="Audit" roles="Admin" />
      </nav>

      <section className="main">
        <div id="overview" className="grid">
          <Metric label="Managed events" value={events.length} />
          <Metric label="Active tickets" value={activeTickets} />
          <Metric label="Redeemed tickets" value={redeemedTickets} />
          <Metric label="Current floor" value={`HK$${floor}`} />
        </div>

        <section className="panel">
          <div className="section-title">
            <h2>Alpha Data Layer</h2>
            <span className={`badge ${operations.ok ? "green" : "orange"}`}>
              {operations.dataSource}
            </span>
          </div>
          <div className="grid compact">
            <Metric
              label="Persistent tickets"
              value={operations.tickets.length}
            />
            <Metric label="Open orders" value={openOrders} />
            <Metric label="Settled trades" value={operations.trades.length} />
            <Metric label="Accepted check-ins" value={acceptedCheckins} />
            <Metric label="Gate assignments" value={activeGateAssignments} />
            <Metric label="Pending effects" value={pendingSideEffects} />
          </div>
        </section>

        <div id="inventory" className="split">
          <section className="panel">
            <div className="section-title">
              <h2>Events</h2>
              <span className="muted">Primary inventory and resale policy</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Venue</th>
                  <th>Status</th>
                  <th>Ticket Types</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                      <div className="muted">
                        {new Date(event.startTime).toLocaleString("en-HK")}
                      </div>
                    </td>
                    <td>
                      {event.venue
                        ? `${event.venue.name}, ${event.venue.city}`
                        : "TBD"}
                    </td>
                    <td>
                      <span className="badge green">{event.status}</span>
                    </td>
                    <td>
                      {event.ticketTypes
                        .map((ticketType) => ticketType.name)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="market" className="panel">
            <div className="section-title">
              <h2>Orderbook</h2>
              <span className="muted">
                {operations.market
                  ? `${operations.market.eventTitle} / ${operations.market.ticketTypeName}`
                  : "No market"}
              </span>
            </div>
            <OrderbookLivePanel market={operations.market} />
          </section>
        </div>

        <div className="split">
          <section className="panel">
            <div className="section-title">
              <h2>Create Event</h2>
              <span className="muted">Writes to Alpha data layer</span>
            </div>
            <form className="form-grid" action={createEventAction}>
              <label>
                Event title
                <input name="title" required defaultValue="FanPass Live Test" />
              </label>
              <label>
                Venue
                <input
                  name="venueName"
                  required
                  defaultValue="AsiaWorld-Arena"
                />
              </label>
              <label>
                City
                <input name="city" required defaultValue="Hong Kong" />
              </label>
              <label>
                Start
                <input
                  name="startTime"
                  required
                  type="datetime-local"
                  defaultValue="2026-11-21T20:00"
                />
              </label>
              <label>
                End
                <input
                  name="endTime"
                  required
                  type="datetime-local"
                  defaultValue="2026-11-21T23:00"
                />
              </label>
              <button type="submit">Create event</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>Add Ticket Type</h2>
              <span className="muted">Face value and resale cap</span>
            </div>
            <form className="form-grid" action={createTicketTypeAction}>
              <label>
                Event
                <select name="eventId" required defaultValue={firstEvent?.id}>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ticket type
                <input name="name" required defaultValue="CAT 1" />
              </label>
              <label>
                Face value
                <input
                  name="faceValue"
                  required
                  type="number"
                  min="1"
                  defaultValue="1888"
                />
              </label>
              <label>
                Supply
                <input
                  name="supply"
                  required
                  type="number"
                  min="1"
                  defaultValue="200"
                />
              </label>
              <label>
                Resale cap
                <input
                  name="resaleCap"
                  type="number"
                  min="0"
                  defaultValue="2265"
                />
              </label>
              <label>
                Max transfers
                <input
                  name="maxTransferCount"
                  required
                  type="number"
                  min="0"
                  defaultValue="2"
                />
              </label>
              <label className="checkbox-row">
                <input name="transferable" type="checkbox" defaultChecked />
                Transferable
              </label>
              <button type="submit">Add ticket type</button>
            </form>
          </section>
        </div>

        <section className="panel">
          <div className="section-title">
            <h2>Tickets</h2>
            <span className="muted">
              Current ownership and verification state
            </span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Event</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Transfer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {operations.tickets.length === 0 ? (
                <EmptyRow label="No persistent tickets" />
              ) : (
                operations.tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.tokenId ? `#${ticket.tokenId}` : ticket.id}</td>
                    <td>{ticket.eventTitle}</td>
                    <td>{ticket.ticketTypeName}</td>
                    <td>
                      <span>{ticket.ownerEmail ?? "Redacted user"}</span>
                      <div className="mono">{ticket.ownerId}</div>
                    </td>
                    <td>
                      <span
                        className={`badge ${ticket.transferable ? "blue" : "orange"}`}
                      >
                        {ticket.transferable ? "TRANSFERABLE" : "LOCKED"}
                      </span>
                      <div className="muted">
                        {ticket.transferCount} transfers
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${ticket.status === "REDEEMED" ? "orange" : "blue"}`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <div className="split equal">
          <section className="panel">
            <div className="section-title">
              <h2>Alpha Orders</h2>
              <span className="muted">Persistent order lifecycle</span>
            </div>
            <table className="table dense">
              <thead>
                <tr>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Ticket</th>
                  <th>User</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {operations.orders.length === 0 ? (
                  <EmptyRow label="No persistent orders" />
                ) : (
                  operations.orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <span
                          className={`badge ${order.side === "BUY" ? "blue" : "orange"}`}
                        >
                          {order.side}
                        </span>
                      </td>
                      <td>HK${order.price}</td>
                      <td>{order.ticketId ?? "Any"}</td>
                      <td className="mono">{order.userId}</td>
                      <td>{order.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>Alpha Trades</h2>
              <span className="muted">Settlement and fee view</span>
            </div>
            <table className="table dense">
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Ticket</th>
                  <th>Price</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {operations.trades.length === 0 ? (
                  <EmptyRow label="No settled trades" />
                ) : (
                  operations.trades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="mono">{shortId(trade.id)}</td>
                      <td className="mono">{trade.ticketId}</td>
                      <td>HK${trade.price}</td>
                      <td>HK${trade.fee}</td>
                      <td>
                        <span className="badge green">
                          {trade.settlementStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>

        <section className="panel">
          <div className="section-title">
            <h2>Side Effects</h2>
            <span className="muted">
              Durable payment and ownership operation trail
            </span>
          </div>
          <table className="table dense">
            <thead>
              <tr>
                <th>Job</th>
                <th>Type</th>
                <th>Aggregate</th>
                <th>Status</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {operations.sideEffects.length === 0 ? (
                <EmptyRow label="No side-effect jobs" />
              ) : (
                operations.sideEffects.map((sideEffect) => (
                  <tr key={sideEffect.id}>
                    <td className="mono">{shortId(sideEffect.id)}</td>
                    <td>{sideEffect.type}</td>
                    <td className="mono">{sideEffect.aggregateType}</td>
                    <td>
                      <span
                        className={`badge ${
                          sideEffect.status === "COMPLETED"
                            ? "green"
                            : sideEffect.status === "FAILED"
                              ? "orange"
                              : "blue"
                        }`}
                      >
                        {sideEffect.status}
                      </span>
                    </td>
                    <td>{sideEffect.attempts}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="panel market-history">
          <div className="section-title">
            <h2>Price History</h2>
            <span className="muted">
              {operations.market?.priceHistory.length ?? 0} settled trades for
              selected ticket type
            </span>
          </div>
          <PriceHistory market={operations.market} />
        </section>

        <div id="gate" className="split">
          <section className="panel">
            <div className="section-title">
              <h2>Gate Staff Assignments</h2>
              <span className="muted">
                Staff access for event and gate operations
              </span>
            </div>
            <table className="table dense">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Gate</th>
                  <th>Staff</th>
                  <th>Access</th>
                  <th>Invite</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {operations.gateAssignments.length === 0 ? (
                  <EmptyRow label="No gate staff assignments" />
                ) : (
                  operations.gateAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.eventTitle}</td>
                      <td>{assignment.gate}</td>
                      <td>
                        <span>{assignment.staffName}</span>
                        <div className="mono">
                          {assignment.staffEmail ?? assignment.staffUserId}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${assignment.active ? "green" : "orange"}`}
                        >
                          {assignment.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                        <div className="muted">
                          {assignment.linked
                            ? "Privy linked"
                            : "Invite pending"}
                        </div>
                      </td>
                      <td>
                        {assignment.invite ? (
                          <>
                            <span
                              className={`badge ${
                                assignment.invite.status === "ACCEPTED"
                                  ? "green"
                                  : assignment.invite.status === "PENDING"
                                    ? "blue"
                                    : "orange"
                              }`}
                            >
                              {assignment.invite.status}
                            </span>
                            <div className="muted">
                              Expires {formatDate(assignment.invite.expiresAt)}
                            </div>
                          </>
                        ) : (
                          <span className="muted">No invite</span>
                        )}
                      </td>
                      <td>
                        {assignment.active ? (
                          <div className="assignment-action-stack">
                            {!assignment.linked ? (
                              <RotateStaffInviteButton
                                assignmentId={assignment.id}
                                staffName={assignment.staffName}
                              />
                            ) : null}
                            <form action={deactivateGateAssignmentAction}>
                              <input
                                type="hidden"
                                name="assignmentId"
                                value={assignment.id}
                              />
                              <button
                                className="secondary-button"
                                type="submit"
                              >
                                Revoke
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="muted">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>Assign Gate Staff</h2>
              <span className="muted">
                Organizer-scoped access and one-time invite
              </span>
            </div>
            <GateStaffInviteForm
              events={events.map((event) => ({
                id: event.id,
                title: event.title,
              }))}
              defaultEventId={firstEvent?.id}
            />
          </section>
        </div>

        <div className="split equal">
          <section className="panel">
            <div className="section-title">
              <h2>Gate Check-ins</h2>
              <span className="muted">Accepted and rejected scans</span>
            </div>
            <table className="table dense">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Gate</th>
                  <th>Scanner</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {operations.checkins.length === 0 ? (
                  <EmptyRow label="No check-ins" />
                ) : (
                  operations.checkins.map((checkin) => (
                    <tr key={checkin.id}>
                      <td className="mono">{checkin.ticketId}</td>
                      <td>{checkin.gate}</td>
                      <td>
                        <span>
                          {checkin.scannerEmail ?? "Redacted scanner"}
                        </span>
                        <div className="mono">{checkin.scannerUserId}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${checkin.result === "ACCEPTED" ? "green" : "orange"}`}
                        >
                          {checkin.result}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section id="fan-access" className="panel">
            <div className="section-title">
              <h2>Fan Access Review</h2>
              <span className="muted">Task submissions</span>
            </div>
            <table className="table dense">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>User</th>
                  <th>Proof</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {operations.fanTaskSubmissions.length === 0 ? (
                  <EmptyRow label="No submissions" />
                ) : (
                  operations.fanTaskSubmissions.map((submission) => (
                    <tr key={submission.id}>
                      <td>{submission.taskTitle}</td>
                      <td className="mono">{submission.userId}</td>
                      <td>{submission.proof}</td>
                      <td>
                        <span className="badge blue">{submission.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>

        <section id="audit" className="panel">
          <div className="section-title">
            <h2>Audit Log</h2>
            <span className="muted">Latest persistent lifecycle events</span>
          </div>
          <table className="table dense">
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {operations.auditLogs.length === 0 ? (
                <EmptyRow label="No audit logs" />
              ) : (
                operations.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.action}</td>
                    <td>
                      {log.entityType}{" "}
                      <span className="mono">{shortId(log.entityId)}</span>
                    </td>
                    <td className="mono">{log.actorId}</td>
                    <td>{new Date(log.createdAt).toLocaleString("en-HK")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}

function LockedConsole() {
  return (
    <main className="shell locked-shell">
      <section className="locked-panel">
        <div className="brand">
          <strong>FanPass Console</strong>
          <span>Organizer and admin workspace</span>
        </div>
        <h1>Console locked</h1>
        <p>
          Production and staging Console builds require an organizer/admin
          bearer token. Local demo sessions are disabled outside local prototype
          mode so operational data and user details are not exposed by default.
        </p>
        <div className="locked-actions">
          <span className="badge orange">Authentication required</span>
          <span className="muted">
            Set FANPASS_CONSOLE_ACCESS_TOKEN or complete the Privy Console login
            flow.
          </span>
        </div>
        <ConsoleLoginForm />
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConsoleNavItem({
  href,
  label,
  roles,
  active = false,
}: {
  href: string;
  label: string;
  roles: string;
  active?: boolean;
}) {
  return (
    <a className={`nav-item ${active ? "active" : ""}`} href={href}>
      <span>{label}</span>
      <small>{roles}</small>
    </a>
  );
}

function PriceHistory({ market }: { market: AlphaOperations["market"] }) {
  const history = market?.priceHistory ?? [];
  if (history.length === 0) {
    return (
      <div className="empty-state">
        No settled trade history for this ticket type.
      </div>
    );
  }

  const minPrice = Math.min(...history.map((point) => point.price));
  const maxPrice = Math.max(...history.map((point) => point.price));
  const range = Math.max(maxPrice - minPrice, 1);

  return (
    <div className="history-grid">
      <div className="sparkline" aria-label="Price history sparkline">
        {history.map((point) => {
          const height = 28 + ((point.price - minPrice) / range) * 72;
          return (
            <span
              key={point.tradeId}
              className="spark-bar"
              style={{ height: `${height}%` }}
              title={`${money(point.price)} at ${new Date(point.createdAt).toLocaleString("en-HK")}`}
            />
          );
        })}
      </div>
      <table className="table dense">
        <thead>
          <tr>
            <th>Trade</th>
            <th>Price</th>
            <th>Premium</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {history
            .slice()
            .reverse()
            .map((point) => (
              <tr key={point.tradeId}>
                <td className="mono">{shortId(point.tradeId)}</td>
                <td>{money(point.price)}</td>
                <td>{point.premiumPercent.toFixed(1)}%</td>
                <td>{new Date(point.createdAt).toLocaleString("en-HK")}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr>
      <td className="muted" colSpan={6}>
        {label}
      </td>
    </tr>
  );
}

function shortId(id: string) {
  return id.length > 14 ? `${id.slice(0, 8)}...` : id;
}

function money(value: number) {
  return `HK$${value}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-HK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
