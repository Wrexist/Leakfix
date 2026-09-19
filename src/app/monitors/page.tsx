import type { Metadata } from "next";
import Link from "next/link";

import { MonitorForm } from "@/components/monitors/MonitorForm";
import { MonitorNotifyForm } from "@/components/monitors/MonitorNotifyForm";
import { MonitorRowActions } from "@/components/monitors/MonitorRowActions";
import { ScoreTrend, type TrendPoint } from "@/components/report/ScoreTrend";
import { emailConfigured } from "@/lib/scan/email";
import { monitorLabel, toMonitorDto } from "@/lib/scan/monitors";
import { isDigestFrequency } from "@/lib/scan/digest-policy";
import { isNotifyPolicy } from "@/lib/scan/notify-policy";
import {
  getNotificationsForMonitor,
  getScansForUrl,
  listMonitors,
} from "@/lib/scan/repository";
import { SCAN_KIND_LABEL } from "@/lib/scan/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monitors",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default async function MonitorsPage() {
  const rows = await listMonitors();
  const emailEnabled = emailConfigured();

  const monitors = await Promise.all(
    rows.map(async (row) => {
      const scans = (await getScansForUrl(row.normalizedUrl, 12)).slice().reverse();
      const trend: TrendPoint[] = scans.map((scan) => ({
        score: scan.score,
        label: scan.createdAt.toISOString(),
      }));
      const ids = scans.map((scan) => scan.id);
      const notifications = await getNotificationsForMonitor(row.id, 5);
      return {
        dto: toMonitorDto(row),
        label: monitorLabel(row),
        trend,
        ids,
        notifications,
      };
    }),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm font-semibold tracking-wide text-brand">Monitoring</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Track your targets over time
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Add a target and LeakFix will re-scan it on a schedule, remember every result, and show you the
        score trend. Use “Scan now” any time to check it immediately.
      </p>

      <div className="mt-8 max-w-2xl">
        <MonitorForm />
      </div>

      {monitors.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-white p-6">
          <p className="font-medium text-ink">No monitors yet.</p>
          <p className="mt-2 text-ink-soft">
            Add a website or store listing above, or open any report and choose “Monitor this target”.
          </p>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {monitors.map(({ dto, label, trend, ids, notifications }) => {
            const latest = trend.length > 0 ? trend[trend.length - 1] : null;
            const previous = trend.length > 1 ? trend[trend.length - 2] : null;
            const delta =
              latest?.score != null && previous?.score != null
                ? latest.score - previous.score
                : null;
            const compareHref =
              ids.length >= 2 ? `/compare?a=${ids[ids.length - 2]}&b=${ids[ids.length - 1]}` : null;
            const policy = isNotifyPolicy(dto.notifyPolicy) ? dto.notifyPolicy : "drop";
            const digestFrequency = isDigestFrequency(dto.digestFrequency)
              ? dto.digestFrequency
              : "off";
            const channels = [
              dto.notifyWebhookUrl ? "webhook" : null,
              dto.notifyEmail ? "email" : null,
            ]
              .filter(Boolean)
              .join(" + ");

            return (
              <li key={dto.id} className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-ink">{label}</h2>
                      <span className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                        {SCAN_KIND_LABEL[dto.kind]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-faint">{dto.normalizedUrl}</p>
                    <p className="mt-2 text-sm text-ink-soft">
                      {Math.max(dto.scanCount, trend.length)}{" "}
                      {Math.max(dto.scanCount, trend.length) === 1 ? "scan" : "scans"} · last
                      scanned {formatDate(dto.lastScannedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-3xl font-semibold tabular-nums text-ink">
                        {latest?.score ?? "—"}
                        <span className="text-base text-ink-faint">/100</span>
                      </p>
                      {delta != null ? (
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            delta > 0 ? "text-positive" : delta < 0 ? "text-red-600" : "text-ink-faint"
                          }`}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta} pts
                        </p>
                      ) : null}
                    </div>
                    {trend.length >= 2 ? (
                      <ScoreTrend points={trend} width={140} height={44} className="hidden sm:block" />
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {dto.lastScanId ? (
                      <Link
                        href={`/scan/${dto.lastScanId}`}
                        className="text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
                      >
                        View latest report
                      </Link>
                    ) : null}
                    {compareHref ? (
                      <Link
                        href={compareHref}
                        className="text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                      >
                        Compare latest
                      </Link>
                    ) : null}
                  </div>
                  <MonitorRowActions id={dto.id} />
                </div>

                <details className="mt-4 border-t border-line pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-ink-soft">
                    Notifications
                    {channels ? (
                      <span className="ml-2 text-ink-faint">
                        {channels} · {policy === "drop" ? "on drop" : policy === "change" ? "on change" : "every scan"}
                        {digestFrequency !== "off" ? ` · ${digestFrequency} digest` : ""}
                      </span>
                    ) : (
                      <span className="ml-2 text-ink-faint">not configured</span>
                    )}
                  </summary>

                  <MonitorNotifyForm
                    id={dto.id}
                    webhookUrl={dto.notifyWebhookUrl}
                    email={dto.notifyEmail}
                    policy={policy}
                    digestFrequency={digestFrequency}
                    emailEnabled={emailEnabled}
                  />

                  {notifications.length > 0 ? (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        Recent notifications
                      </h3>
                      <ul className="mt-2 space-y-1.5">
                        {notifications.map((entry) => (
                          <li key={entry.id} className="text-xs text-ink-faint">
                            {formatDate(entry.createdAt.toISOString())} · {entry.channel} ·{" "}
                            <span
                              className={
                                entry.status === "sent"
                                  ? "text-positive"
                                  : entry.status === "failed"
                                    ? "text-red-600"
                                    : ""
                              }
                            >
                              {entry.status}
                            </span>{" "}
                            · {entry.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
