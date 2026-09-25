import { NextResponse } from "next/server";

import { unsubscribeByToken } from "@/lib/scan/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (RFC 8058 `List-Unsubscribe-Post`) and the target of
 * the form on /unsubscribe. POST only, so link scanners can't unsubscribe people.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = String(form?.get("token") ?? "");
  }

  const ok = await unsubscribeByToken(token);
  const fromForm = (request.headers.get("content-type") ?? "").includes("form") && !url.searchParams.get("token");
  if (fromForm) {
    return NextResponse.redirect(new URL(`/unsubscribe?done=${ok ? "1" : "0"}`, url), 303);
  }
  return NextResponse.json({ unsubscribed: ok }, { status: ok ? 200 : 404 });
}
