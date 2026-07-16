import { describe, expect, it, vi } from "vitest";
import { fetchEscrowsInBatches } from "./escrow";

describe("fetchEscrowsInBatches", () => {
  it("keeps the queue bounded and skips individual failures", async () => {
    const worker = vi.fn(async (id: bigint) => {
      if (id === 2n) {
        throw new Error("boom");
      }
      return { id, title: `escrow-${id}` };
    });

    const results = await fetchEscrowsInBatches([1n, 2n, 3n], worker, 2);

    expect(results).toEqual([
      { id: 1n, title: "escrow-1" },
      { id: 3n, title: "escrow-3" },
    ]);
    expect(worker).toHaveBeenCalledTimes(3);
  });
});
