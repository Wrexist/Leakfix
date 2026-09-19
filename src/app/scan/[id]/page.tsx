import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScanView } from "@/components/ScanView";
import { devUnlockEnabled, formatPrice, paymentsConfigured } from "@/lib/billing/pricing";
import { toScanDto } from "@/lib/scan/dto";
import { loadScanHistory } from "@/lib/scan/history";
import {
  getFindingsForScan,
  getMonitorByUrl,
  getScanById,
  hasEntitlement,
  hasEntitlementForUrl,
} from "@/lib/scan/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scan report",
  robots: { index: false, follow: false },
};

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!ID_PATTERN.test(id)) {
    notFound();
  }

  const scan = await getScanById(id);
  if (!scan) {
    notFound();
  }

  const findings = await getFindingsForScan(id);
  const [history, monitor, unlockedForScan, unlockedForUrl] = await Promise.all([
    loadScanHistory(scan),
    getMonitorByUrl(scan.normalizedUrl),
    hasEntitlement(id),
    hasEntitlementForUrl(scan.normalizedUrl),
  ]);
  const unlocked = unlockedForScan || unlockedForUrl;

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
    />
  );
}
