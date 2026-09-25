import type { ScanInsights } from "@/lib/scan/insights/types";
import type { AuditSummary, FindingDetails, ScanSubject } from "@/lib/scan/types";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const scans = pgTable(
  "scans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submittedUrl: text("submitted_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    finalUrl: text("final_url"),
    kind: text("kind").notNull().default("website"),
    subject: jsonb("subject").$type<ScanSubject>(),
    status: text("status").notNull().default("queued"),
    score: integer("score"),
    durationMs: integer("duration_ms"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    auditSummary: jsonb("audit_summary").$type<AuditSummary>(),
    insights: jsonb("insights").$type<ScanInsights>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("scans_created_at_idx").on(table.createdAt)],
);

export const findings = pgTable(
  "findings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    ruleId: text("rule_id").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    severity: text("severity").notNull(),
    evidence: text("evidence").notNull(),
    recommendation: text("recommendation").notNull(),
    confidence: text("confidence").notNull().default("high"),
    details: jsonb("details").$type<FindingDetails>(),
    sortIndex: integer("sort_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("findings_scan_id_idx").on(table.scanId)],
);

export const monitors = pgTable(
  "monitors",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** SHA-256 of the owning browser's `lf_owner` cookie; NULL for legacy rows. */
    ownerHash: text("owner_hash"),
    normalizedUrl: text("normalized_url").notNull(),
    kind: text("kind").notNull().default("website"),
    label: text("label"),
    active: boolean("active").notNull().default(true),
    scanCount: integer("scan_count").notNull().default(0),
    lastScanId: text("last_scan_id"),
    lastScore: integer("last_score"),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    notifyWebhookUrl: text("notify_webhook_url"),
    notifyEmail: text("notify_email"),
    webhookSecret: text("webhook_secret"),
    notifyPolicy: text("notify_policy").notNull().default("drop"),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    lastNotifiedScore: integer("last_notified_score"),
    digestFrequency: text("digest_frequency").notNull().default("off"),
    digestRecipients: jsonb("digest_recipients").$type<string[]>(),
    lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("monitors_owner_url_idx").on(table.ownerHash, table.normalizedUrl),
    index("monitors_url_idx").on(table.normalizedUrl),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    scanId: text("scan_id"),
    channel: text("channel").notNull(),
    target: text("target").notNull(),
    status: text("status").notNull(),
    detail: text("detail"),
    attempts: integer("attempts").notNull().default(1),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_monitor_id_idx").on(table.monitorId)],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    normalizedUrl: text("normalized_url").notNull(),
    kind: text("kind").notNull().default("report_unlock"),
    provider: text("provider").notNull().default("dev"),
    reference: text("reference"),
    /**
     * SHA-256 of the buyer's browser identity (the `lf_owner` cookie). Future
     * scans of the same site unlock only for this buyer; the paid scan itself
     * stays viewable by anyone with its link. NULL on legacy rows, which keep
     * the old site-wide behavior.
     */
    buyerHash: text("buyer_hash"),
    /** Email Stripe collected at checkout, for the receipt and account recovery. */
    buyerEmail: text("buyer_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("entitlements_scan_id_idx").on(table.scanId),
    index("entitlements_normalized_url_idx").on(table.normalizedUrl),
    index("entitlements_buyer_idx").on(table.buyerHash),
  ],
);

/**
 * "Email me this report" requests. One row per (scan, email). Follow-up emails
 * are only sent when `marketingConsent` is true and the lead hasn't unsubscribed.
 */
export const reportLeads = pgTable(
  "report_leads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    ownerHash: text("owner_hash"),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    unsubscribeToken: text("unsubscribe_token").notNull(),
    /** How many follow-up emails have been sent (0 = only the report itself). */
    followUpsSent: integer("follow_ups_sent").notNull().default(0),
    lastEmailedAt: timestamp("last_emailed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("report_leads_scan_email_idx").on(table.scanId, table.email),
    uniqueIndex("report_leads_unsubscribe_idx").on(table.unsubscribeToken),
    index("report_leads_email_idx").on(table.email),
    index("report_leads_owner_idx").on(table.ownerHash),
  ],
);

/**
 * Accounts (passwordless, magic link). A user carries its own browser identity
 * (`owner_id`/`owner_hash`, the same secret the `lf_owner` cookie holds), so
 * signing in on any device sets that cookie and every existing ownership check
 * — monitors, entitlements, leads — keeps working unchanged.
 */
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Lowercased. */
    email: text("email").notNull(),
    /** The account's browser identity secret; set on the `lf_owner` cookie at sign-in. */
    ownerId: text("owner_id"),
    ownerHash: text("owner_hash"),
    stripeCustomerId: text("stripe_customer_id"),
    /** "free" or "pro". Access also requires an active subscription status. */
    plan: text("plan").notNull().default("free"),
    subscriptionId: text("subscription_id"),
    subscriptionStatus: text("subscription_status"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_owner_hash_idx").on(table.ownerHash),
    index("users_stripe_customer_idx").on(table.stripeCustomerId),
    index("users_subscription_idx").on(table.subscriptionId),
  ],
);

/** Single-use sign-in links. Only the SHA-256 of the token is stored. */
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    /**
     * Hash of the `lf_owner` identity of the browser that asked for the link.
     * Only that browser's anonymous purchases and monitors are merged into the
     * account, so a sign-in link sent to someone else can't absorb theirs.
     */
    requesterHash: text("requester_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("login_tokens_token_hash_idx").on(table.tokenHash)],
);

/** Signed-in sessions (`lf_session` cookie). Only the SHA-256 of the token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

/**
 * Shared fixed-window rate-limit counters (see `src/lib/rate-limit.ts`), so
 * limits hold across serverless instances. Rows past `expires_at` are dead and
 * swept opportunistically.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limits_expires_at_idx").on(table.expiresAt)],
);

export type ScanRow = typeof scans.$inferSelect;
export type NewScanRow = typeof scans.$inferInsert;
export type FindingRow = typeof findings.$inferSelect;
export type NewFindingRow = typeof findings.$inferInsert;
export type MonitorRow = typeof monitors.$inferSelect;
export type NewMonitorRow = typeof monitors.$inferInsert;
export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
export type EntitlementRow = typeof entitlements.$inferSelect;
export type ReportLeadRow = typeof reportLeads.$inferSelect;
export type NewEntitlementRow = typeof entitlements.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type LoginTokenRow = typeof loginTokens.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
