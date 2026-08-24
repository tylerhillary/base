import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Updates",
  description: "Votes, roster changes, waitlist promotions and confirmations."
};

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return children;
}
