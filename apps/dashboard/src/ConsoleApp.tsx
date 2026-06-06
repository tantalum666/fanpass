import { FormEvent, useEffect, useMemo, useState } from "react";
import { OrderbookLivePanel } from "./OrderbookLivePanel";

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

export interface AlphaOperations {
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

type LoadState = "loading" | "ready" | "locked" | "error";

export function ConsoleApp() {
  const [operations, setOperations] = useState<AlphaOperations | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoadState("loading");
    setError("");
    const response = await fetch("/api/console/operations", {
      cache: "no-store",
    });
    if (response.status === 401) {
      setLoadState("locked");
      setOperations(null);
      return;
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(payload?.message ?? "Console data could not be loaded.");
      setLoadState("error");
      return;
    }
    const payload = (await response.json()) as AlphaOperations;
    setOperations(payload);
    setLoadState("ready");
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (loadState === "locked") {
    return <LockedConsole onSessionReady={refresh} />;
  }

  if (loadState === "loading" && !operations) {
    return <ShellMessage title="Loading Console" message="Fetching Alpha operations." />;
  }

  if (loadState === "error" || !operations) {
    return (
      <ShellMessage
        title="Console unavailable"
        message={error || "FanPass Console could not load current operations."}
        action={<button onClick={refresh}>Retry</button>}
      />
    );
  }

  return <Dashboard operations={operations} onRefresh={refresh} />;
}

function Dashboard({
  operations,
  onRefresh,
}: {
  operations: AlphaOperations;
  onRefresh: () => Promise<void>;
}) {
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
          <span className="muted">API: staging/local configured</span>
          <span className={`badge ${operations.privacy.piiRedacted ? "orange" : "green"}`}>
            {operations.privacy.piiRedacted ? "PII redacted" : "Admin PII visible"}
          </span>
          <button className="secondary-button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </header>

      <nav className="workspace-nav" aria-label="Console workspace">
        <ConsoleNavItem href="#overview" label="Overview" roles="Organizer Admin" active />
        <ConsoleNavItem href="#inventory" label="Inventory" roles="Organizer Admin" />
        <ConsoleNavItem href="#market" label="Market" roles="Admin" />
        <ConsoleNavItem href="#gate" label="Gate Ops" roles="Organizer Admin" />
        <ConsoleNavItem href="#fan-access" label="Fan Access" roles="Organizer Admin" />
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
            <Metric label="Persistent tickets" value={operations.tickets.length} />
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
                    <td>{event.venue ? `${event.venue.name}, ${event.venue.city}` : "TBD"}</td>
                    <td>
                      <span className="badge green">{event.status}</span>
                    </td>
                    <td>{event.ticketTypes.map((ticketType) => ticketType.name).join(", ")}</td>
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
          <CreateEventPanel onSaved={onRefresh} />
          <CreateTicketTypePanel events={events} defaultEventId={firstEvent?.id} onSaved={onRefresh} />
        </div>

        <TicketsTable operations={operations} />

        <div className="split equal">
          <OrdersTable operations={operations} />
          <TradesTable operations={operations} />
        </div>

        <SideEffectsTable operations={operations} />
        <PriceHistory market={operations.market} />

        <div id="gate" className="split">
          <GateAssignmentsTable operations={operations} onRefresh={onRefresh} />
          <GateStaffInviteForm
            events={events.map((event) => ({ id: event.id, title: event.title }))}
            defaultEventId={firstEvent?.id}
            onSaved={onRefresh}
          />
        </div>

        <div className="split equal">
          <GateCheckinsTable operations={operations} />
          <FanAccessTable operations={operations} />
        </div>

        <AuditTable operations={operations} />
      </section>
    </main>
  );
}

function CreateEventPanel({ onSaved }: { onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Creating event");
    const response = await fetch("/api/console/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(form.get("title") ?? ""),
        venueName: String(form.get("venueName") ?? ""),
        city: String(form.get("city") ?? "Hong Kong"),
        startTime: String(form.get("startTime") ?? ""),
        endTime: String(form.get("endTime") ?? ""),
      }),
    });
    setStatus(response.ok ? "Event created" : "Event creation failed");
    if (response.ok) {
      await onSaved();
    }
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Create Event</h2>
        <span className="muted">Writes through the Console BFF</span>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Event title
          <input name="title" required defaultValue="FanPass Live Test" />
        </label>
        <label>
          Venue
          <input name="venueName" required defaultValue="AsiaWorld-Arena" />
        </label>
        <label>
          City
          <input name="city" required defaultValue="Hong Kong" />
        </label>
        <label>
          Start
          <input name="startTime" required type="datetime-local" defaultValue="2026-11-21T20:00" />
        </label>
        <label>
          End
          <input name="endTime" required type="datetime-local" defaultValue="2026-11-21T23:00" />
        </label>
        <button type="submit">Create event</button>
      </form>
      {status ? <p className="form-status">{status}</p> : null}
    </section>
  );
}

