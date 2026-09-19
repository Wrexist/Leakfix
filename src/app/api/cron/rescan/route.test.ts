import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET, POST } from "./route";

const originalSecret = process.env.CRON_SECRET;

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/rescan", { method: "POST", headers });
}

describe("cron rescan route", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("returns 503 when no secret is configured", async () => {
    const response = await POST(request());
    expect(response.status).toBe(503);
  });

  it("rejects an invalid secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await POST(request({ authorization: "Bearer wrong" }));
    expect(response.status).toBe(401);
  });

  it("runs with a valid secret and no monitors", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await GET(request({ authorization: "Bearer s3cret" }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { checked: number };
    expect(body.checked).toBe(0);
  });
});
