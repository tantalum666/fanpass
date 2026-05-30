import "./styles.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FanPass Console",
  description: "Organizer and admin workspace for FanPass Alpha operations"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
