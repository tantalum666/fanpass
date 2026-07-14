import { lazy, Suspense, useEffect, useState } from "react";
import {
  loadRuntimeConfig,
  type ConsoleAuthRuntimeConfig,
} from "./runtime-config";

type ConfigState =
  | { status: "loading" }
  | { status: "ready"; config: ConsoleAuthRuntimeConfig }
  | { status: "failed"; message: string };

const ConsolePrivyLogin = lazy(async () => {
  const module = await import("./PrivyConsoleLogin");
  return { default: module.ConsolePrivyLogin };
});

export function AuthApp() {
  const [configState, setConfigState] = useState<ConfigState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    loadRuntimeConfig(controller.signal)
      .then((config) => setConfigState({ status: "ready", config }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setConfigState({
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "Console authentication is temporarily unavailable.",
          });
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            FP
          </span>
          <span className="brand-copy">
            <strong>FanPass</strong>
            <span>Console</span>
          </span>
        </div>
        {configState.status === "loading" ? (
          <AuthStatus
            title="Preparing secure sign-in"
            message="Loading the Console authentication boundary."
          />
        ) : null}
        {configState.status === "failed" ? (
          <AuthStatus
            failed
            title="Console auth unavailable"
            message={configState.message}
          />
        ) : null}
        {configState.status === "ready" ? (
          <Suspense
            fallback={
              <AuthStatus
                title="Preparing Privy"
                message="Loading the isolated sign-in provider."
              />
            }
          >
            <ConsolePrivyLogin {...configState.config} />
          </Suspense>
        ) : null}
      </section>
    </main>
  );
}

function AuthStatus({
  title,
  message,
  failed = false,
}: {
  title: string;
  message: string;
  failed?: boolean;
}) {
  return (
    <div className={`auth-state ${failed ? "failed" : "loading"}`}>
      <p className="eyebrow">Protected workspace</p>
      <h1 id="auth-title">{title}</h1>
      <p>{message}</p>
    </div>
  );
}
