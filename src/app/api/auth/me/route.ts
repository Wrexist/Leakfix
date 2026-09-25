import { NextResponse } from "next/server";

import { isProActive } from "@/lib/auth/pro";
import { userFromRequest } from "@/lib/auth/session";
import { proConfigured } from "@/lib/billing/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who is signed in, for client components on otherwise static pages (the
 * header, the pricing page). Never cached.
 */
export async function GET(request: Request) {
  const user = await userFromRequest(request);
  return NextResponse.json(
    {
      user: user ? { email: user.email, pro: isProActive(user) } : null,
      proAvailable: proConfigured(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
