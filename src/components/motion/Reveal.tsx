"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}

/** Fades and lifts content into view once, as it enters the viewport. */
export function Reveal({ children, className, delay = 0, y = 16, amount = 0.25 }: RevealProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...(reduce ? {} : { y }) }}
      whileInView={{ opacity: 1, ...(reduce ? {} : { y: 0 }) }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
