import { describe, expect, it } from "vitest";
import { describeActivity } from "./activity-format";
import type { ActivityEvent } from "@/types";

function makeEvent(partial: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: "1-0-0",
    kind: "EscrowCreated",
    contractId: "C123",
    topics: [],
    data: {},
    ledger: 1,
    ...partial,
  };
}

describe("describeActivity", () => {
  it("describes an escrow creation with amount", () => {
    const d = describeActivity(
      makeEvent({ kind: "EscrowCreated", data: { id: 7, amount: "25000000" } }),
    );
    expect(d.title).toContain("#7");
    expect(d.detail).toContain("2.5");
    expect(d.tone).toBe("neutral");
  });

  it("flags disputes as danger", () => {
    const d = describeActivity(makeEvent({ kind: "Disputed", data: { id: 3 } }));
    expect(d.tone).toBe("danger");
    expect(d.title).toMatch(/dispute raised/i);
  });

  it("marks milestone releases as success", () => {
    const d = describeActivity(
      makeEvent({ kind: "MilestoneReleased", data: { id: 1, amount: "10000000" } }),
    );
    expect(d.tone).toBe("success");
    expect(d.detail).toContain("1");
  });
});