function CreateTicketTypePanel({
  events,
  defaultEventId,
  onSaved,
}: {
  events: AlphaEvent[];
  defaultEventId?: string;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const eventId = String(form.get("eventId") ?? "");
    setStatus("Adding ticket type");
    const response = await fetch(
      `/api/console/events/${encodeURIComponent(eventId)}/ticket-types`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          faceValue: Number(form.get("faceValue") ?? 0),
          supply: Number(form.get("supply") ?? 0),
          resaleCap: Number(form.get("resaleCap") ?? 0),
          maxTransferCount: Number(form.get("maxTransferCount") ?? 0),
          transferable: form.get("transferable") === "on",
        }),
      },
    );
    setStatus(response.ok ? "Ticket type added" : "Ticket type failed");
    if (response.ok) {
      await onSaved();
    }
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Add Ticket Type</h2>
        <span className="muted">Face value and resale cap</span>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Event
          <select name="eventId" required defaultValue={defaultEventId}>
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
          <input name="faceValue" required type="number" min="1" defaultValue="1888" />
        </label>
        <label>
          Supply
          <input name="supply" required type="number" min="1" defaultValue="200" />
        </label>
        <label>
          Resale cap
          <input name="resaleCap" type="number" min="0" defaultValue="2265" />
        </label>
        <label>
          Max transfers
          <input name="maxTransferCount" required type="number" min="0" defaultValue="2" />
        </label>
        <label className="checkbox-row">
          <input name="transferable" type="checkbox" defaultChecked />
          Transferable
        </label>
        <button type="submit" disabled={events.length === 0}>
          Add ticket type
        </button>
      </form>
      {status ? <p className="form-status">{status}</p> : null}
    </section>
  );
}

function GateStaffInviteForm({
  events,
  defaultEventId,
  onSaved,
}: {
  events: { id: string; title: string }[];
  defaultEventId?: string;
  onSaved: () => Promise<void>;
}) {
  const initialEventId = defaultEventId ?? events[0]?.id ?? "";
  const [eventId, setEventId] = useState(initialEventId);
  const [gate, setGate] = useState("A2");
  const [staffName, setStaffName] = useState("Gate Team Member");
  const [staffEmail, setStaffEmail] = useState("gate-a2@fanpass.test");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<GateAssignmentResponse | null>(null);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, gate, staffName, staffEmail }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        assignment?: GateAssignmentResponse;
      } | null;

      if (!response.ok || !payload?.assignment) {
        setAssignment(null);
        setError(payload?.message ?? "Gate staff assignment failed");
        return;
      }

      setAssignment(payload.assignment);
      await onSaved();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Assign Gate Staff</h2>
        <span className="muted">Organizer-scoped access and one-time invite</span>
      </div>
      <div className="gate-invite-workspace">
        <form className="form-grid single" onSubmit={handleSubmit}>
          <label>
            Event
            <select required value={eventId} onChange={(event) => setEventId(event.target.value)}>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Gate
            <input required maxLength={24} value={gate} onChange={(event) => setGate(event.target.value)} />
          </label>
          <label>
            Staff name
            <input required maxLength={120} value={staffName} onChange={(event) => setStaffName(event.target.value)} />
          </label>
          <label>
            Staff email
            <input required type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} />
          </label>
          <button type="submit" disabled={isSubmitting || events.length === 0}>
            {isSubmitting ? "Creating invite" : "Assign staff"}
          </button>
        </form>
        {error ? <div className="form-alert error">{error}</div> : null}
        <InviteTokenPanel
          assignment={assignment}
          fallbackEventTitle={selectedEventTitle}
          copyStatus={copyStatus}
          onCopyStatus={setCopyStatus}
          onClear={() => setAssignment(null)}
        />
      </div>
    </section>
  );
}

