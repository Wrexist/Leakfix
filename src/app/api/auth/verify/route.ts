import { NextResponse } from "next/server";

import {
  adoptBrowserIdentity,
  consumeLoginToken,
  createSession,
  findOrCreateUser,
} from "@/lib/auth/accounts";
import { safeNextPath, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { ownerFromRequest, setOwnerCookie } from "@/lib/scan/monitor-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A same-origin redirect; a relative Location keeps it on whatever host served the request. */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { location: path, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

/**
 * The link in the sign-in email. It does NOT sign in: email security scanners
 * (Outlook Safe Links, corporate filters) open links before the person does,
 * which would use up a single-use token. It forwards to a confirm page whose
 * button POSTs back here.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = new URLSearchParams();
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next");
  if (token) query.set("token", token);
  if (next) query.set("next", next);
  return redirectTo(`/login/confirm?${query.toString()}`);
}

/**
 * Only same-origin form posts may sign in. Without this, another site could
 * auto-submit its own valid token and silently sign a visitor into the
 * attacker's account ("login CSRF"), capturing whatever they buy next.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients; browsers always send Origin on POST.
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // Compare with the host the browser addressed (the proxy's forwarded host when
  // present); `request.url` can be normalized to a different internal host.
  const allowed = new Set(
    [request.headers.get("x-forwarded-host"), request.headers.get("host"), new URL(request.url).host].filter(
      (value): value is string => Boolean(value),
    ),
  );
  if (process.env.NEXT_PUBLIC_SITE_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
  return allowed.has(originHost);
}

/**
 * Confirms the magic link. Signs the browser in, then gives it the account's
 * browser identity (`lf_owner`) — adopting or merging this browser's anonymous
 * purchases and monitors first — so every existing ownership check sees the
 * account's rows on any device.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return redirectTo("/login?error=expired");

  const limit = checkRateLimit(`auth-verify:ip:${clientIp(request)}`, 20, 10 * 60_000);
  if (!limit.allowed) return redirectTo("/login?error=expired");

  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  const next = form?.get("next");

  const login = await consumeLoginToken(typeof token === "string" ? token : null);
  if (!login) return redirectTo("/login?error=expired");

  const user = await findOrCreateUser(login.email);
  const identity = await adoptBrowserIdentity(user, ownerFromRequest(request), login.requesterHash);
  const sessionToken = await createSession(user.id);

  const response = redirectTo(safeNextPath(typeof next === "string" ? next : null));
  setSessionCookie(response, sessionToken);
  setOwnerCookie(response, identity);
  return response;
}
