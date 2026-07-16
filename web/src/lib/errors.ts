/**
 * Error normalisation + a pluggable error-tracking abstraction.
 *
 * Blockchain errors are notoriously cryptic (`HostError: Error(Contract, #5)`).
 * This module turns them into human-readable, actionable messages and provides
 * a single seam (`captureException`) where a real provider (Sentry, Highlight,
 * etc.) can be wired in without touching call sites.
 */

import { logger } from "./logger";

const log = logger.scope("errors");

/* ------------------------- error tracking sink --------------------------- */

export interface ErrorTracker {
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
}

let tracker: ErrorTracker | null = null;

/** Wire a real provider once, e.g. in a client provider during bootstrap. */
export function setErrorTracker(impl: ErrorTracker) {
  tracker = impl;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  log.error(error instanceof Error ? error.message : String(error), context);
  tracker?.captureException(error, context);
}

/* ----------------------------- app errors -------------------------------- */

export type AppErrorCode =
  | "WALLET_UNAVAILABLE"
  | "WALLET_REJECTED"
  | "INSUFFICIENT_BALANCE"
  | "NETWORK_MISMATCH"
  | "CONTRACT_ERROR"
  | "SIMULATION_FAILED"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

export class AppError extends Error {
  code: AppErrorCode;
  /** The original error, kept for tracking. */
  cause?: unknown;
  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

/* -------------------- on-chain contract error tables --------------------- */

const ESCROW_ERRORS: Record<number, string> = {
  1: "This contract has already been initialized.",
  2: "The escrow contract is not initialized yet.",
  3: "That escrow could not be found.",
  4: "You are not authorized to perform this action.",
  5: "This action isn't allowed in the escrow's current state.",
  6: "Amounts must be greater than zero, and at least one milestone is required.",
  7: "That milestone does not exist.",
  8: "That milestone has already been released.",
  9: "The platform fee is outside the allowed range (max 10%).",
  10: "The deadline must be in the future.",
  11: "The dispute split must be between 0% and 100%.",
  12: "Buyer and seller must be different accounts.",
};

const REGISTRY_ERRORS: Record<number, string> = {
  1: "The registry has already been initialized.",
  2: "The registry is not initialized yet.",
  3: "Only the registered escrow contract may perform this action.",
  4: "No reputation record exists for that account.",
  5: "Withdrawal exceeds the collected fee balance.",
  6: "Amounts must be greater than zero.",
};

/** Extract the numeric contract error code from a host error string. */
function extractContractCode(message: string): number | null {
  // Matches `Error(Contract, #5)`, `Contract, #5`, `#5`, `code: 5`.
  const m =
    message.match(/Error\(Contract,\s*#?(\d+)\)/) ??
    message.match(/Contract Error[:\s]+#?(\d+)/i) ??
    message.match(/#(\d+)/);
  return m && m[1] ? Number(m[1]) : null;
}

/**
 * Convert any thrown value into a friendly, user-facing message.
 *
 * @param contract — which contract was being called, to pick the right code table.
 */
export function toUserMessage(
  error: unknown,
  contract: "escrow" | "registry" = "escrow",
): string {
  if (error instanceof AppError) return error.message;

  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const lower = raw.toLowerCase();

  // Wallet / signing layer.
  if (lower.includes("user declined") || lower.includes("rejected") || lower.includes("denied"))
    return "You rejected the request in your wallet.";
  if (lower.includes("not available") || lower.includes("no wallet") || lower.includes("not installed"))
    return "That wallet isn't available. Please install or unlock it and try again.";
  if (lower.includes("insufficient") && lower.includes("balance"))
    return "Insufficient balance to cover this transaction.";
  if (lower.includes("txbadseq") || lower.includes("bad sequence"))
    return "Transaction sequence was out of date — please retry.";
  if (lower.includes("network") && (lower.includes("mismatch") || lower.includes("passphrase")))
    return "Your wallet is on a different network. Switch networks and retry.";

  // On-chain contract error code.
  const code = extractContractCode(raw);
  if (code !== null) {
    const table = contract === "registry" ? REGISTRY_ERRORS : ESCROW_ERRORS;
    if (table[code]) return table[code];
    return `The contract rejected this transaction (code #${code}).`;
  }

  if (lower.includes("simulation"))
    return "The transaction simulation failed. The action may not be valid right now.";

  return raw || "Something went wrong. Please try again.";
}

/** Normalise + track, returning an `AppError` ready to surface in the UI. */
export function handleError(
  error: unknown,
  context: { scope: string; contract?: "escrow" | "registry" } & Record<string, unknown>,
): AppError {
  const message = toUserMessage(error, context.contract);
  captureException(error, context);
  const code: AppErrorCode = error instanceof AppError ? error.code : "CONTRACT_ERROR";
  return new AppError(code, message, error);
}
