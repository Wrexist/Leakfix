"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";

import { scoreBand, type ScoreBand } from "@/lib/scan/score";

const BAND_COLOR: Record<ScoreBand, string> = {
  good: "#0f7a56",
  fair: "#b45309",
  poor: "#c0272d",
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function ScoreRing({ score, size = 148 }: { score: number; size?: number }) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference * (1 - clamped / 100);
  const color = BAND_COLOR[scoreBand(clamped)];

  const offset = useMotionValue(circumference);
  // The ring's filled share, so the number counts up to the score as the arc draws.
  const scoreText = useTransform(offset, (value) => Math.round(100 * (1 - value / circumference)));

  useEffect(() => {
    if (reduce) {
      offset.set(target);
      return;
    }
    const controls = animate(offset, target, { duration: 1.1, ease: EASE });
    return () => controls.stop();
  }, [offset, target, reduce]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full"
        role="img"
        aria-label={`LeakFix score: ${clamped} out of 100`}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeOpacity={0.16}
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </g>
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="text-4xl font-semibold tabular-nums text-ink">{scoreText}</motion.span>
        <span className="text-xs text-ink-faint">out of 100</span>
      </div>
    </div>
  );
}
