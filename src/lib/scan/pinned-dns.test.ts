import type { LookupAddress } from "node:dns";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { classifyFetchError } from "./fetcher";
import {
  BLOCKED_ADDRESS_CODE,
  createPinnedAgent,
  createPinnedLookup,
  pinnedDispatcher,
  type Resolver,
} from "./pinned-dns";

interface LookupResult {
  error: NodeJS.ErrnoException | null;
  address: string | LookupAddress[];
  family?: number;
}

function runLookup(
  resolve: Resolver,
  options: { all?: boolean; family?: number } = {},
  isBlocked?: (address: string) => boolean,
): Promise<LookupResult> {
  const lookup = createPinnedLookup({ resolve, isBlocked });
  return new Promise((done) => {
    lookup("target.test", options, (error, address, family) => done({ error, address, family }));
  });
}

const fixed =
  (...entries: LookupAddress[]): Resolver =>
  async () =>
    entries;

describe("createPinnedLookup", () => {
  it("returns the validated public address", async () => {
    const result = await runLookup(fixed({ address: "93.184.216.34", family: 4 }));
    expect(result.error).toBeNull();
    expect(result.address).toBe("93.184.216.34");
    expect(result.family).toBe(4);
  });

  it("returns every validated address when asked for all (happy eyeballs)", async () => {
    const entries: LookupAddress[] = [
      { address: "2606:2800:220:1::1", family: 6 },
      { address: "93.184.216.34", family: 4 },
    ];
    const result = await runLookup(fixed(...entries), { all: true });
    expect(result.error).toBeNull();
    expect(result.address).toEqual(entries);
  });

  it("filters by the requested family", async () => {
    const result = await runLookup(
      fixed({ address: "2606:2800:220:1::1", family: 6 }, { address: "93.184.216.34", family: 4 }),
      { family: 4 },
    );
    expect(result.address).toBe("93.184.216.34");
  });

  it.each(["169.254.169.254", "10.0.0.5", "127.0.0.1", "::1", "::ffff:192.168.1.1"])(
    "rejects %s at connect time",
    async (address) => {
      const result = await runLookup(fixed({ address, family: address.includes(":") ? 6 : 4 }));
      expect(result.error?.code).toBe(BLOCKED_ADDRESS_CODE);
    },
  );

  it("rejects the whole answer if any address is private", async () => {
    const result = await runLookup(
      fixed({ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }),
      { all: true },
    );
    expect(result.error?.code).toBe(BLOCKED_ADDRESS_CODE);
  });

  it("blocks a rebinding answer even though an earlier resolution passed", async () => {
    // First answer (the pre-check) is public; the second (the connect) rebinds.
    const answers = ["93.184.216.34", "169.254.169.254"];
    let call = 0;
    const rebinding: Resolver = async () => [{ address: answers[call++], family: 4 }];
    const lookup = createPinnedLookup({ resolve: rebinding });
    const outcome = (): Promise<LookupResult> =>
      new Promise((done) =>
        lookup("rebind.test", {}, (error, address, family) => done({ error, address, family })),
      );

    expect((await outcome()).error).toBeNull();
    const connect = await outcome();
    expect(connect.error?.code).toBe(BLOCKED_ADDRESS_CODE);
  });

  it("propagates resolver failures", async () => {
    const failing: Resolver = async () => {
      throw Object.assign(new Error("nope"), { code: "ENOTFOUND" });
    };
    const result = await runLookup(failing);
    expect(result.error?.code).toBe("ENOTFOUND");
  });

  it("fails with ENOTFOUND on an empty answer", async () => {
    const result = await runLookup(fixed());
    expect(result.error?.code).toBe("ENOTFOUND");
  });
});

describe("pinned agent with fetch", () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits += 1;
      res.writeHead(200, { "content-type": "text/plain" }).end("pinned");
    });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((closed) => server.close(() => closed()));
  });

  const toLoopback: Resolver = async () => [{ address: "127.0.0.1", family: 4 }];

  it("never connects when the connect-time answer is private", async () => {
    const agent = createPinnedAgent({ resolve: toLoopback });
    const before = hits;
    const error = await fetch(`http://rebind.test:${port}/`, {
      dispatcher: agent,
    } as RequestInit).then(
      () => null,
      (reason: unknown) => reason,
    );
    await agent.close();

    expect(error).not.toBeNull();
    expect((error as { cause?: { code?: string } }).cause?.code).toBe(BLOCKED_ADDRESS_CODE);
    expect(classifyFetchError(error).code).toBe("BLOCKED_TARGET");
    expect(hits).toBe(before);
  });

  it("connects to exactly the address the lookup validated", async () => {
    // `rebind.test` does not exist in real DNS, so reaching the server proves
    // the socket used the pinned answer rather than resolving on its own.
    const agent = createPinnedAgent({ resolve: toLoopback, isBlocked: () => false });
    const response = await fetch(`http://rebind.test:${port}/`, {
      dispatcher: agent,
    } as RequestInit);
    const body = await response.text();
    await agent.close();

    expect(response.status).toBe(200);
    expect(body).toBe("pinned");
  });

  it("uses the default dispatcher when private targets are allowed", () => {
    expect(pinnedDispatcher(true)).toBeUndefined();
    expect(pinnedDispatcher(false)).toBe(pinnedDispatcher(false));
  });
});
