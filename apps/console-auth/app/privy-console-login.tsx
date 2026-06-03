"use client";

import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo, useRef, useState } from "react";

type SessionState = "idle" | "waiting" | "syncing" | "ready" | "failed";

interface ConsolePrivyLoginProps {
  appId: string;
  sessionBridgeUrl: string;
  consoleUrl: string;
}

export function ConsolePrivyLogin(props: ConsolePrivyLoginProps) {
  if (!props.appId) {
    return (
      <div className="auth-state failed">
        <h1>Console auth not configured</h1>
        <p>Missing NEXT_PUBLIC_PRIVY_APP_ID for the isolated auth runtime.</p>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={props.appId}
      config={{
        loginMethods: ["email", "wallet"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <PrivySessionBridge {...props} />
    </PrivyProvider>
  );
}

function PrivySessionBridge({
  sessionBridgeUrl,
  consoleUrl,
}: ConsolePrivyLoginProps) {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const { login } = useLogin();
  const [state, setState] = useState<SessionState>("idle");
  const [message, setMessage] = useState("");
  const submittedSession = useRef(false);

  const canLogin = ready && !authenticated && state !== "waiting";
  const statusLabel = useMemo(() => {
    if (!ready) {
      return "Initializing Privy";
    }
    if (state === "syncing") {
      return "Creating Console session";
    }
    if (state === "ready") {
      return "Console session ready";
    }
    if (authenticated) {
      return "Privy session active";
    }
    return "Authentication required";
  }, [authenticated, ready, state]);

  useEffect(() => {
    if (!ready || !authenticated || submittedSession.current) {
      return;
    }

    submittedSession.current = true;
    let cancelled = false;

    async function syncSession() {
      setState("syncing");
      setMessage("");
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Privy did not return an access token.");
      }

      const response = await fetch(sessionBridgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken }),
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
      submittedSession.current = false;
      setState("failed");
      setMessage(
        error instanceof Error ? error.message : "Console session failed.",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [authenticated, consoleUrl, getAccessToken, ready, sessionBridgeUrl]);

  async function startLogin() {
    setState("waiting");
    setMessage("");
    await login();
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
        <h1>{statusLabel}</h1>
        <p>
          Sign in with Privy, then FanPass will exchange the short-lived access
          token through the Console session bridge.
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
      {message ? <p className="auth-message">{message}</p> : null}
    </div>
  );
}
