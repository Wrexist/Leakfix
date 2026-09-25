"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}

/**
 * Fades and lifts content into view once, as it enters the viewport. For reduced
 * motion, MotionConfig makes the lift instant; branching on useReducedMotion()
 * here would render differently on the server and fail to hydrate.
 */
export function Reveal({ children, className, delay = 0, y = 16, amount = 0.25 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
