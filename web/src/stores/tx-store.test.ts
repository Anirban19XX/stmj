import { beforeEach, describe, expect, it } from "vitest";
import { selectActiveCount, useTxStore } from "./tx-store";

describe("tx-store (transaction lifecycle)", () => {
  beforeEach(() => useTxStore.setState({ transactions: [] }));

  it("adds a transaction in the pending state", () => {
    const id = useTxStore.getState().add({
      label: "Create escrow",
      method: "create_escrow",
      contractId: "CESCROW",
    });
    const tx = useTxStore.getState().transactions[0]!;
    expect(tx.id).toBe(id);
    expect(tx.status).toBe("pending");
    expect(tx.retries).toBe(0);
  });

  it("transitions through processing -> confirmed with a hash", () => {
    const id = useTxStore.getState().add({ label: "Release", method: "release_milestone" });
    useTxStore.getState().setStatus(id, "processing");
    expect(useTxStore.getState().transactions[0]!.status).toBe("processing");
    useTxStore.getState().setStatus(id, "confirmed", { hash: "abc123" });
    const tx = useTxStore.getState().transactions[0]!;
    expect(tx.status).toBe("confirmed");
    expect(tx.hash).toBe("abc123");
  });

  it("counts only active transactions", () => {
    const a = useTxStore.getState().add({ label: "A", method: "m" });
    const b = useTxStore.getState().add({ label: "B", method: "m" });
    useTxStore.getState().setStatus(a, "confirmed");
    useTxStore.getState().setStatus(b, "processing");
    expect(selectActiveCount(useTxStore.getState())).toBe(1);
  });

  it("clears resolved transactions but keeps in-flight ones", () => {
    const a = useTxStore.getState().add({ label: "A", method: "m" });
    const b = useTxStore.getState().add({ label: "B", method: "m" });
    useTxStore.getState().setStatus(a, "failed", { error: "boom" });
    useTxStore.getState().setStatus(b, "pending");
    useTxStore.getState().clearResolved();
    const txs = useTxStore.getState().transactions;
    expect(txs).toHaveLength(1);
    expect(txs[0]!.id).toBe(b);
  });

  it("stores optional argsJson and invalidateJson", () => {
    const id = useTxStore.getState().add({
      label: "A",
      method: "m",
      argsJson: '{"key":"val"}',
      invalidateJson: '["key"]',
    });
    const tx = useTxStore.getState().transactions[0]!;
    expect(tx.id).toBe(id);
    expect(tx.argsJson).toBe('{"key":"val"}');
    expect(tx.invalidateJson).toBe('["key"]');
  });
});
