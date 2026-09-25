import { NextResponse } from "next/server";

import { deleteSession } from "@/lib/auth/accounts";
import { clearSessionCookie, sessionTokenFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signs out: deletes the session and clears `lf_session`. The browser keeps its
 * `lf_owner` identity, so reports it can already see stay unlocked here.
 * Form posts are redirected home; fetch callers get JSON.
 */
export async function POST(request: Request) {
  await deleteSession(sessionTokenFromRequest(request));

  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  const response = wantsJson
    ? NextResponse.json({ signedOut: true })
    : new NextResponse(null, { status: 303, headers: { location: "/" } });
  clearSessionCookie(response);
  return response;
}
