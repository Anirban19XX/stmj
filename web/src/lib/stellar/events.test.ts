import { describe, expect, it, vi } from "vitest";

// scValToNative is the only SDK surface decodeEvent touches; make it identity so
// we can feed already-native topics/values and assert the field-mapping logic.
vi.mock("@stellar/stellar-sdk", () => ({
  scValToNative: (x: unknown) => x,
}));

// Stub the RPC client so importing events.ts doesn't spin up a real rpc.Server.
vi.mock("./client", () => ({
  getContractEvents: vi.fn(),
  getLatestLedger: vi.fn(),
}));

const { decodeEvent } = await import("./events");

describe("decodeEvent", () => {
  it("maps topics and named data fields for MilestoneReleased", () => {
    const event = decodeEvent({
      id: "0001",
      contractId: "CESCROW",
      topic: ["MilestoneReleased", "GBUYER", "GSELLER"],
      value: [42n, 10_000_000n],
      ledger: 100,
      ledgerClosedAt: "2026-01-01T00:00:00Z",
      txHash: "deadbeef",
    });

    expect(event).not.toBeNull();
    expect(event!.kind).toBe("MilestoneReleased");
    expect(event!.topics).toEqual(["GBUYER", "GSELLER"]);
    expect(event!.data).toEqual({ id: "42", amount: "10000000" });
    expect(event!.txHash).toBe("deadbeef");
  });

  it("handles single-value (non-array) data", () => {
    const event = decodeEvent({
      id: "0002",
      contractId: "CESCROW",
      topic: ["Delivered", "GSELLER"],
      value: 7n,
      ledger: 101,
    });
    expect(event!.kind).toBe("Delivered");
    expect(event!.data).toEqual({ id: "7" });
  });

  it("decodes registry completion events", () => {
    const event = decodeEvent({
      id: "0003",
      contractId: "CREGISTRY",
      topic: ["CompletionRecorded", "GSELLER", "GBUYER"],
      value: [50_000_000n],
      ledger: 102,
    });
    expect(event!.kind).toBe("CompletionRecorded");
    expect(event!.data).toEqual({ amount: "50000000" });
  });
});
