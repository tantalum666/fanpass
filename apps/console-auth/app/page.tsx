import { ConsolePrivyLogin } from "./privy-console-login";

export default function ConsoleAuthPage() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  const sessionBridgeUrl =
    process.env.NEXT_PUBLIC_FANPASS_CONSOLE_SESSION_BRIDGE_URL ??
    "http://localhost:3000/api/console/privy-session";
  const consoleUrl =
    process.env.NEXT_PUBLIC_FANPASS_CONSOLE_URL ?? "http://localhost:3000";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand">
          <strong>FanPass Console</strong>
          <span>Privy organizer/admin sign-in</span>
        </div>
        <ConsolePrivyLogin
          appId={appId}
          sessionBridgeUrl={sessionBridgeUrl}
          consoleUrl={consoleUrl}
        />
      </section>
    </main>
  );
}