function GateAssignmentsTable({
  operations,
  onRefresh,
}: {
  operations: AlphaOperations;
  onRefresh: () => Promise<void>;
}) {
  async function deactivate(assignmentId: string) {
    await fetch(`/api/console/gate-assignments/${encodeURIComponent(assignmentId)}/deactivate`, {
      method: "POST",
    });
    await onRefresh();
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Gate Staff Assignments</h2>
        <span className="muted">Staff access for event and gate operations</span>
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
                  <div className="mono">{assignment.staffEmail ?? assignment.staffUserId}</div>
                </td>
                <td>
                  <span className={`badge ${assignment.active ? "green" : "orange"}`}>
                    {assignment.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                  <div className="muted">{assignment.linked ? "Privy linked" : "Invite pending"}</div>
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
                      <div className="muted">Expires {formatDate(assignment.invite.expiresAt)}</div>
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
                          onRefresh={onRefresh}
                        />
                      ) : null}
                      <button className="secondary-button" onClick={() => void deactivate(assignment.id)}>
                        Revoke
                      </button>
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
  );
}

function RotateStaffInviteButton({
  assignmentId,
  staffName,
  onRefresh,
}: {
  assignmentId: string;
  staffName: string;
  onRefresh: () => Promise<void>;
}) {
  const [assignment, setAssignment] = useState<GateAssignmentResponse | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function rotateInvite() {
    setIsRotating(true);
    setError(null);
    setCopyStatus("idle");
    try {
      const response = await fetch(
        `/api/console/gate-assignments/${encodeURIComponent(assignmentId)}/invites`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        assignment?: GateAssignmentResponse;
      } | null;
      if (!response.ok || !payload?.assignment) {
        setAssignment(null);
        setError(payload?.message ?? "Staff invite rotation failed");
        return;
      }
      setAssignment(payload.assignment);
      await onRefresh();
    } finally {
      setIsRotating(false);
    }
  }

  return (
    <div className="assignment-action-stack">
      <button className="secondary-button" type="button" disabled={isRotating} onClick={rotateInvite}>
        {isRotating ? "Rotating" : "Rotate invite"}
      </button>
      {error ? <p className="risk-text compact">{error}</p> : null}
      <InviteTokenPanel
        compact
        assignment={assignment}
        fallbackStaffName={staffName}
        copyStatus={copyStatus}
        onCopyStatus={setCopyStatus}
        onClear={() => setAssignment(null)}
      />
    </div>
  );
}

function InviteTokenPanel({
  assignment,
  fallbackEventTitle,
  fallbackStaffName,
  copyStatus,
  compact = false,
  onCopyStatus,
  onClear,
}: {
  assignment: GateAssignmentResponse | null;
  fallbackEventTitle?: string;
  fallbackStaffName?: string;
  copyStatus: "idle" | "copied" | "failed";
  compact?: boolean;
  onCopyStatus: (status: "idle" | "copied" | "failed") => void;
  onClear: () => void;
}) {
  const inviteToken = assignment?.inviteToken ?? "";
  if (!assignment || !inviteToken) {
    return null;
  }

  async function copyInviteToken() {
    try {
      await navigator.clipboard.writeText(inviteToken);
      onCopyStatus("copied");
    } catch {
      onCopyStatus("failed");
    }
  }

  return (
    <div className={`invite-token-panel ${compact ? "compact" : ""}`} data-testid="staff-invite-token">
      <div>
        <span className="badge blue">{compact ? "ROTATED INVITE" : "ONE-TIME INVITE"}</span>
        <h3>{assignment.staffName || fallbackStaffName}</h3>
        <p className="muted">
          {assignment.eventTitle || fallbackEventTitle} · Gate {assignment.gate}
        </p>
      </div>
      <code>{inviteToken}</code>
      <div className="inline-actions">
        <button type="button" onClick={copyInviteToken}>
          Copy token
        </button>
        <button className="secondary-button" type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <p className="muted">
        Token is shown once. Store it only long enough to deliver it through the approved invite channel.
      </p>
      {copyStatus !== "idle" ? (
        <p className={copyStatus === "copied" ? "success-text" : "risk-text"}>
          {copyStatus === "copied"
            ? "Invite token copied."
            : "Clipboard access failed; select and copy the token manually."}
        </p>
      ) : null}
    </div>
  );
}

