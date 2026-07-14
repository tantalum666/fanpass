import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ConsoleApiError, createEvent, loadOperations } from "./console/api";
import { eventOperations } from "./console/operations";
import type { AlphaOperations, ConsolePageKey } from "./console/types";
import { ConsoleShell } from "./components/ConsoleShell";
import { EmptyState } from "./components/ConsoleUi";

const OverviewPage = lazy(() =>
  import("./features/overview/OverviewPage").then((module) => ({
    default: module.OverviewPage,
  })),
);
const EventsPage = lazy(() =>
  import("./features/events/EventsPage").then((module) => ({
    default: module.EventsPage,
  })),
);
const SalesPage = lazy(() =>
  import("./features/sales/SalesPage").then((module) => ({
    default: module.SalesPage,
  })),
);
const EntryPage = lazy(() =>
  import("./features/entry/EntryPage").then((module) => ({
    default: module.EntryPage,
  })),
);
const TeamPage = lazy(() =>
  import("./features/team/TeamPage").then((module) => ({
    default: module.TeamPage,
  })),
);
const RiskPage = lazy(() =>
  import("./features/risk/RiskPage").then((module) => ({
    default: module.RiskPage,
  })),
);

type LoadState = "loading" | "ready" | "locked" | "error";
const validPages = new Set<ConsolePageKey>([
  "overview",
  "events",
  "sales",
  "entry",
  "team",
  "risk",
]);

export function ConsoleApp() {
  const [operations, setOperations] = useState<AlphaOperations | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState<ConsolePageKey>(pageFromLocation());
  const [selectedEventId, setSelectedEventId] = useState(eventFromLocation());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const payload = await loadOperations();
      setOperations(payload);
      setLoadState("ready");
    } catch (caught) {
      if (caught instanceof ConsoleApiError && caught.status === 401) {
        setLoadState("locked");
        setOperations(null);
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Console data could not be loaded.",
        );
        setLoadState("error");
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function syncNavigation() {
      setPage(pageFromLocation());
      setSelectedEventId(eventFromLocation());
    }
    window.addEventListener("hashchange", syncNavigation);
    window.addEventListener("popstate", syncNavigation);
    return () => {
      window.removeEventListener("hashchange", syncNavigation);
      window.removeEventListener("popstate", syncNavigation);
    };
  }, []);

  const selectedEvent = useMemo(() => {
    if (!operations?.events.length) {
      return null;
    }
    return (
      operations.events.find((event) => event.id === selectedEventId) ??
      operations.events[0]
    );
  }, [operations, selectedEventId]);

  useEffect(() => {
    if (selectedEvent && selectedEvent.id !== selectedEventId) {
      setSelectedEventId(selectedEvent.id);
      writeEventToLocation(selectedEvent.id);
    }
  }, [selectedEvent, selectedEventId]);

  if (loadState === "locked") {
    return <LockedConsole onSessionReady={refresh} />;
  }

  if (loadState === "loading" && !operations) {
    return (
      <ShellMessage
        title="Loading Console"
        message="Preparing the operations workspace."
      />
    );
  }

  if (loadState === "error" && !operations) {
    return (
      <ShellMessage
        title="Console unavailable"
        message={error || "FanPass Console could not load current operations."}
        action={<button onClick={() => void refresh()}>Retry</button>}
      />
    );
  }

  if (!operations) {
    return (
      <ShellMessage
        title="Console unavailable"
        message="No operations response was returned."
      />
    );
  }

  if (!selectedEvent) {
    return <EmptyWorkspace onCreated={refresh} />;
  }

  const eventView = eventOperations(operations, selectedEvent);

  function changePage(nextPage: ConsolePageKey) {
    window.location.hash = nextPage;
    setPage(nextPage);
  }

  function changeEvent(eventId: string) {
    setSelectedEventId(eventId);
    writeEventToLocation(eventId);
  }

  return (
    <ConsoleShell
      events={operations.events}
      onEventChange={changeEvent}
      onPageChange={changePage}
      onRefresh={refresh}
      page={page}
      piiRedacted={operations.privacy.piiRedacted}
      refreshing={refreshing}
      selectedEvent={selectedEvent}
      viewerRole={operations.privacy.viewerRole}
    >
      {loadState === "error" ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() => void refresh()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
      <Suspense fallback={<PageLoading />}>
        {page === "overview" ? (
          <OverviewPage eventView={eventView} operations={operations} />
        ) : null}
        {page === "events" ? (
          <EventsPage
            events={operations.events}
            eventView={eventView}
            onEventChange={changeEvent}
            onRefresh={refresh}
          />
        ) : null}
        {page === "sales" ? <SalesPage eventView={eventView} /> : null}
        {page === "entry" ? <EntryPage eventView={eventView} /> : null}
        {page === "team" ? (
          <TeamPage eventView={eventView} onRefresh={refresh} />
        ) : null}
        {page === "risk" ? (
          <RiskPage eventView={eventView} operations={operations} />
        ) : null}
      </Suspense>
    </ConsoleShell>
  );
}

