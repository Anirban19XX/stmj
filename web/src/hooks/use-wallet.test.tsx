import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const walletMocks = vi.hoisted(() => ({
  connectWithModal: vi.fn(),
  reconnect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@/lib/stellar/wallet", () => walletMocks);

import { useWallet } from "./use-wallet";
import { useWalletStore } from "@/stores/wallet-store";

describe("useWallet", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWalletStore.setState({
      address: null,
      walletId: null,
      walletName: null,
      status: "idle",
      network: "testnet",
      error: null,
    });
  });

  it("restores a persisted wallet session once wallet state becomes available", async () => {
    const restoreSpy = vi
      .spyOn(useWalletStore.getState(), "restore")
      .mockResolvedValue(undefined);

    const { unmount } = renderHook(() => useWallet());

    expect(restoreSpy).not.toHaveBeenCalled();

    act(() => {
      useWalletStore.setState({ walletId: "freighter" });
    });

    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledTimes(1);
    });

    unmount();
  });
});
