"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { DEMO_MODE } from "@/lib/demo";
import { SCAN_KINDS, SCAN_KIND_EXAMPLE, SCAN_KIND_LABEL, type ScanKind } from "@/lib/scan/types";

import { ScanForm } from "./ScanForm";

const EASE = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const RISK_FACTS = ["Free scan, no account", "Read-only", "Results in seconds"];

function AnimatedBackdrop() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(11,15,25,0.05) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(circle at 50% 0%, black, transparent 72%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 0%, black, transparent 72%)",
        }}
      />
      <motion.div
        className="absolute -top-48 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(47,91,255,0.16), transparent 62%)" }}
        animate={reduce ? undefined : { x: [0, 44, 0], y: [0, 26, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 right-[-8rem] h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(15,122,86,0.12), transparent 62%)" }}
        animate={reduce ? undefined : { x: [0, -34, 0], y: [0, -20, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function Hero({ checksCount }: { checksCount: number }) {
  const [kind, setKind] = useState<ScanKind>("website");

  return (
    <section id="scan" className="relative scroll-mt-20 overflow-hidden">
      <AnimatedBackdrop />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-3xl px-5 pt-20 pb-16 text-center sm:px-8 sm:pt-24 sm:pb-20"
      >
        <motion.p
          variants={item}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-brand backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
          Websites, iPhone &amp; Android apps · {checksCount} checks
        </motion.p>

        <motion.h1
          variants={item}
          className="mt-5 text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-6xl"
        >
          Your website is leaking customers.
        </motion.h1>

        <motion.p
          variants={item}
          className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl"
        >
          Find the problems costing you conversions — and see exactly how to fix them. The scan
          takes seconds and is free.
        </motion.p>

        <motion.div variants={item} className="mx-auto mt-9 max-w-xl">
          <div
            role="group"
            aria-label="Choose what to review"
            className="mx-auto mb-3 inline-flex rounded-xl border border-line bg-white/80 p-1 backdrop-blur"
          >
            {SCAN_KINDS.map((option) => {
              const active = kind === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(option)}
                  className="relative rounded-lg px-3 py-1.5 text-sm font-semibold sm:px-4"
                >
                  {active ? (
                    <motion.span
                      layoutId="target-kind-pill"
                      className="absolute inset-0 rounded-lg bg-ink"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  ) : null}
                  <span className={`relative z-10 ${active ? "text-white" : "text-ink-soft"}`}>
                    {SCAN_KIND_LABEL[option]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-left">
            <ScanForm
              // The demo prefills a sample for the chosen target; remount to switch it.
              key={DEMO_MODE ? kind : undefined}
              kind={kind}
              placeholder={SCAN_KIND_EXAMPLE[kind]}
              example={SCAN_KIND_EXAMPLE[kind]}
            />
          </div>
        </motion.div>

        <motion.ul
          variants={item}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-faint"
        >
          {RISK_FACTS.map((fact) => (
            <li key={fact} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line-strong" />
              {fact}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
