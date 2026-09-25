import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLoginToken, getUserByEmail, hashToken } from "@/lib/auth/accounts";
import { SESSION_COOKIE, safeNextPath } from "@/lib/auth/session";
import { disposeDb, getDb } from "@/lib/db/client";
import { entitlements, loginTokens, monitors, sessions } from "@/lib/db/schema";
import { resetRateLimits } from "@/lib/rate-limit";
import { OWNER_COOKIE, createMonitorForOwner, newOwner, type MonitorOwner } from "@/lib/scan/monitor-owner";
import { getEntitlement, grantEntitlement, insertScan } from "@/lib/scan/repository";

import { POST as logout } from "./logout/route";
import { GET as me } from "./me/route";
import { POST as requestLink } from "./request/route";
import { GET as verifyLink, POST as confirmSignIn } from "./verify/route";

let sentEmails: string[] = [];

function stubEmail() {
  vi.stubEnv("EMAIL_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "LeakFix <signin@leakfix.test>");
  vi.stubEnv("EMAIL_API_URL", "https://email.test/send");
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    sentEmails.push(String(init?.body ?? ""));
    return new Response("{}", { status: 200 });
  });
}

function cookieHeader(values: Record<string, string | undefined>): Record<string, string> {
  const parts = Object.entries(values)
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${value}`);
  return parts.length > 0 ? { cookie: parts.join("; ") } : {};
}

async function ask(email: string, init: { owner?: MonitorOwner; next?: string; ip?: string } = {}) {
  return requestLink(
    new Request("http://localhost/api/auth/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": init.ip ?? "203.0.113.20",
        ...cookieHeader({ [OWNER_COOKIE]: init.owner?.id }),
      },
      body: JSON.stringify({ email, ...(init.next ? { next: init.next } : {}) }),
    }),
  );
}

/** The verify path+query from the most recent sign-in email. */
function lastLinkPath(): string {
  const body = JSON.parse(sentEmails.at(-1) ?? "{}") as { text?: string };
  const match = body.text?.match(/https?:\/\/\S+\/api\/auth\/verify\?\S+/);
  if (!match) throw new Error("no sign-in link in the last email");
  const url = new URL(match[0]);
  return `${url.pathname}${url.search}`;
}

/** Follows a sign-in link the way a browser does: open it, then press "Sign in". */
async function open(path: string, owner?: MonitorOwner, origin = "http://localhost") {
  const query = new URL(`http://localhost${path}`).searchParams;
  const form = new FormData();
  for (const [key, value] of query) form.set(key, value);
  return confirmSignIn(
    new Request("http://localhost/api/auth/verify", {
      method: "POST",
      headers: { "x-real-ip": "203.0.113.21", origin, ...cookieHeader({ [OWNER_COOKIE]: owner?.id }) },
      body: form,
    }),
  );
}

function setCookie(response: Response, name: string): string | null {
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    if (pair.slice(0, index) === name) return pair.slice(index + 1);
  }
  return null;
}

/** Full magic-link sign-in from one browser; returns the verify response. */
async function signIn(email: string, owner?: MonitorOwner) {
  expect((await ask(email, { owner })).status).toBe(200);
  return open(lastLinkPath(), owner);
}

async function paidScan(url: string, buyerHash: string) {
  const scan = await insertScan({ submittedUrl: url, normalizedUrl: url, kind: "website" });
  await grantEntitlement({ scanId: scan.id, normalizedUrl: url, provider: "dev", buyerHash });
  return scan;
}

async function monitorUrls(ownerHash: string): Promise<string[]> {
  const { db } = await getDb();
  const rows = await db
    .select({ url: monitors.normalizedUrl })
    .from(monitors)
    .where(eq(monitors.ownerHash, ownerHash));
  return rows.map((row) => row.url).sort();
}

beforeEach(() => {
  sentEmails = [];
  resetRateLimits();
  stubEmail();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await disposeDb();
});

