/**
 * Pure IP address classification. No Node APIs, so this is safe to share
 * between the server validation boundary and its tests.
 *
 * This is one layer of the SSRF defense. It is intentionally conservative:
 * anything that cannot be confidently classified as public is treated as
 * blocked.
 */

function parseIpv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return [octets[0], octets[1], octets[2], octets[3]];
}

export function looksLikeIpv4(value: string): boolean {
  return parseIpv4(value) !== null;
}

export function looksLikeIpv6(value: string): boolean {
  return value.includes(":") && /^[0-9a-fA-F:.%]+$/.test(value);
}

export function isBlockedIpv4(ip: string): boolean {
  const parsed = parseIpv4(ip);
  if (!parsed) return true;
  const [a, b, c] = parsed;

  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

export function isBlockedIpv6(ip: string): boolean {
  const address = ip.toLowerCase().split("%")[0].trim();
  if (address === "" || address === "::" || address === "::1") return true;

  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);

  // ::ffff:xxxx:xxxx hex-encoded IPv4-mapped address.
  const hexMapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16);
    const low = parseInt(hexMapped[2], 16);
    const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    return isBlockedIpv4(dotted);
  }

  if (address.startsWith("fc") || address.startsWith("fd")) return true; // unique local
  if (/^fe[89ab]/.test(address)) return true; // link-local
  if (address.startsWith("ff")) return true; // multicast
  if (address.startsWith("2001:db8")) return true; // documentation
  if (address.startsWith("64:ff9b::")) return true; // NAT64
  if (address.startsWith("2002::")) return true; // 6to4 (can tunnel IPv4)
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const value = ip.trim();
  if (looksLikeIpv4(value)) return isBlockedIpv4(value);
  if (looksLikeIpv6(value)) return isBlockedIpv6(value);
  return true;
}
