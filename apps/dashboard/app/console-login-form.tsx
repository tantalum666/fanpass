"use client";

import { FormEvent, useState } from "react";

type LoginState = "idle" | "submitting" | "ready" | "failed";

export function ConsoleLoginForm() {
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<LoginState>("idle");

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
      headers: {
        "Content-Type": "application/json",
      },
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
    window.location.reload();
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
    </form>
  );
}