describe("magic link sign-in", () => {
  it("returns 503 when email isn't configured", async () => {
    vi.stubEnv("EMAIL_API_KEY", "");
    expect((await ask("nobody@example.test")).status).toBe(503);
  });

  it("rejects an invalid address and answers the same for new and existing emails", async () => {
    expect((await ask("not-an-email")).status).toBe(400);

    const fresh = await ask("never-seen@example.test");
    await signIn("existing@example.test");
    const existing = await ask("existing@example.test");
    expect(await fresh.json()).toEqual({ sent: true });
    expect(await existing.json()).toEqual({ sent: true });
  });

  it("stores only a hash of the token and escapes the email", async () => {
    await ask("Hash.Me@Example.test", { next: "/pricing" });
    const token = new URL(`http://x${lastLinkPath()}`).searchParams.get("token")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const { db } = await getDb();
    const byHash = await db.select().from(loginTokens).where(eq(loginTokens.tokenHash, hashToken(token)));
    expect(byHash).toHaveLength(1);
    expect(byHash[0].email).toBe("hash.me@example.test");
    const byRaw = await db.select().from(loginTokens).where(eq(loginTokens.tokenHash, token));
    expect(byRaw).toHaveLength(0);

    const html = (JSON.parse(sentEmails[0]) as { html: string }).html;
    expect(html).toContain("&amp;next=%2Fpricing");
    expect(html).not.toContain("&next=");
  });

  it("creates the user and a session, and sets both cookies", async () => {
    const response = await signIn("new-user@example.test");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/account");

    const session = setCookie(response, SESSION_COOKIE);
    const owner = setCookie(response, OWNER_COOKIE);
    expect(session).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(owner).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const line = response.headers.getSetCookie().find((entry) => entry.startsWith(`${SESSION_COOKIE}=`))!;
    expect(line.toLowerCase()).toContain("httponly");
    expect(line.toLowerCase()).toContain("samesite=lax");

    const user = await getUserByEmail("new-user@example.test");
    expect(user?.ownerId).toBe(owner);

    const { db } = await getDb();
    const rows = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(session!)));
    expect(rows[0]?.userId).toBe(user?.id);

    const whoami = await me(new Request("http://localhost/api/auth/me", { headers: cookieHeader({ [SESSION_COOKIE]: session! }) }));
    expect((await whoami.json()).user).toEqual({ email: "new-user@example.test", pro: false });
  });

  it("rejects a reused link", async () => {
    await ask("reuse@example.test");
    const path = lastLinkPath();
    expect((await open(path)).headers.get("location")).toBe("/account");

    const again = await open(path);
    expect(again.headers.get("location")).toBe("/login?error=expired");
    expect(setCookie(again, SESSION_COOKIE)).toBeNull();
  });

  it("never signs in on a plain GET, so link scanners can't use up the token", async () => {
    await ask("scanned@example.test");
    const path = lastLinkPath();

    const prefetch = await verifyLink(new Request(`http://localhost${path}`));
    expect(prefetch.headers.get("location")).toMatch(/^\/login\/confirm\?token=/);
    expect(setCookie(prefetch, SESSION_COOKIE)).toBeNull();

    // The real click still works afterwards.
    expect(setCookie(await open(path), SESSION_COOKIE)).toBeTruthy();
  });

  it("refuses sign-in posts from other sites (login CSRF)", async () => {
    await ask("csrf@example.test");
    const crossSite = await open(lastLinkPath(), undefined, "https://evil.test");
    expect(crossSite.headers.get("location")).toBe("/login?error=expired");
    expect(setCookie(crossSite, SESSION_COOKIE)).toBeNull();
  });

  it("rejects an expired or unknown link", async () => {
    const token = await createLoginToken("late@example.test", null, new Date(Date.now() - 16 * 60_000));
    const expired = await open(`/api/auth/verify?token=${token}`);
    expect(expired.headers.get("location")).toBe("/login?error=expired");
    expect(await getUserByEmail("late@example.test")).toBeNull();

    const unknown = await open(`/api/auth/verify?token=${"x".repeat(43)}`);
    expect(unknown.headers.get("location")).toBe("/login?error=expired");
  });

  it("follows a safe next path and ignores unsafe ones", async () => {
    await ask("next@example.test", { next: "/pricing" });
    expect((await open(lastLinkPath())).headers.get("location")).toBe("/pricing");

    for (const unsafe of ["//evil.test", "https://evil.test/", "/\\evil.test"]) {
      const token = await createLoginToken("next@example.test", null);
      const response = await open(`/api/auth/verify?token=${token}&next=${encodeURIComponent(unsafe)}`);
      expect(response.headers.get("location")).toBe("/account");
    }
    expect(safeNextPath("/scan/abc?x=1")).toBe("/scan/abc?x=1");
    expect(safeNextPath("//evil.test")).toBe("/account");
  });

  it("signs out by deleting the session and keeps the browser identity", async () => {
    const response = await signIn("logout@example.test");
    const session = setCookie(response, SESSION_COOKIE)!;
    const owner = setCookie(response, OWNER_COOKIE)!;

    const out = await logout(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: cookieHeader({ [SESSION_COOKIE]: session, [OWNER_COOKIE]: owner }),
      }),
    );
    expect(out.status).toBe(303);
    expect(setCookie(out, SESSION_COOKIE)).toBe("");
    expect(setCookie(out, OWNER_COOKIE)).toBeNull();

    const whoami = await me(new Request("http://localhost/api/auth/me", { headers: cookieHeader({ [SESSION_COOKIE]: session }) }));
    expect((await whoami.json()).user).toBeNull();
  });

  it("rate limits sign-in emails per address", async () => {
    for (let index = 0; index < 3; index += 1) {
      expect((await ask("limited@example.test", { ip: `198.51.100.${index}` })).status).toBe(200);
    }
    expect((await ask("limited@example.test", { ip: "198.51.100.9" })).status).toBe(429);
  });
});

