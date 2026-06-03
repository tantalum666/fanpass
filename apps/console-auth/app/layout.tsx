import "./styles.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FanPass Console Auth",
  description: "Privy login boundary for FanPass Console sessions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
