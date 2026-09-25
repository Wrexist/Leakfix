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
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 relay anycast
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/**
 * Parses an IPv6 address into its eight 16-bit groups, expanding `::` and a
 * trailing dotted IPv4 part. Returns null for anything malformed.
 */
function parseIpv6(value: string): number[] | null {
  let address = value.toLowerCase().split("%")[0].trim();
  if (address.startsWith("[") && address.endsWith("]")) address = address.slice(1, -1);
  if (address === "" || !/^[0-9a-f:.]+$/.test(address)) return null;

  // A trailing dotted IPv4 part (for example ::ffff:127.0.0.1) fills two groups.
  let tail: number[] = [];
  const lastColon = address.lastIndexOf(":");
  if (address.slice(lastColon + 1).includes(".")) {
    const ipv4 = parseIpv4(address.slice(lastColon + 1));
    if (!ipv4 || lastColon < 0) return null;
    tail = [(ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]];
    address = address.slice(0, lastColon + 1);
    // Keep a "::" intact; otherwise drop the separator before the IPv4 part.
    if (!address.endsWith("::")) address = address.slice(0, -1);
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    for (const group of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      groups.push(parseInt(group, 16));
    }
    return groups;
  };

  const head = parseGroups(halves[0]);
  const rest = halves.length === 2 ? parseGroups(halves[1]) : [];
  if (!head || !rest) return null;

  const explicit = head.length + rest.length + tail.length;
  if (halves.length === 1) {
    return explicit === 8 ? [...head, ...tail] : null;
  }
  if (explicit > 7) return null;
  return [...head, ...new Array<number>(8 - explicit).fill(0), ...rest, ...tail];
}

function embeddedIpv4(high: number, low: number): string {
  return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
}

export function isBlockedIpv6(ip: string): boolean {
  const groups = parseIpv6(ip);
  if (!groups) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const zeroPrefix = (count: number) => groups.slice(0, count).every((group) => group === 0);

  // ::ffff:a.b.c.d IPv4-mapped: judge the embedded IPv4 address.
  if (zeroPrefix(5) && g5 === 0xffff) return isBlockedIpv4(embeddedIpv4(g6, g7));
  // ::/96 covers ::, ::1 and deprecated IPv4-compatible (::a.b.c.d) addresses.
  if (zeroPrefix(6)) return true;
  // ::ffff:0:a.b.c.d IPv4-translated (SIIT).
  if (zeroPrefix(4) && g4 === 0xffff && g5 === 0) return true;
  if (g0 === 0x0064 && g1 === 0xff9b) return true; // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // discard-only 100::/64
  if (g0 === 0x2001 && g1 < 0x0200) return true; // IETF special-purpose 2001::/23 (incl. Teredo)
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x2002) return true; // 6to4 2002::/16 (tunnels IPv4)
  if (g0 === 0x3fff && g1 < 0x1000) return true; // documentation 3fff::/20
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g0 & 0xff80) === 0xfe80) return true; // link-local fe80::/10 + site-local fec0::/10
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const value = ip.trim();
  if (looksLikeIpv4(value)) return isBlockedIpv4(value);
  if (looksLikeIpv6(value)) return isBlockedIpv6(value);
  return true;
}
