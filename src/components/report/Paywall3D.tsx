"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";

interface Paywall3DProps {
  scanId: string;
  price: string;
  lockedCount: number;
  lockedSuggestionCount?: number;
  paymentsReady: boolean;
  devUnlock: boolean;
  /** "$29.00/mo" when Pro can be bought; the cross-sell is hidden otherwise. */
  proPrice?: string | null;
  className?: string;
}

const FEATURES = [
  "Every finding, fully explained",
  "Step-by-step fixes with copy-paste code",
  "How to verify each fix actually worked",
  "SEO improvement suggestions",
  "CSV, Markdown and PDF export",
  "Monitoring, alerts and weekly digests",
];

export function Paywall3D({
  scanId,
  price,
  lockedCount,
  lockedSuggestionCount = 0,
  paymentsReady,
  devUnlock,
  proPrice = null,
  className,
}: Paywall3DProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const rotateX = useSpring(0, { stiffness: 150, damping: 20 });
  const rotateY = useSpring(0, { stiffness: 150, damping: 20 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(0);
  const glowXPercent = useTransform(glowX, (value) => `${value}%`);
  const glowYPercent = useTransform(glowY, (value) => `${value}%`);
  const glow = useTransform(
    [glowXPercent, glowYPercent],
    ([x, y]: (string | number)[]) =>
      `radial-gradient(420px circle at ${x} ${y}, rgba(47,91,255,0.35), transparent 60%)`,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canBuy = paymentsReady || devUnlock;

  // Count a paywall view once, when the card actually scrolls into view.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          track("paywall_viewed", { lockedFixes: lockedCount, paymentsReady });
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lockedCount, paymentsReady]);

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 16);
    rotateX.set(-py * 14);
    glowX.set(((event.clientX - rect.left) / rect.width) * 100);
    glowY.set(((event.clientY - rect.top) / rect.height) * 100);
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  async function unlock() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/scans/${scanId}/unlock`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; unlocked?: boolean; error?: { message?: string } }
        | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "We couldn't start checkout. Please try again.");
        setBusy(false);
        return;
      }
      if (payload?.checkoutUrl) {
        track("checkout_started", { lockedFixes: lockedCount });
        window.location.href = payload.checkoutUrl;
        return;
      }
      if (payload?.unlocked) {
        track("report_unlocked", { via: "direct" });
        setDone(true);
        router.refresh();
        setBusy(false);
        return;
      }
      setBusy(false);
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      id="unlock"
      className={`scroll-mt-24 ${className ?? ""}`}
      style={{ perspective: reduce ? undefined : "1400px" }}
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative overflow-hidden rounded-3xl border border-ink/10 bg-ink p-6 text-white shadow-2xl shadow-ink/20 sm:p-9"
      >
        {!reduce ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: glow }}
          />
        ) : null}

        <div className="relative sm:flex sm:items-start sm:justify-between sm:gap-10">
          <div style={reduce ? undefined : { transform: "translateZ(40px)" }} className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              Free preview ·{" "}
              {lockedCount > 0
                ? `${lockedCount} ${lockedCount === 1 ? "fix" : "fixes"} locked`
                : `${lockedSuggestionCount} ${lockedSuggestionCount === 1 ? "suggestion" : "suggestions"} locked`}
            </p>

            <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              Unlock every fix for this report
            </h3>
            <p className="mt-3 leading-relaxed text-white/70">
              You can see what&apos;s wrong. Unlock the exact, step-by-step fixes — with copy-paste
              code, verification steps, and the full SEO action plan.
            </p>

            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-white/85">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/20 text-brand">
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={reduce ? undefined : { transform: "translateZ(70px)" }}
            className="mt-8 shrink-0 sm:mt-0 sm:w-64"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm text-white/60">One-time payment</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight">{price}</p>
              <p className="mt-1 text-xs text-white/50">
                No subscription. Unlocks this report (shareable by link) and your future scans of
                this site.
              </p>

              <button
                type="button"
                onClick={unlock}
                disabled={busy || done || !canBuy}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {done ? (
                  "Unlocked"
                ) : busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-ink/20 border-t-ink" />
                    Starting…
                  </>
                ) : devUnlock && !paymentsReady ? (
                  "Unlock full report (dev)"
                ) : (
                  `Unlock full report`
                )}
              </button>

              {!canBuy ? (
                <p className="mt-3 text-xs text-white/50">
                  Checkout opens soon. Your free preview above stays available.
                </p>
              ) : (
                <p className="mt-3 text-xs text-white/50">
                  Secure checkout by Stripe. Instant access. 14-day money-back guarantee.
                </p>
              )}

              {paymentsReady && proPrice ? (
                <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/60">
                  Fixing several sites?{" "}
                  <Link href="/pricing" className="font-semibold text-white underline-offset-4 hover:underline">
                    Pro unlocks every report — {proPrice}
                  </Link>
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="mt-3 text-xs font-medium text-red-300">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
