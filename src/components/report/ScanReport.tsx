import Link from "next/link";

import type { BillingInfo } from "@/lib/billing/pricing";
import { hostnameOf } from "@/lib/format";
import type { ScanDto } from "@/lib/scan/dto";
import type { ScanHistoryData } from "@/lib/scan/history";

import { AppReport } from "./AppReport";
import { ActionPlan } from "./ActionPlan";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { FindingList } from "./FindingList";
import { MethodologyNote } from "./MethodologyNote";
import { MonitorPanel } from "./MonitorPanel";
import { PassedChecks } from "./PassedChecks";
import { ReportHero } from "./ReportHero";
import { ScanHistory } from "./ScanHistory";
import { SeoSnapshot } from "./SeoSnapshot";
import { Suggestions } from "./Suggestions";

export function ScanReport({
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
  if (scan.kind !== "website") {
    return <AppReport scan={scan} history={history} monitored={monitored} billing={billing} />;
  }

  const analyzedUrl = scan.finalUrl ?? scan.normalizedUrl;
  const host = hostnameOf(analyzedUrl);
  const score = scan.score ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <ReportHero scan={scan} host={host} analyzedUrl={analyzedUrl} score={score} />
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
      <SeoSnapshot seo={scan.insights?.seo ?? null} />
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
          Scan another website
        </Link>
        <p className="text-sm text-ink-faint">
          Fix the “Fix first” findings, then re-scan to confirm the score improves.
        </p>
      </div>
    </div>
  );
}
