"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-wide motion defaults. `reducedMotion="user"` automatically disables
 * transform and layout animations for visitors who ask for reduced motion,
 * while keeping opacity/colour transitions.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