function TicketsTable({ operations }: { operations: AlphaOperations }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Tickets</h2>
        <span className="muted">Current ownership and verification state</span>
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
                  <span className={`badge ${ticket.transferable ? "blue" : "orange"}`}>
                    {ticket.transferable ? "TRANSFERABLE" : "LOCKED"}
                  </span>
                  <div className="muted">{ticket.transferCount} transfers</div>
                </td>
                <td>
                  <span className={`badge ${ticket.status === "REDEEMED" ? "orange" : "blue"}`}>
                    {ticket.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function OrdersTable({ operations }: { operations: AlphaOperations }) {
  return (
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
                  <span className={`badge ${order.side === "BUY" ? "blue" : "orange"}`}>
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
  );
}

function TradesTable({ operations }: { operations: AlphaOperations }) {
  return (
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
                  <span className="badge green">{trade.settlementStatus}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function SideEffectsTable({ operations }: { operations: AlphaOperations }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Side Effects</h2>
        <span className="muted">Durable payment and ownership operation trail</span>
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
  );
}

function PriceHistory({ market }: { market: AlphaOperations["market"] }) {
  const history = market?.priceHistory ?? [];
  if (history.length === 0) {
    return (
      <section className="panel market-history">
        <div className="section-title">
          <h2>Price History</h2>
          <span className="muted">0 settled trades for selected ticket type</span>
        </div>
        <div className="empty-state">No settled trade history for this ticket type.</div>
      </section>
    );
  }

  const minPrice = Math.min(...history.map((point) => point.price));
  const maxPrice = Math.max(...history.map((point) => point.price));
  const range = Math.max(maxPrice - minPrice, 1);

  return (
    <section className="panel market-history">
      <div className="section-title">
        <h2>Price History</h2>
        <span className="muted">{history.length} settled trades for selected ticket type</span>
      </div>
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
    </section>
  );
}

function GateCheckinsTable({ operations }: { operations: AlphaOperations }) {
  return (
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
                  <span>{checkin.scannerEmail ?? "Redacted scanner"}</span>
                  <div className="mono">{checkin.scannerUserId}</div>
                </td>
                <td>
                  <span className={`badge ${checkin.result === "ACCEPTED" ? "green" : "orange"}`}>
                    {checkin.result}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function FanAccessTable({ operations }: { operations: AlphaOperations }) {
  return (
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
  );
}

function AuditTable({ operations }: { operations: AlphaOperations }) {
  return (
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
                  {log.entityType} <span className="mono">{shortId(log.entityId)}</span>
                </td>
                <td className="mono">{log.actorId}</td>
                <td>{new Date(log.createdAt).toLocaleString("en-HK")}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function LockedConsole({ onSessionReady }: { onSessionReady: () => Promise<void> }) {
  return (
    <main className="shell locked-shell">
      <section className="locked-panel">
        <div className="brand">
          <strong>FanPass Console</strong>
          <span>Organizer and admin workspace</span>
        </div>
        <h1>Console locked</h1>
        <p>
          Production and staging Console builds require an organizer/admin bearer token. Local demo
          sessions are disabled outside local prototype mode so operational data and user details are not
          exposed by default.
        </p>
        <div className="locked-actions">
          <span className="badge orange">Authentication required</span>
          <span className="muted">Set FANPASS_CONSOLE_ACCESS_TOKEN or complete the Privy Console login flow.</span>
        </div>
        <ConsoleLoginForm onSessionReady={onSessionReady} />
      </section>
    </main>
  );
}

function ConsoleLoginForm({ onSessionReady }: { onSessionReady: () => Promise<void> }) {
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "ready" | "failed">("idle");
  const consoleAuthUrl = import.meta.env.VITE_CONSOLE_AUTH_BASE_URL ?? "";

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = accessToken.trim();
    if (!token) {
      setState("failed");
      setMessage("Privy access token is required.");
      return;
    }

    setState("submitting");
    setMessage("");
    setAccessToken("");

    const response = await fetch("/api/console/privy-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token }),
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setState("failed");
      setMessage(result?.message ?? "Console session failed.");
      return;
    }

    setState("ready");
    setMessage("Console session ready.");
    await onSessionReady();
  }

  return (
    <form className="console-login-form" onSubmit={submitSession}>
      <label htmlFor="consoleAccessToken">Privy access token</label>
      <textarea
        id="consoleAccessToken"
        name="consoleAccessToken"
        value={accessToken}
        onChange={(event) => setAccessToken(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        rows={3}
      />
      <button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Connecting" : "Start session"}
      </button>
      {message ? <p className="form-status">{message}</p> : null}
      {consoleAuthUrl ? (
        <a className="secondary-link" href={consoleAuthUrl}>
          Continue with Privy
        </a>
      ) : null}
    </form>
  );
}

function ShellMessage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="shell locked-shell">
      <section className="locked-panel">
        <div className="brand">
          <strong>FanPass Console</strong>
          <span>Organizer and admin workspace</span>
        </div>
        <h1>{title}</h1>
        <p>{message}</p>
        {action}
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

function EmptyRow({ label }: { label: string }) {
  return (
    <tr>
      <td className="muted" colSpan={6}>
        {label}
      </td>
    </tr>
  );
}

function shortId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-HK");
}

function money(value: number) {
  return `HK$${value}`;
}
