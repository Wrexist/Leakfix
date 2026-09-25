import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";

import { Agent, type Dispatcher } from "undici";

import { isBlockedAddress } from "./ip";

/**
 * DNS pinning for outbound requests (anti DNS rebinding).
 *
 * Checking a hostname's addresses and then calling `fetch` is a TOCTOU: fetch
 * resolves again, and a short-TTL record can answer with a public IP for the
 * check and 169.254.169.254 or 10.x for the connection. Instead, the socket's
 * own `lookup` is replaced: it resolves once, rejects the whole answer if any
 * address is blocked, and hands the socket exactly the addresses it validated.
 * There is no second resolution for an attacker to race.
 *
 * Literal IP hosts skip `lookup` in Node's `net`; those are rejected earlier by
 * `validateUrlInput` (see url.ts), which classifies them with the same rules.
 */

/** Error code carried by connect failures for blocked addresses. */
export const BLOCKED_ADDRESS_CODE = "LEAKFIX_BLOCKED_ADDRESS";

export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

export interface PinnedLookupOptions {
  /** Injectable for tests; defaults to the system resolver (`dns.lookup`). */
  resolve?: Resolver;
  /** Injectable for tests; defaults to the SSRF blocklist in ip.ts. */
  isBlocked?: (address: string) => boolean;
}

const systemResolve: Resolver = (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

function lookupError(code: string, message: string, hostname: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException & { hostname?: string } = new Error(message);
  error.code = code;
  error.hostname = hostname;
  return error;
}

function familyNumber(family: number | string | undefined): 0 | 4 | 6 {
  if (family === 4 || family === "IPv4") return 4;
  if (family === 6 || family === "IPv6") return 6;
  return 0;
}

export function createPinnedLookup(options: PinnedLookupOptions = {}): LookupFunction {
  const resolve = options.resolve ?? systemResolve;
  const isBlocked = options.isBlocked ?? isBlockedAddress;

  return (hostname, lookupOptions, callback) => {
    resolve(hostname).then(
      (resolved) => {
        // Validate the full answer, not only the family being connected to.
        if (resolved.some((entry) => isBlocked(entry.address))) {
          callback(
            lookupError(BLOCKED_ADDRESS_CODE, `blocked address for ${hostname}`, hostname),
            "",
          );
          return;
        }

        const family = familyNumber(lookupOptions.family);
        const wanted = family ? resolved.filter((entry) => entry.family === family) : resolved;
        if (wanted.length === 0) {
          callback(lookupError("ENOTFOUND", `no addresses for ${hostname}`, hostname), "");
          return;
        }

        // Node's happy-eyeballs connect asks for `all`; plain connects want one.
        if (lookupOptions.all) {
          callback(null, wanted);
        } else {
          callback(null, wanted[0].address, wanted[0].family);
        }
      },
      (error: NodeJS.ErrnoException) => callback(error, ""),
    );
  };
}

/** An undici dispatcher whose connections only reach validated addresses. */
export function createPinnedAgent(options: PinnedLookupOptions = {}): Agent {
  return new Agent({ connect: { lookup: createPinnedLookup(options) } });
}

const globalForPinned = globalThis as unknown as { __leakfixPinnedAgent?: Agent };

/**
 * The dispatcher to pass to `fetch` for an untrusted URL. When private targets
 * are explicitly allowed (tests, e2e fixtures), the default dispatcher is used.
 */
export function pinnedDispatcher(allowPrivate: boolean): Dispatcher | undefined {
  if (allowPrivate) return undefined;
  globalForPinned.__leakfixPinnedAgent ??= createPinnedAgent();
  return globalForPinned.__leakfixPinnedAgent;
}

/**
 * Adds the pinned dispatcher to a fetch init. Node's fetch accepts undici's
 * `dispatcher` option, but the DOM `RequestInit` typings do not declare it.
 */
export function withPinnedDispatcher(init: RequestInit, allowPrivate: boolean): RequestInit {
  const dispatcher = pinnedDispatcher(allowPrivate);
  return dispatcher ? ({ ...init, dispatcher } as RequestInit) : init;
}
