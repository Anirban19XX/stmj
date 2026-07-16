import { describe, expect, it } from "vitest";
import { resolveTokenLabel, getTokenOptions } from "./tokens";

describe("token metadata helpers", () => {
  it("returns a friendly label for known token addresses", () => {
    const label = resolveTokenLabel("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
    expect(label).toContain("Aegis");
  });

  it("offers an explicit custom-token option", () => {
    const options = getTokenOptions();
    expect(options.some((option) => option.label === "Custom address")).toBe(true);
  });
});