describe("identity adoption and merge", () => {
  it("adopts the browser identity on first sign-in, then merges another browser into it", async () => {
    const email = "merge@example.test";

    // Browser A buys a report and monitors a site, then signs in.
    const browserA = newOwner();
    const paidByA = await paidScan("https://merge-a.test/", browserA.hash);
    await createMonitorForOwner({ ownerHash: browserA.hash, normalizedUrl: "https://shared.test/", kind: "website" });

    const first = await signIn(email, browserA);
    expect(setCookie(first, OWNER_COOKIE)).toBe(browserA.id);
    expect((await getUserByEmail(email))?.ownerHash).toBe(browserA.hash);
    expect((await getEntitlement(paidByA.id))?.buyerHash).toBe(browserA.hash);

    // Browser B has its own purchase and monitors, one for the same URL.
    const browserB = newOwner();
    const paidByB = await paidScan("https://merge-b.test/", browserB.hash);
    await createMonitorForOwner({ ownerHash: browserB.hash, normalizedUrl: "https://shared.test/", kind: "website" });
    await createMonitorForOwner({ ownerHash: browserB.hash, normalizedUrl: "https://only-b.test/", kind: "website" });

    const second = await signIn(email, browserB);
    expect(second.status).toBe(303);
    // B now carries the account identity...
    expect(setCookie(second, OWNER_COOKIE)).toBe(browserA.id);
    // ...and everything B owned moved to it, without a duplicate monitor.
    expect((await getEntitlement(paidByB.id))?.buyerHash).toBe(browserA.hash);
    expect(await monitorUrls(browserA.hash)).toEqual(["https://only-b.test/", "https://shared.test/"]);
    expect(await monitorUrls(browserB.hash)).toEqual([]);
  });

  it("gives a browser with no identity the account identity", async () => {
    const email = "fresh-device@example.test";
    const home = newOwner();
    await signIn(email, home);

    const phone = await signIn(email);
    expect(setCookie(phone, OWNER_COOKIE)).toBe(home.id);
  });

  it("does not merge a browser that didn't ask for the link", async () => {
    const email = "victim-safe@example.test";
    await signIn(email, newOwner());

    // Someone else's browser opens a link requested elsewhere.
    const bystander = newOwner();
    const theirs = await paidScan("https://bystander.test/", bystander.hash);
    await ask(email);
    const response = await open(lastLinkPath(), bystander);

    expect(response.status).toBe(303);
    expect((await getEntitlement(theirs.id))?.buyerHash).toBe(bystander.hash);
  });

  it("never merges an identity that belongs to another account", async () => {
    const first = newOwner();
    await signIn("first@example.test", first);
    await paidScan("https://first-account.test/", first.hash);

    // "first" signs out; "second" signs in on the same browser.
    const response = await signIn("second@example.test", first);
    const second = await getUserByEmail("second@example.test");
    expect(second?.ownerHash).not.toBe(first.hash);
    expect(setCookie(response, OWNER_COOKIE)).toBe(second?.ownerId);

    const { db } = await getDb();
    const stillFirst = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.normalizedUrl, "https://first-account.test/"), eq(entitlements.buyerHash, first.hash)));
    expect(stillFirst).toHaveLength(1);
  });
});
