/**
 * Shared write path for contract services: build → sign → submit.
 * Signing is injected so the service layer stays free of wallet/UI concerns.
 */

import { xdr } from "@stellar/stellar-sdk";
import {
  buildInvokeTx,
  submitSignedTx,
  type SubmitResult,
  type TransactionPreview,
} from "../client";

/** Signs an unsigned transaction XDR, returning the signed XDR. */
export type Signer = (unsignedXdr: string) => Promise<string>;

export async function previewContractInvoke(
  contractId: string,
  publicKey: string,
  method: string,
  args: xdr.ScVal[],
): Promise<TransactionPreview> {
  const prepared = await buildInvokeTx(contractId, publicKey, method, args);
  return prepared.preview;
}

export async function invokeContract(
  contractId: string,
  publicKey: string,
  method: string,
  args: xdr.ScVal[],
  sign: Signer,
): Promise<SubmitResult> {
  const unsigned = await buildInvokeTx(contractId, publicKey, method, args);
  const signed = await sign(unsigned.xdr);
  return submitSignedTx(signed);
}
