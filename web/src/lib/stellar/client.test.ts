import { describe, expect, it } from "vitest";
import { buildTransactionPreview } from "./client";

describe("buildTransactionPreview", () => {
  it("derives fee and footprint estimates from simulation data", () => {
    const preview = buildTransactionPreview(
      {
        minResourceFee: "2500",
        transactionData: {
          resources: {
            instructions: 200,
            readBytes: 10,
            writeBytes: 20,
            footprint: {
              readOnly: [{}, {}],
              readWrite: [{}, {}],
            },
          },
        },
      } as any,
      "100",
    );

    expect(preview).toEqual({
      baseFee: "100",
      estimatedFee: "2600",
      resourceFee: "2500",
      instructions: 200,
      readBytes: 10,
      writeBytes: 20,
      footprintEntries: 4,
    });
  });
});
