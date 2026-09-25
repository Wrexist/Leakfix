import { expect, test } from "@playwright/test";

import { FIXTURE_ORIGIN } from "./constants";

test("homepage presents one focused action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /leaking customers/i })).toBeVisible();
  await expect(page.getByLabel("Website address").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /find my leaks/i }).first()).toBeEnabled();
});

test("rejects an invalid URL with an inline, announced error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill("not a url");
  await page.getByRole("button", { name: /find my leaks/i }).first().click();

  const alert = page.locator('p[role="alert"]').filter({ hasText: /valid website address/i });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/doesn't look like a valid website address/i);
  await expect(page).toHaveURL(new RegExp("/$"));
});

test("scans a page, shows real progress, and renders a prioritized report", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/slow`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();

  await expect(page).toHaveURL(/\/scan\/[0-9a-f-]{36}$/i);
  await expect(page.getByRole("heading", { name: /scanning 127\.0\.0\.1/i })).toBeVisible();
  await expect(page.getByText("Connecting to website", { exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Missing meta description" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Page title is longer than recommended" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Missing mobile viewport tag" })).toBeVisible();
  await expect(page.getByRole("img", { name: /LeakFix score/i })).toBeVisible();

  const firstEvidence = page.getByText("Evidence").first();
  await expect(firstEvidence).toBeVisible();
  await expect(page.getByText("How to fix it").first()).toBeVisible();
});

test("shows the paywall and unlocks the full report", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/good`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();
  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible({ timeout: 30_000 });

  // Free preview: the top finding is open, the rest have locked fix details.
  await expect(page.getByText("Fix details locked").first()).toBeVisible();

  const unlock = page.getByRole("button", { name: /unlock full report \(dev\)/i });
  await unlock.scrollIntoViewIfNeeded();
  await unlock.click();

  await expect(page.getByText("Fix details locked")).toHaveCount(0, { timeout: 15_000 });
});

test("persists the report across a reload (server-rendered result)", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/leaky`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();

  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible({
    timeout: 30_000,
  });
  const url = page.url();

  await page.goto(url);
  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Missing mobile viewport tag" })).toBeVisible();
});

test("shows a friendly error for unsupported content with a retry", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/json`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();

  await expect(page.getByRole("heading", { name: /can't analyze that page/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: /find my leaks/i }).first()).toBeVisible();
});

test("switches the review target with tabs", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Website address").first();

  await expect(input).toHaveAttribute("placeholder", /yourwebsite\.com/);
  await page.getByRole("button", { name: "iPhone app" }).click();
  await expect(input).toHaveAttribute("placeholder", /apps\.apple\.com/);
  await page.getByRole("button", { name: "Android app" }).click();
  await expect(input).toHaveAttribute("placeholder", /play\.google\.com/);
});

test("shows a not-found page for an unknown scan", async ({ page }) => {
  const response = await page.goto("/scan/00000000-0000-0000-0000-000000000000");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
});

test("monitors a target", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/good`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();
  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /monitor this target/i }).click();
  await expect(page.getByRole("link", { name: /manage monitors/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/monitors");
  await expect(page.getByRole("heading", { name: /track your targets/i })).toBeVisible();
  await expect(page.getByText("127.0.0.1").first()).toBeVisible();

  // Configure and test notifications.
  await page.getByText("Notifications").first().click();
  await page.locator("input[id^='notify-webhook-']").fill(`${FIXTURE_ORIGIN}/hook`);
  await page.locator("input[id^='notify-email-']").fill("ops@example.test");
  await page
    .locator("input[id^='notify-recipients-']")
    .fill("ops@example.test, founder@example.test");
  await page.locator("select[id^='notify-policy-']").selectOption("always");
  await page.locator("select[id^='notify-digest-']").selectOption("weekly");

  // The signing secret is never listed back; rotating reveals a fresh one once.
  await expect(page.getByText(/hidden for security/i).first()).toBeVisible();
  await page.getByRole("button", { name: /^rotate$/i }).first().click();
  await expect(page.locator("code", { hasText: "whsec_" }).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/notification settings saved/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /send test/i }).click();
  await expect(page.getByText(/webhook: sent/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /send digest now/i }).click();
  await expect(page.getByText(/digest: sent/i)).toBeVisible({ timeout: 15_000 });

  await expect(page.getByRole("link", { name: /preview digest/i })).toBeVisible();
});

test("exports a report as CSV and Markdown", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/good`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();
  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible({ timeout: 30_000 });

  const csvLink = page.getByRole("link", { name: /export csv/i });
  await expect(csvLink).toBeVisible();
  const href = await csvLink.getAttribute("href");
  expect(href).toBeTruthy();

  const csv = await request.get(href!);
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain("type,category,severity");

  const markdown = await request.get(href!.replace("format=csv", "format=md"));
  expect(markdown.ok()).toBe(true);
  expect(await markdown.text()).toContain("# LeakFix report");
});

test("compares two scans side by side", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/leaky`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();
  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible({ timeout: 30_000 });

  const compareLink = page.getByRole("link", { name: /compare side by side/i });
  await expect(compareLink).toBeVisible({ timeout: 15_000 });
  await compareLink.click();

  await expect(page).toHaveURL(/\/compare\?a=/);
  await expect(page.getByText(/Score is unchanged|Score improved|Score dropped/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /fixed \(/i })).toBeVisible();
});

test("has no horizontal overflow on a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const homeOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(homeOverflow).toBeLessThanOrEqual(1);

  await page.getByLabel("Website address").first().fill(`${FIXTURE_ORIGIN}/leaky`);
  await page.getByRole("button", { name: /find my leaks/i }).first().click();
  await expect(page.getByRole("heading", { name: "All findings" })).toBeVisible({
    timeout: 30_000,
  });

  const reportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(reportOverflow).toBeLessThanOrEqual(1);
});
