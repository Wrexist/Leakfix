"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { scoreBucket, track } from "@/lib/analytics";
import type { BillingInfo } from "@/lib/billing/pricing";
import { recordRecentScan } from "@/lib/recent-scans";
import type { ScanDto } from "@/lib/scan/dto";
import type { ScanHistoryData } from "@/lib/scan/history";
import { isTerminalStatus } from "@/lib/scan/state";

import { ScanErrorState } from "./ScanErrorState";
import { ScanReport } from "./report/ScanReport";
import { ScanningPanel } from "./ScanningPanel";

const POLL_INTERVAL_MS = 1200;
/** After Stripe redirects back, wait this long for the webhook to grant access. */
const PAYMENT_POLL_INTERVAL_MS = 2000;
const PAYMENT_POLL_TIMEOUT_MS = 90_000;

type PaymentState = "idle" | "confirming" | "confirmed" | "delayed";
const EASE = [0.16, 1, 0.3, 1] as const;

export function ScanView({
  initialScan,
  history,
  monitored,
  billing,
  returnedFromCheckout = false,
}: {
  initialScan: ScanDto;
  history: ScanHistoryData;
  monitored: boolean;
  billing: BillingInfo;
  /** The page was opened from Stripe Checkout's success redirect (`?unlocked=1`). */
  returnedFromCheckout?: boolean;
}) {
  const [scan, setScan] = useState<ScanDto>(initialScan);
  const [payment, setPayment] = useState<PaymentState>(() =>
    !returnedFromCheckout ? "idle" : initialScan.unlocked ? "confirmed" : "confirming",
  );
  const reduce = useReducedMotion();

  // Returning from Stripe Checkout (`?unlocked=1`). The webhook may land a few
  // seconds after the redirect, so poll until the report is unlocked instead of
  // showing the paywall to someone who just paid.
  useEffect(() => {
    if (!returnedFromCheckout) return;

    // Drop `?unlocked=1` so a refresh or shared link doesn't replay the banner.
    const clearParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("unlocked");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    };

    if (initialScan.unlocked) {
      clearParam();
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const response = await fetch(`/api/scans/${initialScan.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as ScanDto;
        if (cancelled || !next.unlocked) return;
        setScan(next);
        setPayment("confirmed");
        track("report_unlocked", { via: "checkout" });
        clearParam();
        window.clearInterval(interval);
      } catch {
        // Transient network error; the next interval will retry.
      }
      if (!cancelled && Date.now() - startedAt > PAYMENT_POLL_TIMEOUT_MS) {
        setPayment("delayed");
        window.clearInterval(interval);
      }
    };

    const interval = window.setInterval(poll, PAYMENT_POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [returnedFromCheckout, initialScan.id, initialScan.unlocked]);

  useEffect(() => {
    if (isTerminalStatus(scan.status)) return;

    let cancelled = false;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const response = await fetch(`/api/scans/${scan.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const next = (await response.json()) as ScanDto;
        if (!cancelled) setScan(next);
      } catch {
        // Transient network error; the next interval will retry.
      }
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [scan.id, scan.status]);

  useEffect(() => {
    if (scan.status !== "completed") return;
    track("report_viewed", {
      kind: scan.kind,
      score: scoreBucket(scan.score),
      unlocked: scan.unlocked,
    });
    // Only once per report load, not on every unlock/poll update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.id, scan.status]);

  useEffect(() => {
    if (scan.status !== "completed") return;
    recordRecentScan({
      id: scan.id,
      url: scan.finalUrl ?? scan.normalizedUrl,
      score: scan.score,
    });
  }, [scan.id, scan.status, scan.score, scan.finalUrl, scan.normalizedUrl]);

  const view = scan.status === "failed" ? "failed" : scan.status === "completed" ? "report" : "scanning";

  return (
    <>
      {payment !== "idle" ? <PaymentBanner state={payment} /> : null}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          // Only `exit` may depend on `reduce`, since the server never applies it;
          // MotionConfig already makes the y instant for reduced motion.
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          {view === "failed" ? <ScanErrorState scan={scan} /> : null}
          {view === "report" ? (
            <ScanReport scan={scan} history={history} monitored={monitored} billing={billing} />
          ) : null}
          {view === "scanning" ? <ScanningPanel scan={scan} /> : null}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

const PAYMENT_COPY: Record<Exclude<PaymentState, "idle">, { title: string; body: string }> = {
  confirming: {
    title: "Confirming your payment…",
    body: "This usually takes a few seconds. The full report opens here automatically.",
  },
  confirmed: {
    title: "Payment confirmed — your full report is unlocked.",
    body: "Every fix, export, and monitoring for this site is now available.",
  },
  delayed: {
    title: "Your payment is still being confirmed.",
    body: "Some payment methods take longer. Refresh this page in a few minutes — you won't be charged twice.",
  },
};

function PaymentBanner({ state }: { state: Exclude<PaymentState, "idle"> }) {
  const copy = PAYMENT_COPY[state];
  const tone =
    state === "confirmed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-line bg-canvas text-ink";

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-8 sm:px-8 print:hidden">
      <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-2xl border p-4 ${tone}`}>
        {state === "confirming" ? (
          <span
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 animate-spin-slow rounded-full border-2 border-ink/20 border-t-ink"
          />
        ) : null}
        <div>
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-0.5 text-sm opacity-80">{copy.body}</p>
        </div>
      </div>
    </div>
  );
}