function pageFromLocation(): ConsolePageKey {
  const candidate = window.location.hash.replace(/^#\/?/, "") as ConsolePageKey;
  return validPages.has(candidate) ? candidate : "overview";
}

function eventFromLocation() {
  return new URL(window.location.href).searchParams.get("event") ?? "";
}

function writeEventToLocation(eventId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("event", eventId);
  window.history.replaceState(null, "", url);
}

function PageLoading() {
  return (
    <div className="page-loading" role="status">
      <span />
      Loading workspace…
    </div>
  );
}

function EmptyWorkspace({ onCreated }: { onCreated: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      await onCreated();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Event creation failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="centered-shell">
      <div className="centered-panel">
        <Brand />
        <EmptyState
          title="Create your first event"
          description="The Console becomes event-first after the initial event and schedule are saved."
          action={
            !showForm ? (
              <button onClick={() => setShowForm(true)}>Create event</button>
            ) : undefined
          }
        />
        {showForm ? (
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
            <button disabled={saving} type="submit">
              {saving ? "Creating…" : "Create event"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}

function LockedConsole({
  onSessionReady,
}: {
  onSessionReady: () => Promise<void>;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Brand />
        <div className="auth-copy">
          <p className="eyebrow">Protected workspace</p>
          <h1>Sign in to FanPass Console</h1>
          <p>
            Organizer and admin access is verified before operational data is
            loaded.
          </p>
        </div>
        <ConsoleLoginForm onSessionReady={onSessionReady} />
        <p className="auth-footnote">
          Sessions are stored in a secure HttpOnly cookie. Access tokens are
          never kept in browser storage.
        </p>
      </section>
    </main>
  );
}

function ConsoleLoginForm({
  onSessionReady,
}: {
  onSessionReady: () => Promise<void>;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<
    "idle" | "submitting" | "ready" | "failed"
  >("idle");
  const consoleAuthUrl = safeConsoleAuthUrl(
    import.meta.env.VITE_CONSOLE_AUTH_BASE_URL,
  );

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
    const result = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

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
    <div className="auth-actions-stack">
      {consoleAuthUrl ? (
        <a
          className="primary-link"
          data-testid="console-privy-login"
          href={consoleAuthUrl}
        >
          Continue with Privy
        </a>
      ) : (
        <p className="form-message form-message--error" role="alert">
          Privy sign-in is temporarily unavailable. Use developer access or
          contact an administrator.
        </p>
      )}
      <details className="developer-access" open={!consoleAuthUrl}>
        <summary>
          {consoleAuthUrl ? "Developer access" : "Connect with an access token"}
        </summary>
        <form className="console-login-form" onSubmit={submitSession}>
          <label htmlFor="consoleAccessToken">Privy access token</label>
          <textarea
            autoComplete="off"
            id="consoleAccessToken"
            name="consoleAccessToken"
            onChange={(event) => setAccessToken(event.target.value)}
            rows={3}
            spellCheck={false}
            value={accessToken}
          />
          <button disabled={state === "submitting"} type="submit">
            {state === "submitting" ? "Connecting…" : "Start session"}
          </button>
          {message ? (
            <p
              className={`form-message ${state === "failed" ? "form-message--error" : ""}`}
            >
              {message}
            </p>
          ) : null}
        </form>
      </details>
    </div>
  );
}

function safeConsoleAuthUrl(configuredUrl: string | undefined) {
  const value = configuredUrl?.trim();
  if (!value) {
    return "";
  }

  try {
    const authUrl = new URL(value, window.location.origin);
    if (
      !["http:", "https:"].includes(authUrl.protocol) ||
      authUrl.origin === window.location.origin
    ) {
      return "";
    }
    return authUrl.toString();
  } catch {
    return "";
  }
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
    <main className="centered-shell">
      <section className="centered-panel">
        <Brand />
        <div className="auth-copy">
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
        {action}
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="standalone-brand">
      <span className="brand-mark">FP</span>
      <div>
        <strong>FanPass</strong>
        <span>Console</span>
      </div>
    </div>
  );
}
