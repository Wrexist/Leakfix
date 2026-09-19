import { describe, expect, it } from "vitest";

import { isBlockedAddress, isBlockedIpv4, isBlockedIpv6 } from "./ip";

describe("isBlockedIpv4", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.168.0.1",
    "198.18.0.1",
    "203.0.113.5",
    "224.0.0.1",
    "255.255.255.255",
  ])("blocks %s", (ip) => {
    expect(isBlockedIpv4(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1"])("allows %s", (ip) => {
    expect(isBlockedIpv4(ip)).toBe(false);
  });

  it("blocks unparseable values", () => {
    expect(isBlockedIpv4("999.1.1.1")).toBe(true);
  });
});

describe("isBlockedIpv6", () => {
  it.each(["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1"])(
    "blocks %s",
    (ip) => {
      expect(isBlockedIpv6(ip)).toBe(true);
    },
  );

  it.each(["2001:4860:4860::8888", "2606:4700:4700::1111"])("allows %s", (ip) => {
    expect(isBlockedIpv6(ip)).toBe(false);
  });

  it("blocks IPv4-mapped private addresses", () => {
    expect(isBlockedIpv6("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIpv6("::ffff:7f00:1")).toBe(true);
    expect(isBlockedIpv6("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("isBlockedAddress", () => {
  it("treats unknown formats as blocked", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });
});
