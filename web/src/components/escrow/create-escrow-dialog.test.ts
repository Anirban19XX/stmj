import { describe, expect, it, vi } from "vitest";

const validAddress = "G" + "A".repeat(55);

vi.mock("@/lib/stellar/wallet", () => ({
  connectWithModal: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn(),
  signTransaction: vi.fn(),
}));

import { schema } from "./create-escrow-dialog";

describe("create escrow form schema", () => {
  it("rejects past deadlines", () => {
    const result = schema.safeParse({
      title: "Test escrow",
      seller: validAddress,
      arbiter: validAddress,
      token: validAddress,
      deadline: "2000-01-01T00:00",
      milestones: [{ description: "Milestone 1", amount: "1" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.deadline).toContain("Pick a deadline in the future");
    }
  });

  it("accepts future deadlines", () => {
    const result = schema.safeParse({
      title: "Test escrow",
      seller: validAddress,
      arbiter: validAddress,
      token: validAddress,
      deadline: "2099-01-01T00:00",
      milestones: [{ description: "Milestone 1", amount: "1" }],
    });

    expect(result.success).toBe(true);
  });
});
