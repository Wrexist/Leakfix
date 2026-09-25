"use client";

import { useEffect, useState } from "react";

export interface AccountSummary {
  email: string;
  pro: boolean;
}

export interface SessionInfo {
  /** null when signed out. */
  user: AccountSummary | null;
  /** Whether the Pro subscription can be bought right now (runtime config). */
  proAvailable: boolean;
}

let pending: Promise<SessionInfo> | null = null;

/** One `/api/auth/me` request per page load, shared by every caller. */
function loadSession(): Promise<SessionInfo> {
  if (!pending) {
    pending = fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Partial<SessionInfo> | null) => ({
        user: body?.user ?? null,
        proAvailable: body?.proAvailable === true,
      }))
      .catch(() => ({ user: null, proAvailable: false }));
    // Let a later mount (after signing in or out) ask again.
    pending.finally(() => {
      setTimeout(() => {
        pending = null;
      }, 0);
    });
  }
  return pending;
}

/**
 * The signed-in account, read on the client so static pages (pricing, checks)
 * stay static. Only the email and whether Pro is active are exposed.
 * Returns undefined while loading.
 */
export function useSession(): SessionInfo | undefined {
  const [session, setSession] = useState<SessionInfo | undefined>(undefined);
  useEffect(() => {
    let active = true;
    loadSession().then((value) => {
      if (active) setSession(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return session;
}
