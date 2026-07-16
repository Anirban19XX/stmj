import { describe, expect, it } from "vitest";
import {
  formatAmount,
  parseAmount,
  progressPct,
  truncateAddress,
  truncateHash,
} from "./format";

describe("formatAmount", () => {
  it("formats whole stroops with grouping", () => {
    expect(formatAmount(10_000_000n)).toBe("1");
    expect(formatAmount(12_500_000n)).toBe("1.25");
    expect(formatAmount(1_000_000_0000000n)).toBe("1,000,000");
  });

  it("trims trailing zeros in the fraction", () => {
    expect(formatAmount(15_000_000n)).toBe("1.5");
  });

  it("handles zero and negatives", () => {
    expect(formatAmount(0n)).toBe("0");
    expect(formatAmount(-25_000_000n)).toBe("-2.5");
  });
});

describe("parseAmount", () => {
  it("round-trips with formatAmount", () => {
    expect(parseAmount("1")).toBe(10_000_000n);
    expect(parseAmount("1.25")).toBe(12_500_000n);
    expect(parseAmount("0.0000001")).toBe(1n);
  });

  it("rejects invalid input", () => {
    expect(() => parseAmount("")).toThrow();
    expect(() => parseAmount("abc")).toThrow();
    expect(() => parseAmount("1.234567890")).toThrow(/decimal places/);
  });
});

describe("truncate helpers", () => {
  it("shortens long addresses", () => {
    const a = "GABC1234567890DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMN";
    expect(truncateAddress(a)).toBe("GABC…KLMN");
  });
  it("leaves short strings intact", () => {
    expect(truncateAddress("GABC")).toBe("GABC");
  });
  it("shortens hashes wider", () => {
    expect(truncateHash("abcdef1234567890")).toBe("abcdef…567890");
  });
});

describe("progressPct", () => {
  it("computes release progress", () => {
    expect(progressPct(0n, 100n)).toBe(0);
    expect(progressPct(50n, 100n)).toBe(50);
    expect(progressPct(100n, 100n)).toBe(100);
  });
  it("guards divide-by-zero", () => {
    expect(progressPct(0n, 0n)).toBe(0);
  });
});
