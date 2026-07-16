/**
 * Low-level Soroban RPC client.
 *
 * Three responsibilities:
 *  1. `simulateRead`  — invoke a view function and decode its return value.
 *  2. `buildInvokeTx` — assemble + prepare (simulate, add footprint & resource
 *                       fees) a write transaction for wallet signing.
 *  3. `submitSignedTx`— submit a signed XDR and poll to confirmation.
 *
 * This is the only module that talks to the RPC server directly.
 */

import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { logger } from "@/lib/logger";

const log = logger.scope("rpc");

export const server = new rpc.Server(config.rpcUrl, {
  allowHttp: config.network === "local",
});

// A throwaway source account is sufficient for read-only simulation; no funds
// or signatures are required.
const READ_PUBKEY = Keypair.random().publicKey();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TransactionPreview {
  baseFee: string;
  resourceFee: string;
  estimatedFee: string;
  instructions: number;
  readBytes: number;
  writeBytes: number;
  footprintEntries: number;
}

type PreviewResourceLike = {
  instructions?: number | (() => number);
  readBytes?: number | (() => number);
  writeBytes?: number | (() => number);
  footprint?:
    | {
        readOnly?: unknown[] | (() => unknown[]);
        readWrite?: unknown[] | (() => unknown[]);
      }
    | (() => {
        readOnly?: unknown[] | (() => unknown[]);
        readWrite?: unknown[] | (() => unknown[]);
      });
};

type PreviewTransactionDataLike = {
  build?: () => { resources?: () => PreviewResourceLike };
  resources?: PreviewResourceLike | (() => PreviewResourceLike);
};

function readPreviewValue<T>(value: T | (() => T) | undefined, fallback: T): T {
  if (typeof value === "function") {
    return (value as () => T)();
  }
  return value ?? fallback;
}

export function buildTransactionPreview(
  simulation: {
    minResourceFee?: string;
    transactionData?: PreviewTransactionDataLike;
  },
  baseFee: string = BASE_FEE.toString(),
): TransactionPreview {
  const resourceFee = BigInt(simulation.minResourceFee ?? "0");
  const baseFeeValue = BigInt(baseFee ?? "0");
  const txData = simulation.transactionData;
  const resolvedResources = txData?.build
    ? txData.build().resources?.()
    : typeof txData?.resources === "function"
      ? (txData.resources as () => PreviewResourceLike)()
      : txData?.resources;

  const resources = resolvedResources ?? {};
  const footprint = readPreviewValue(resources.footprint, undefined);
  const readOnlyEntries = readPreviewValue(footprint?.readOnly, []);
  const readWriteEntries = readPreviewValue(footprint?.readWrite, []);
  const footprintEntries =
    (Array.isArray(readOnlyEntries) ? readOnlyEntries.length : 0) +
    (Array.isArray(readWriteEntries) ? readWriteEntries.length : 0);

  return {
    baseFee: baseFeeValue.toString(),
    resourceFee: resourceFee.toString(),
    estimatedFee: (baseFeeValue + resourceFee).toString(),
    instructions: readPreviewValue(resources.instructions, 0),
    readBytes: readPreviewValue(resources.readBytes, 0),
    writeBytes: readPreviewValue(resources.writeBytes, 0),
    footprintEntries,
  };
}

/** Invoke a view function and return its decoded native value. */
export async function simulateRead<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(new Account(READ_PUBKEY, "0"), {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const retval = sim.result?.retval;
  return (retval ? scValToNative(retval) : undefined) as T;
}

/**
 * Build + prepare a write transaction. Returns the unsigned, fully-assembled
 * transaction XDR ready to hand to the wallet for signing.
 */
export async function buildInvokeTx(
  contractId: string,
  publicKey: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<{ xdr: string; preview: TransactionPreview }> {
  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  const preview = buildTransactionPreview(sim, BASE_FEE.toString());

  // `prepareTransaction` simulates and injects the Soroban footprint + resource
  // fees. If the simulation reverts, this throws with the contract error.
  const prepared = await server.prepareTransaction(tx);
  return { xdr: prepared.toXDR(), preview };
}

export interface SubmitResult {
  hash: string;
  returnValue: unknown;
}

/** Submit a signed transaction XDR and poll until it confirms or fails. */
export async function submitSignedTx(
  signedXdr: string,
  { timeoutMs = 60_000, intervalMs = 1_500 } = {},
): Promise<SubmitResult> {
  const tx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const sent = await server.sendTransaction(tx);

  if (sent.status === "ERROR") {
    log.error("sendTransaction rejected", { status: sent.status });
    throw new Error(
      sent.errorResult?.result().switch().name ?? "Transaction submission failed.",
    );
  }

  const hash = sent.hash;
  const deadline = Date.now() + timeoutMs;
  let result = await server.getTransaction(hash);

  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for transaction ${hash} to confirm.`);
    }
    await sleep(intervalMs);
    result = await server.getTransaction(hash);
  }

  if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
    log.error("transaction failed on-chain", { hash });
    throw new Error(`Error(Contract, ${describeFailure(result)})`);
  }

  const returnValue =
    result.status === rpc.Api.GetTransactionStatus.SUCCESS && result.returnValue
      ? scValToNative(result.returnValue)
      : null;

  log.info("transaction confirmed", { hash });
  return { hash, returnValue };
}

function describeFailure(result: rpc.Api.GetFailedTransactionResponse): string {
  try {
    return result.resultXdr.result().switch().name;
  } catch {
    return "failed";
  }
}

/** Thin wrapper over `getEvents`, used by the event stream. */
export async function getContractEvents(params: {
  startLedger: number;
  contractIds: string[];
  limit?: number;
  cursor?: string;
}): Promise<rpc.Api.GetEventsResponse> {
  return server.getEvents({
    startLedger: params.cursor ? undefined : params.startLedger,
    cursor: params.cursor,
    filters: [
      {
        type: "contract",
        contractIds: params.contractIds.filter(Boolean),
      },
    ],
    limit: params.limit ?? 100,
  });
}

/** Current latest ledger sequence — the starting point for the event stream. */
export async function getLatestLedger(): Promise<number> {
  const { sequence } = await server.getLatestLedger();
  return sequence;
}
