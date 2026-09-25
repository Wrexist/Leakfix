import Link from "next/link";

import type { BillingInfo } from "@/lib/billing/pricing";
import type { ScanDto } from "@/lib/scan/dto";
import type { ScanHistoryData } from "@/lib/scan/history";

import { ActionPlan } from "./ActionPlan";
import { AppHero } from "./AppHero";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { FindingList } from "./FindingList";
import { MethodologyNote } from "./MethodologyNote";
import { MonitorPanel } from "./MonitorPanel";
import { PassedChecks } from "./PassedChecks";
import { ScanHistory } from "./ScanHistory";
import { Suggestions } from "./Suggestions";

export function AppReport({
  scan,
  history,
  monitored,
  billing,
}: {
  scan: ScanDto;
  history: ScanHistoryData;
  monitored: boolean;
  billing: BillingInfo;
}) {
  const score = scan.score ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <AppHero scan={scan} score={score} />
      <ExecutiveSummary scan={scan} />
      <ScanHistory history={history} currentId={scan.id} />
      <MonitorPanel
        url={scan.normalizedUrl}
        initiallyMonitored={monitored}
        locked={!scan.unlocked}
      />
      <ActionPlan findings={scan.findings} />
      <FindingList
        findings={scan.findings}
        locked={!scan.unlocked}
        lockedSuggestionCount={scan.lockedSuggestionCount}
        scanId={scan.id}
        price={billing.price}
        paymentsReady={billing.paymentsReady}
        devUnlock={billing.devUnlock}
      />
      <Suggestions
        suggestions={scan.insights?.suggestions ?? []}
        locked={!scan.unlocked}
        lockedCount={scan.lockedSuggestionCount}
      />
      <PassedChecks summary={scan.auditSummary} />
      <CategoryBreakdown findings={scan.findings} />
      <MethodologyNote />

      <div className="mt-14 flex flex-wrap items-center gap-4 border-t border-line pt-8 print:hidden">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          Review another listing
        </Link>
        <p className="text-sm text-ink-faint">
          Fix the “Fix first” findings, then re-scan to confirm the score improves.
        </p>
      </div>
    </div>
  );
}
