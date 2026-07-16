import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectWithModal: vi.fn(),
  reconnect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@/lib/stellar/wallet", () => mocks);

const { useWalletStore } = await import("./wallet-store");

describe("wallet-store (connection flow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.setState({
      address: null,
      walletId: null,
      walletName: null,
      status: "idle",
      error: null,
    });
  });

  it("connects and stores the account", async () => {
    mocks.connectWithModal.mockResolvedValue({
      address: "GTEST",
      walletId: "freighter",
      walletName: "Freighter",
    });

    await useWalletStore.getState().connect();

    const s = useWalletStore.getState();
    expect(s.address).toBe("GTEST");
    expect(s.walletName).toBe("Freighter");
    expect(s.status).toBe("connected");
    expect(s.error).toBeNull();
  });

  it("records a friendly error when the user rejects", async () => {
    mocks.connectWithModal.mockRejectedValue(new Error("User declined"));

    await expect(useWalletStore.getState().connect()).rejects.toBeTruthy();
    const s = useWalletStore.getState();
    expect(s.status).toBe("idle");
    expect(s.error).toMatch(/rejected/i);
  });

  it("disconnects and clears the session", () => {
    useWalletStore.setState({
      address: "GTEST",
      walletId: "freighter",
      status: "connected",
    });
    useWalletStore.getState().disconnect();
    expect(mocks.disconnect).toHaveBeenCalled();
    expect(useWalletStore.getState().address).toBeNull();
    expect(useWalletStore.getState().status).toBe("idle");
  });

  it("signs via the wallet service when connected", async () => {
    mocks.signTransaction.mockResolvedValue("SIGNED_XDR");
    useWalletStore.setState({ address: "GTEST", status: "connected" });
    const signed = await useWalletStore.getState().sign("UNSIGNED");
    expect(signed).toBe("SIGNED_XDR");
    expect(mocks.signTransaction).toHaveBeenCalledWith("UNSIGNED", "GTEST");
  });

  it("refuses to sign without a wallet", async () => {
    await expect(useWalletStore.getState().sign("X")).rejects.toThrow(/connect/i);
  });
});
