export const NOTIFY_POLICIES = ["drop", "change", "always"] as const;
export type NotifyPolicy = (typeof NOTIFY_POLICIES)[number];

export const NOTIFY_POLICY_LABEL: Record<NotifyPolicy, string> = {
  drop: "Only when the score drops",
  change: "On any score change",
  always: "After every scan",
};

export function isNotifyPolicy(value: unknown): value is NotifyPolicy {
  return typeof value === "string" && (NOTIFY_POLICIES as readonly string[]).includes(value);
}
