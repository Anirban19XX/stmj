/** Display/parse helpers for amounts, addresses and time. */

/** Stellar assets (and the native XLM SAC) use 7 decimal places (stroops). */
export const TOKEN_DECIMALS = 7;

/** Format a raw on-chain integer amount (stroops) for display. */
export function formatAmount(raw: bigint, decimals = TOKEN_DECIMALS): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const wholeStr = whole.toLocaleString("en-US");
  return `${negative ? "-" : ""}${wholeStr}${fracStr ? "." + fracStr : ""}`;
}

/** Parse a human decimal string (e.g. "12.5") into raw stroops. Throws on bad input. */
export function parseAmount(value: string, decimals = TOKEN_DECIMALS): bigint {
  const trimmed = value.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error("Enter a valid number.");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`At most ${decimals} decimal places are allowed.`);
  }
  const padded = frac.padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/** Shorten a Stellar address/contract id for compact display. */
export function truncateAddress(address: string, head = 4, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Shorten a transaction hash. */
export function truncateHash(hash: string): string {
  return truncateAddress(hash, 6, 6);
}

/** Relative "time ago" from a unix-seconds bigint or ms number. */
export function timeAgo(input: bigint | number): string {
  const ms = typeof input === "bigint" ? Number(input) * 1000 : input;
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

/** Format a unix-seconds bigint as a locale date-time. */
export function formatDate(seconds: bigint | number): string {
  const ms = typeof seconds === "bigint" ? Number(seconds) * 1000 : seconds;
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Percentage helper (basis points -> "2.5%"). */
export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** Progress 0–100 from released/total. */
export function progressPct(released: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((released * 10000n) / total) / 100;
}
