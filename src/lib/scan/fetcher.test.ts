import { describe, expect, it } from "vitest";

import { classifyFetchError } from "./fetcher";
import { BLOCKED_ADDRESS_CODE } from "./pinned-dns";

describe("classifyFetchError", () => {
  it("maps abort and undici timeout codes to TIMEOUT", () => {
    expect(classifyFetchError({ name: "TimeoutError" }).code).toBe("TIMEOUT");
    expect(classifyFetchError({ name: "AbortError" }).code).toBe("TIMEOUT");
    expect(classifyFetchError({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }).code).toBe("TIMEOUT");
  });

  it("maps DNS failures", () => {
    expect(classifyFetchError({ code: "ENOTFOUND" }).code).toBe("DNS_FAILURE");
    expect(classifyFetchError({ cause: { code: "EAI_AGAIN" } }).code).toBe("DNS_FAILURE");
  });

  it("maps a connect-time pinned-DNS block to BLOCKED_TARGET", () => {
    const error = new TypeError("fetch failed", { cause: { code: BLOCKED_ADDRESS_CODE } });
    expect(classifyFetchError(error)).toEqual({
      code: "BLOCKED_TARGET",
      detail: "resolves_to_private",
    });
  });

  it("defaults to UNREACHABLE with a non-empty detail", () => {
    const result = classifyFetchError({ code: "ECONNREFUSED" });
    expect(result.code).toBe("UNREACHABLE");
    expect(result.detail).toContain("ECONNREFUSED");
  });

  it("handles non-object throwables", () => {
    expect(classifyFetchError("boom").code).toBe("UNREACHABLE");
  });
});
