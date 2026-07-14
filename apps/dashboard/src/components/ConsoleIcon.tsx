export type ConsoleIconName =
  | "overview"
  | "events"
  | "sales"
  | "entry"
  | "team"
  | "risk"
  | "refresh"
  | "search"
  | "plus"
  | "menu"
  | "close"
  | "chevron";

export function ConsoleIcon({
  name,
  size = 18,
}: {
  name: ConsoleIconName;
  size?: number;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...common}
    >
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: ConsoleIconName) {
  switch (name) {
    case "overview":
      return (
        <>
          <rect height="7" rx="1" width="7" x="3" y="3" />
          <rect height="7" rx="1" width="7" x="14" y="3" />
          <rect height="7" rx="1" width="7" x="3" y="14" />
          <rect height="7" rx="1" width="7" x="14" y="14" />
        </>
      );
    case "events":
      return (
        <>
          <rect height="17" rx="2" width="18" x="3" y="4" />
          <path d="M8 2v4M16 2v4M3 9h18M8 13h2M14 13h2M8 17h2" />
        </>
      );
    case "sales":
      return <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />;
    case "entry":
      return (
        <>
          <path d="M5 3h10a2 2 0 0 1 2 2v14H5zM9 12h.01" />
          <path d="m14 9 3 3 4-4" />
        </>
      );
    case "team":
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" />
        </>
      );
    case "risk":
      return (
        <>
          <path d="M12 3 4 6v5c0 5 3.4 8.2 8 10 4.6-1.8 8-5 8-10V6z" />
          <path d="M12 8v5M12 17h.01" />
        </>
      );
    case "refresh":
      return (
        <path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12 2.5L20 15" />
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      );
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "menu":
      return <path d="M4 7h16M4 12h16M4 17h16" />;
    case "close":
      return <path d="m6 6 12 12M18 6 6 18" />;
    case "chevron":
      return <path d="m9 18 6-6-6-6" />;
  }
}
