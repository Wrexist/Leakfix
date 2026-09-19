import { describe, expect, it } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
  isScanStatus,
  isTerminalStatus,
  SCAN_STATUSES,
  stageIndexForStatus,
} from "./state";

describe("scan state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("queued", "fetching")).toBe(true);
    expect(canTransition("fetching", "analyzing")).toBe(true);
    expect(canTransition("analyzing", "completed")).toBe(true);
  });

  it("allows failing from any active state", () => {
    expect(canTransition("queued", "failed")).toBe(true);
    expect(canTransition("fetching", "failed")).toBe(true);
    expect(canTransition("analyzing", "failed")).toBe(true);
  });

  it("forbids skipping states and leaving terminal states", () => {
    expect(canTransition("queued", "completed")).toBe(false);
    expect(canTransition("completed", "fetching")).toBe(false);
    expect(canTransition("failed", "fetching")).toBe(false);
    expect(canTransition("fetching", "queued")).toBe(false);
  });

  it("assertTransition throws on illegal transitions", () => {
    expect(() => assertTransition("queued", "completed")).toThrow();
    expect(() => assertTransition("queued", "fetching")).not.toThrow();
  });

  it("identifies terminal statuses", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("analyzing")).toBe(false);
  });

  it("validates status values", () => {
    expect(isScanStatus("queued")).toBe(true);
    expect(isScanStatus("nope")).toBe(false);
    for (const status of SCAN_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("maps statuses to a monotonic stage index", () => {
    expect(stageIndexForStatus("queued")).toBe(0);
    expect(stageIndexForStatus("fetching")).toBe(0);
    expect(stageIndexForStatus("analyzing")).toBe(1);
    expect(stageIndexForStatus("completed")).toBe(2);
    expect(stageIndexForStatus("failed")).toBe(2);
  });
});
