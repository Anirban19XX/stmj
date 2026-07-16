import { describe, expect, it } from "vitest";
import { AppError, toUserMessage } from "./errors";

describe("toUserMessage", () => {
  it("maps escrow contract error codes", () => {
    expect(toUserMessage(new Error("HostError: Error(Contract, #4)"), "escrow")).toMatch(
      /not authorized/i,
    );
    expect(toUserMessage(new Error("Error(Contract, #12)"), "escrow")).toMatch(
      /different accounts/i,
    );
  });

  it("maps registry codes from the registry table", () => {
    expect(toUserMessage(new Error("Error(Contract, #3)"), "registry")).toMatch(
      /only the registered escrow/i,
    );
  });

  it("recognises wallet rejection", () => {
    expect(toUserMessage(new Error("User declined the request"))).toMatch(/rejected/i);
  });

  it("recognises insufficient balance", () => {
    expect(toUserMessage(new Error("tx failed: insufficient balance"))).toMatch(
      /insufficient balance/i,
    );
  });

  it("passes AppError messages through untouched", () => {
    const e = new AppError("NOT_CONFIGURED", "Custom message");
    expect(toUserMessage(e)).toBe("Custom message");
  });

  it("falls back gracefully", () => {
    expect(toUserMessage("totally unknown")).toBe("totally unknown");
    expect(toUserMessage({})).toMatch(/something went wrong/i);
  });
});
