"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Only login/signup use next-auth/react (signIn). Wrapping the whole app broke
 * production RSC for `/` (plain 500). Scoped provider keeps those routes working.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
