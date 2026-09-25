import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ScanView } from "@/components/ScanView";
import { devUnlockEnabled, formatPrice, paymentsConfigured } from "@/lib/billing/pricing";
import { hostnameOf } from "@/lib/format";
import { toScanDto } from "@/lib/scan/dto";
import { loadScanHistory } from "@/lib/scan/history";
import {
  getMonitorForOwnerByUrl,
  OWNER_COOKIE,
  ownerFromCookieValue,
} from "@/lib/scan/monitor-owner";
import {
  getFindingsForScan,
  getScanById,
  isScanUnlocked,
} from "@/lib/scan/repository";

export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPORT_ROBOTS: Metadata["robots"] = { index: false, follow: false };

/** Shareable title/description only: host and score, never finding details. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = { title: "Scan report", robots: REPORT_ROBOTS };
  if (!ID_PATTERN.test(id)) return fallback;

  const scan = await getScanById(id).catch(() => null);
  if (!scan) return fallback;

  const name =
    scan.kind !== "website" && scan.subject?.name
      ? scan.subject.name
      : hostnameOf(scan.finalUrl ?? scan.normalizedUrl);

  if (scan.status !== "completed" || scan.score == null) {
    return { ...fallback, title: `Scan report for ${name}` };
  }

  const title = `${name} scored ${scan.score}/100`;
  const description = `LeakFix audit of ${name}: a score of ${scan.score}/100. Run a free scan of your own site to see every issue and the top fix.`;
  return {
    title,
    description,
    robots: REPORT_ROBOTS,
    openGraph: { title, description, type: "website", siteName: "LeakFix" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ unlocked?: string | string[] }>;
}) {
  const { id } = await params;
  const { unlocked: unlockedParam } = await searchParams;

  if (!ID_PATTERN.test(id)) {
    notFound();
  }

  const scan = await getScanById(id);
  if (!scan) {
    notFound();
  }

  const findings = await getFindingsForScan(id);
  const owner = ownerFromCookieValue((await cookies()).get(OWNER_COOKIE)?.value);
  const [history, monitor, unlocked] = await Promise.all([
    loadScanHistory(scan),
    // Only this browser's monitors count; other people's monitors stay private.
    owner ? getMonitorForOwnerByUrl(scan.normalizedUrl, owner.hash) : Promise.resolve(null),
    isScanUnlocked(scan),
  ]);

  return (
    <ScanView
      key={unlocked ? "unlocked" : "locked"}
      initialScan={toScanDto(scan, findings, { unlocked })}
      history={history}
      monitored={monitor !== null}
      billing={{
        price: formatPrice(),
        paymentsReady: paymentsConfigured(),
        devUnlock: devUnlockEnabled(),
      }}
      returnedFromCheckout={unlockedParam === "1"}
    />
  );
}
