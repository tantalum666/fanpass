import { useMemo, useState, type FormEvent } from "react";
import {
  createEvent,
  createTicketType,
  ConsoleApiError,
} from "../../console/api";
import {
  formatEventDate,
  formatMoney,
  formatPercent,
} from "../../console/format";
import { issuedForTicketType, sellThrough } from "../../console/operations";
import type { AlphaEvent, EventOperationsView } from "../../console/types";
import { ConsoleIcon } from "../../components/ConsoleIcon";
import {
  Badge,
  EmptyState,
  PageHeader,
  Section,
  TableFrame,
  toneForStatus,
} from "../../components/ConsoleUi";

type Composer = "event" | "ticket" | null;

export function EventsPage({
  events,
  eventView,
  onEventChange,
  onRefresh,
}: {
  events: AlphaEvent[];
  eventView: EventOperationsView;
  onEventChange: (eventId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState<Composer>(null);
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return events;
    }
    return events.filter((event) =>
      [event.title, event.venue?.name, event.venue?.city]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [events, search]);

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Events & inventory"
        description="Find an event, review its on-sale setup, and manage ticket inventory without losing context."
        actions={
          <button
            className="primary-button"
            onClick={() => setComposer("event")}
            type="button"
          >
            <ConsoleIcon name="plus" size={16} />
            Create event
          </button>
        }
      />

      <div className="event-workspace">
        <aside className="event-directory">
          <div className="directory-search">
            <ConsoleIcon name="search" size={16} />
            <input
              aria-label="Search events"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events or venues"
              type="search"
              value={search}
            />
          </div>
          <div className="event-list" role="list">
            {filteredEvents.map((event) => (
              <button
                aria-current={
                  event.id === eventView.event.id ? "true" : undefined
                }
                className={`event-list-item ${event.id === eventView.event.id ? "event-list-item--active" : ""}`}
                key={event.id}
                onClick={() => onEventChange(event.id)}
                type="button"
              >
                <span className="event-date-tile">
                  <strong>
                    {new Date(event.startTime).toLocaleDateString("en-HK", {
                      day: "2-digit",
                    })}
                  </strong>
                  <small>
                    {new Date(event.startTime).toLocaleDateString("en-HK", {
                      month: "short",
                    })}
                  </small>
                </span>
                <span>
                  <strong>{event.title}</strong>
                  <small>{event.venue?.name ?? "Venue TBD"}</small>
                </span>
                <ConsoleIcon name="chevron" size={15} />
              </button>
            ))}
          </div>
          {filteredEvents.length === 0 ? (
            <EmptyState
              title="No matching events"
              description="Try a title, venue, or city."
            />
          ) : null}
        </aside>

        <div className="event-detail">
          <Section
            title={eventView.event.title}
            description={`${formatEventDate(eventView.event.startTime)} · ${eventView.event.venue?.name ?? "Venue TBD"}, ${eventView.event.venue?.city ?? "City TBD"}`}
            action={
              <Badge tone={toneForStatus(eventView.event.status)}>
                {eventView.event.status}
              </Badge>
            }
          >
            <dl className="event-facts">
              <div>
                <dt>Schedule</dt>
                <dd>
                  {new Date(eventView.event.startTime).toLocaleTimeString(
                    "en-HK",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                  {" – "}
                  {new Date(eventView.event.endTime).toLocaleTimeString(
                    "en-HK",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </dd>
              </div>
              <div>
                <dt>Venue capacity</dt>
                <dd>
                  {eventView.event.venue?.capacity?.toLocaleString("en-HK") ??
                    "Not set"}
                </dd>
              </div>
              <div>
                <dt>Ticket types</dt>
                <dd>{eventView.event.ticketTypes.length}</dd>
              </div>
              <div>
                <dt>Tickets issued</dt>
                <dd>{eventView.tickets.length.toLocaleString("en-HK")}</dd>
              </div>
            </dl>
          </Section>

          <Section
            title="Ticket types"
            description="Supply, pricing, transfer rules, and verified issued inventory."
            action={
              <button
                className="secondary-button"
                onClick={() => setComposer("ticket")}
                type="button"
              >
                <ConsoleIcon name="plus" size={15} />
                Add ticket type
              </button>
            }
          >
            {eventView.event.ticketTypes.length === 0 ? (
              <EmptyState
                title="No ticket types"
                description="Create the first ticket type to prepare this event for sale."
                action={
                  <button onClick={() => setComposer("ticket")}>
                    Add ticket type
                  </button>
                }
              />
            ) : (
              <TableFrame>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticket type</th>
                      <th>Price</th>
                      <th>Issued / supply</th>
                      <th>Sell-through</th>
                      <th>Resale cap</th>
                      <th>Transfers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventView.event.ticketTypes.map((ticketType) => {
                      const issued = issuedForTicketType(
                        eventView,
                        ticketType.id,
                      );
                      const percentage = sellThrough(eventView, ticketType);
                      return (
                        <tr key={ticketType.id}>
                          <td>
                            <strong>{ticketType.name}</strong>
                          </td>
                          <td>
                            {formatMoney(
                              ticketType.faceValue,
                              ticketType.currency,
                            )}
                          </td>
                          <td>
                            {issued.toLocaleString("en-HK")} /{" "}
                            {ticketType.supply.toLocaleString("en-HK")}
                          </td>
                          <td>
                            <div className="table-progress">
                              <span
                                style={{
                                  width: `${Math.min(percentage, 100)}%`,
                                }}
                              />
                            </div>
                            <small>{formatPercent(percentage)}</small>
                          </td>
                          <td>
                            {ticketType.resaleCap === null
                              ? "No cap"
                              : formatMoney(
                                  ticketType.resaleCap,
                                  ticketType.currency,
                                )}
                          </td>
                          <td>
                            {ticketType.transferable
                              ? `Up to ${ticketType.maxTransferCount}`
                              : "Locked"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableFrame>
            )}
          </Section>
        </div>
      </div>

      {composer === "event" ? (
        <CreateEventDialog
          onClose={() => setComposer(null)}
          onSaved={onRefresh}
        />
      ) : null}
      {composer === "ticket" ? (
        <CreateTicketTypeDialog
          event={eventView.event}
          onClose={() => setComposer(null)}
          onSaved={onRefresh}
        />
      ) : null}
    </>
  );
}

function CreateEventDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await createEvent({
        title: String(form.get("title") ?? ""),
        venueName: String(form.get("venueName") ?? ""),
        city: String(form.get("city") ?? ""),
        startTime: String(form.get("startTime") ?? ""),
        endTime: String(form.get("endTime") ?? ""),
      });
      await onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ConsoleApiError
          ? caught.message
          : "Event creation failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Composer
      title="Create event"
      description="Set the operating identity and schedule. Inventory is added next."
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <label>
          Event title
          <input name="title" required />
        </label>
        <div className="form-columns">
          <label>
            Venue
            <input name="venueName" required />
          </label>
          <label>
            City
            <input name="city" required />
          </label>
        </div>
        <div className="form-columns">
          <label>
            Start
            <input name="startTime" required type="datetime-local" />
          </label>
          <label>
            End
            <input name="endTime" required type="datetime-local" />
          </label>
        </div>
        {error ? (
          <p className="form-message form-message--error">{error}</p>
        ) : null}
        <div className="composer-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button disabled={saving} type="submit">
            {saving ? "Creating…" : "Create event"}
          </button>
        </div>
      </form>
    </Composer>
  );
}

function CreateTicketTypeDialog({
  event,
  onClose,
  onSaved,
}: {
  event: AlphaEvent;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(submitEvent.currentTarget);
    const resaleCap = String(form.get("resaleCap") ?? "").trim();
    try {
      await createTicketType(event.id, {
        name: String(form.get("name") ?? ""),
        faceValue: Number(form.get("faceValue")),
        supply: Number(form.get("supply")),
        resaleCap: resaleCap ? Number(resaleCap) : undefined,
        maxTransferCount: Number(form.get("maxTransferCount")),
        transferable: form.get("transferable") === "on",
      });
      await onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ConsoleApiError
          ? caught.message
          : "Ticket type creation failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Composer
      title="Add ticket type"
      description={`Configure inventory for ${event.title}.`}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <label>
          Ticket type name
          <input name="name" required />
        </label>
        <div className="form-columns">
          <label>
            Face value (HKD)
            <input min="1" name="faceValue" required type="number" />
          </label>
          <label>
            Supply
            <input min="1" name="supply" required type="number" />
          </label>
        </div>
        <div className="form-columns">
          <label>
            Resale cap (optional)
            <input min="0" name="resaleCap" type="number" />
          </label>
          <label>
            Maximum transfers
            <input min="0" name="maxTransferCount" required type="number" />
          </label>
        </div>
        <label className="checkbox-field">
          <input defaultChecked name="transferable" type="checkbox" />
          Allow ticket transfers
        </label>
        {error ? (
          <p className="form-message form-message--error">{error}</p>
        ) : null}
        <div className="composer-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button disabled={saving} type="submit">
            {saving ? "Adding…" : "Add ticket type"}
          </button>
        </div>
      </form>
    </Composer>
  );
}

function Composer({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="composer-layer" role="presentation">
      <button
        aria-label="Close form"
        className="composer-backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby="composer-title"
        aria-modal="true"
        className="composer-panel"
        role="dialog"
      >
        <header>
          <div>
            <h2 id="composer-title">{title}</h2>
            <p>{description}</p>
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
        {children}
      </section>
    </div>
  );
}
