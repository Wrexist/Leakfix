"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  // Starts at 0 on the server and in the browser alike: `reduce` is only known in
  // the browser, so reduced motion jumps to the value in the effect instead.
  const count = useMotionValue(0);
  const display = useTransform(count, (latest) => `${Math.round(latest)}${suffix}`);

  useEffect(() => {
    if (reduce) {
      count.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(count, value, { duration: 1.1, ease: EASE });
    return () => controls.stop();
  }, [inView, value, reduce, count]);

  return (
    <motion.span ref={ref} className="tabular-nums">
      {display}
    </motion.span>
  );
}

export interface StatItem {
  value: number;
  suffix?: string;
  label: string;
  detail: string;
}

export function StatsBand({ stats }: { stats: StatItem[] }) {
  return (
    <section className="border-y border-line bg-ink text-white">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-y-8 px-5 py-10 sm:px-8 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: index * 0.07, ease: EASE }}
            className="px-2 text-center lg:px-6"
          >
            <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <Counter value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-1 text-sm font-medium text-white/90">{stat.label}</p>
            <p className="mt-1 text-xs text-white/50">{stat.detail}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
