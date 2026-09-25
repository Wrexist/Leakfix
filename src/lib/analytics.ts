/**
 * Funnel analytics. Events go to Plausible when its script is on the page
 * (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`), which is cookie-free, and are also dispatched
 * as a `leakfix:track` DOM event so any other tool can listen. Never pass URLs,
 * emails, or other personal data as props.
 */
export type FunnelEvent =
  | "scan_started"
  | "report_viewed"
  | "paywall_viewed"
  | "checkout_started"
  | "report_unlocked"
  | "report_emailed";

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Props }) => void;
  }
}

export function track(event: FunnelEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.plausible?.(event, { props });
    window.dispatchEvent(new CustomEvent("leakfix:track", { detail: { event, props } }));
  } catch {
    // Analytics must never break the product.
  }
}

/** Coarse score bucket, so reports can be segmented without exact values. */
export function scoreBucket(score: number | null): string {
  if (score == null) return "none";
  if (score >= 90) return "90-100";
  if (score >= 70) return "70-89";
  if (score >= 50) return "50-69";
  return "0-49";
}
