import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a BASE-0 account to join local pickup games."
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
