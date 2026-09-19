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
    normalizedUrl: text("normalized_url").notNull(),
    kind: text("kind").notNull().default("website"),
    label: text("label"),
    active: boolean("active").notNull().default(true),
    scanCount: integer("scan_count").notNull().default(0),
    lastScanId: text("last_scan_id"),
    lastScore: integer("last_score"),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("monitors_normalized_url_idx").on(table.normalizedUrl)],
);

export type ScanRow = typeof scans.$inferSelect;
export type NewScanRow = typeof scans.$inferInsert;
export type FindingRow = typeof findings.$inferSelect;
export type NewFindingRow = typeof findings.$inferInsert;
export type MonitorRow = typeof monitors.$inferSelect;
export type NewMonitorRow = typeof monitors.$inferInsert;
