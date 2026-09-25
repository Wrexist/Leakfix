"use client";

import Link from "next/link";

import { useSession } from "./useAccount";

/**
 * "Sign in" or "Account" in the header. Resolved on the client so the header
 * doesn't make every page dynamic; nothing renders until it is known.
 */
export function AccountNavLink({ className }: { className?: string }) {
  const session = useSession();
  if (session === undefined) return null;
  return session.user ? (
    <Link href="/account" className={className}>
      Account
    </Link>
  ) : (
    <Link href="/login" className={className}>
      Sign in
    </Link>
  );
}
