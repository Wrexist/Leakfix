import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import { reportLeads } from "@/lib/db/schema";

import { listDueFollowUps, markLeadEmailed, unsubscribeByToken, upsertLead } from "./leads";
import { grantEntitlement, insertScan, updateScan } from "./repository";

const DAY = 24 * 60 * 60 * 1000;

async function scanFor(host: string) {
  const url = `https://${host}/`;
  const scan = await insertScan({ submittedUrl: url, normalizedUrl: url, kind: "website" });
  await updateScan(scan.id, { status: "completed", score: 60, finalUrl: url });
  return scan;
}

async function backdate(where: { id?: string; scanId?: string }, daysAgo: number) {
  const { db } = await getDb();
  await db
    .update(reportLeads)
    .set({ createdAt: new Date(Date.now() - daysAgo * DAY) })
    .where(where.id ? eq(reportLeads.id, where.id) : eq(reportLeads.scanId, where.scanId ?? ""));
}

async function dueEmails(): Promise<string[]> {
  return (await listDueFollowUps()).map((item) => item.lead.email);
}

describe("report leads", () => {
  it("normalizes email and only ever turns consent on through upsert", async () => {
    const scan = await scanFor("lead-upsert.test");
    const first = await upsertLead({
      scanId: scan.id,
      email: " Owner@Example.TEST ",
      ownerHash: null,
      marketingConsent: true,
    });
    expect(first.email).toBe("owner@example.test");

    const again = await upsertLead({
      scanId: scan.id,
      email: "owner@example.test",
      ownerHash: null,
      marketingConsent: false,
    });
    expect(again.id).toBe(first.id);
    expect(again.marketingConsent).toBe(true);
  });

  it("schedules follow-ups only for consenting, subscribed leads with a locked report", async () => {
    const consenting = await scanFor("lead-due.test");
    const noConsent = await scanFor("lead-no-consent.test");
    const bought = await scanFor("lead-bought.test");
    const fresh = await scanFor("lead-fresh.test");

    const due = await upsertLead({ scanId: consenting.id, email: "due@example.test", ownerHash: null, marketingConsent: true });
    const quiet = await upsertLead({ scanId: noConsent.id, email: "quiet@example.test", ownerHash: null, marketingConsent: false });
    const paid = await upsertLead({ scanId: bought.id, email: "paid@example.test", ownerHash: null, marketingConsent: true });
    await upsertLead({ scanId: fresh.id, email: "fresh@example.test", ownerHash: null, marketingConsent: true });
    await grantEntitlement({ scanId: bought.id, normalizedUrl: bought.normalizedUrl, provider: "dev" });
    for (const lead of [due, quiet, paid]) await backdate({ id: lead.id }, 3);

    const list = await listDueFollowUps();
    const emails = list.map((item) => item.lead.email);
    expect(emails).toContain("due@example.test");
    expect(emails).not.toContain("quiet@example.test");
    expect(emails).not.toContain("paid@example.test");
    expect(emails).not.toContain("fresh@example.test");
    expect(list.find((item) => item.lead.email === "due@example.test")?.step).toBe(1);

    // After the first follow-up, the second waits until day 6.
    await markLeadEmailed(due.id, 1);
    expect(await dueEmails()).not.toContain("due@example.test");
    await backdate({ id: due.id }, 7);
    const second = (await listDueFollowUps()).find((item) => item.lead.email === "due@example.test");
    expect(second?.step).toBe(2);
  });

  it("unsubscribes every lead for the address behind a token", async () => {
    const a = await scanFor("lead-unsub-a.test");
    const b = await scanFor("lead-unsub-b.test");
    const first = await upsertLead({ scanId: a.id, email: "leave@example.test", ownerHash: null, marketingConsent: true });
    await upsertLead({ scanId: b.id, email: "leave@example.test", ownerHash: null, marketingConsent: true });
    await backdate({ scanId: a.id }, 3);
    await backdate({ scanId: b.id }, 3);
    expect(await dueEmails()).toContain("leave@example.test");

    expect(await unsubscribeByToken(first.unsubscribeToken)).toBe(true);
    expect(await dueEmails()).not.toContain("leave@example.test");
    expect(await unsubscribeByToken("not-a-real-token-value")).toBe(false);
  });
});
