import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConsoleAuthRuntimeConfig } from "./runtime-config";

type SessionState = "idle" | "waiting" | "syncing" | "ready" | "failed";

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

  const canLogin =
    ready && !authenticated && state !== "syncing" && state !== "ready";
  const statusLabel = useMemo(() => {
    if (!ready) return "Initializing Privy";
    if (state === "syncing") return "Creating Console session";
    if (state === "ready") return "Console session ready";
    if (authenticated) return "Privy session active";
    return "Sign in to FanPass Console";
  }, [authenticated, ready, state]);

  useEffect(() => {
    if (!ready || !authenticated || submittedSession.current) return;

    submittedSession.current = true;
    let cancelled = false;

    async function syncSession() {
      setState("syncing");
      setMessage("");
      let body: Record<string, string> = {};
      if (privySessionMode === "browser-sdk") {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Privy did not return an access token.");
        }
        body = { accessToken };
      }

      const response = await fetch(sessionBridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    privySessionMode,
    ready,
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
    submittedSession.current = false;
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
