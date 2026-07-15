import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConsoleAuthRuntimeConfig } from "./runtime-config";

type SessionState = "idle" | "waiting" | "syncing" | "ready" | "failed";
type SessionRecoveryMode = "" | "refresh" | "reauth";
const HANDOFF_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_REFRESH_BACKOFF_MS = 750;

export function ConsolePrivyLogin(props: ConsoleAuthRuntimeConfig) {
  return (
    <PrivyProvider
      appId={props.appId}
      config={{
        loginMethods: ["email"],
      }}
    >
      <PrivySessionBridge {...props} />
    </PrivyProvider>
  );
}

function PrivySessionBridge({
  sessionBridgeUrl,
  consoleUrl,
  privySessionMode,
}: ConsoleAuthRuntimeConfig) {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const { login } = useLogin();
  const [state, setState] = useState<SessionState>("idle");
  const [message, setMessage] = useState("");
  const submittedSession = useRef(false);
  const preparedRecovery = useRef(false);
  const handoffForm = useRef<HTMLFormElement>(null);
  const handoffTokenInput = useRef<HTMLInputElement>(null);
  const handoffState = useMemo(
    () =>
      privySessionMode === "browser-sdk" ? currentHandoffState() : "",
    [privySessionMode],
  );
  const handoffStartUrl = useMemo(
    () => consoleHandoffStartUrl(consoleUrl),
    [consoleUrl],
  );
  const recoveryMode = useMemo(currentSessionRecoveryMode, []);
  const [recoveryReady, setRecoveryReady] = useState(!recoveryMode);

  const canLogin =
    ready &&
    !authenticated &&
    recoveryReady &&
    (privySessionMode !== "browser-sdk" || Boolean(handoffState)) &&
    state !== "syncing" &&
    state !== "ready";
  const statusLabel = useMemo(() => {
    if (!ready) return "Initializing Privy";
    if (state === "waiting" && recoveryMode === "refresh") {
      return "Refreshing Privy session";
    }
    if (state === "waiting" && recoveryMode === "reauth") {
      return "Resetting expired Privy session";
    }
    if (state === "syncing") return "Creating Console session";
    if (state === "ready") return "Console session ready";
    if (authenticated) return "Privy session active";
    return "Sign in to FanPass Console";
  }, [authenticated, ready, recoveryMode, state]);

  useEffect(() => {
    if (privySessionMode === "browser-sdk" && !handoffState) {
      window.location.replace(handoffStartUrl);
    }
  }, [handoffStartUrl, handoffState, privySessionMode]);

  useEffect(() => {
    if (
      !ready ||
      !recoveryMode ||
      preparedRecovery.current ||
      privySessionMode !== "browser-sdk"
    ) {
      return;
    }

    preparedRecovery.current = true;
    submittedSession.current = true;
    setState("waiting");

    if (recoveryMode === "refresh") {
      setMessage("Refreshing your expired Privy access token.");
      const timer = window.setTimeout(() => {
        submittedSession.current = false;
        setRecoveryReady(true);
      }, SESSION_REFRESH_BACKOFF_MS);
      return () => window.clearTimeout(timer);
    }

    setMessage("Your Privy session expired. Sign in again to continue.");
    if (!authenticated) {
      submittedSession.current = false;
      setRecoveryReady(true);
      setState("idle");
      return;
    }

    void logout().catch(() => {
      submittedSession.current = false;
      setState("failed");
      setMessage("Privy session reset failed. Use Reset and try again.");
    });
  }, [authenticated, logout, privySessionMode, ready, recoveryMode]);

  useEffect(() => {
    if (
      recoveryMode !== "reauth" ||
      !preparedRecovery.current ||
      authenticated ||
      recoveryReady
    ) {
      return;
    }
    submittedSession.current = false;
    setRecoveryReady(true);
    setState("idle");
    setMessage("Your Privy session expired. Sign in again to continue.");
  }, [authenticated, recoveryMode, recoveryReady]);

  useEffect(() => {
    if (
      !ready ||
      !authenticated ||
      submittedSession.current ||
      !recoveryReady ||
      (privySessionMode === "browser-sdk" && !handoffState)
    ) {
      return;
    }

    submittedSession.current = true;
    let cancelled = false;

    async function syncSession() {
      setState("syncing");
      setMessage("");
      if (privySessionMode === "browser-sdk") {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Privy did not return an access token.");
        }

        const form = handoffForm.current;
        const tokenInput = handoffTokenInput.current;
        if (!form || !tokenInput) {
          throw new Error("Console session handoff is unavailable.");
        }

        tokenInput.value = accessToken;
        form.requestSubmit();
        return;
      }

      const response = await fetch(sessionBridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
        credentials: "include",
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.message ?? "Console session failed.");
      }

      if (!cancelled) {
        setState("ready");
        setMessage("Organizer/admin session accepted.");
        window.location.assign(consoleUrl);
      }
    }

    syncSession().catch((error: unknown) => {
      if (cancelled) return;
      submittedSession.current = false;
      setState("failed");
      setMessage(
        error instanceof Error ? error.message : "Console session failed.",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    authenticated,
    consoleUrl,
    getAccessToken,
    handoffState,
    privySessionMode,
    ready,
    recoveryReady,
    sessionBridgeUrl,
  ]);

  async function startLogin() {
    setState("waiting");
    setMessage("Complete sign-in in the Privy dialog.");
    try {
      await login();
    } catch {
      setState("failed");
      setMessage("Privy sign-in could not be opened. Please try again.");
    }
  }

  async function resetSession() {
    if (handoffTokenInput.current) {
      handoffTokenInput.current.value = "";
    }
    submittedSession.current = false;
    setRecoveryReady(true);
    setState("idle");
    setMessage("");
    await logout();
  }

  return (
    <div className="auth-flow">
      <div className={`auth-state ${state}`}>
        <p className="eyebrow">Protected workspace</p>
        <h1 id="auth-title">{statusLabel}</h1>
        <p>
          Organizer and admin access is verified before operational data is
          loaded.
        </p>
      </div>
      <div className="auth-actions">
        <button type="button" onClick={startLogin} disabled={!canLogin}>
          Continue with Privy
        </button>
        {authenticated ? (
          <button type="button" className="secondary" onClick={resetSession}>
            Reset
          </button>
        ) : null}
      </div>
      {privySessionMode === "browser-sdk" ? (
        <form
          ref={handoffForm}
          action={sessionBridgeUrl}
          method="post"
          target="_self"
          hidden
        >
          <input
            ref={handoffTokenInput}
            type="hidden"
            name="accessToken"
            autoComplete="off"
          />
          <input type="hidden" name="handoff" value="top-level" />
          <input type="hidden" name="handoffState" value={handoffState} />
          <input type="hidden" name="recovery" value={recoveryMode} />
        </form>
      ) : null}
      {message ? (
        <p
          className="auth-message"
          role={state === "failed" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      <p className="session-note">
        {privySessionMode === "httponly-cookie"
          ? "Privy and Console sessions use HttpOnly cookies on the verified production domain."
          : "The Console session uses an HttpOnly cookie. This staging page does not create an additional app-managed token store."}
      </p>
    </div>
  );
}

function currentHandoffState() {
  const state =
    new URLSearchParams(window.location.search).get("handoff") ?? "";
  return HANDOFF_STATE_PATTERN.test(state) ? state : "";
}

function currentSessionRecoveryMode(): SessionRecoveryMode {
  const mode = new URLSearchParams(window.location.search).get("recovery");
  return mode === "refresh" || mode === "reauth" ? mode : "";
}

function consoleHandoffStartUrl(consoleUrl: string) {
  const url = new URL(consoleUrl);
  url.pathname = "/api/console/privy-handoff";
  url.search = "";
  url.hash = "";
  return url.toString();
}
