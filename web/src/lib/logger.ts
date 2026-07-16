/**
 * Lightweight, structured logging layer.
 *
 * - In development everything is pretty-printed to the console.
 * - In production only `warn`/`error` are emitted, and `error` is forwarded to
 *   the pluggable error-tracking sink (see `errors.ts`).
 *
 * Use scoped loggers so every line is tagged with its subsystem:
 *
 *   const log = logger.scope("wallet");
 *   log.info("connected", { address });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isProd = process.env.NODE_ENV === "production";
const MIN_LEVEL: LogLevel = isProd ? "warn" : "debug";

export type LogContext = Record<string, unknown>;

/** Sinks receive every emitted record (used for error tracking + tx monitor). */
export type LogSink = (record: {
  level: LogLevel;
  scope: string;
  message: string;
  context?: LogContext;
  timestamp: string;
}) => void;

const sinks: LogSink[] = [];

export function addLogSink(sink: LogSink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

function emit(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const record = {
    level,
    scope,
    message,
    context,
    timestamp: new Date().toISOString(),
  };

  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      /* never let a sink break logging */
    }
  }

  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const prefix = `%c[${scope}]`;
  const style =
    level === "error"
      ? "color:#ef4444;font-weight:600"
      : level === "warn"
        ? "color:#f59e0b;font-weight:600"
        : "color:#f97316";
  const args: unknown[] = [prefix, style, message];
  if (context) args.push(context);

  // eslint-disable-next-line no-console
  (console[level === "debug" ? "log" : level] as (...a: unknown[]) => void)(...args);
}

export interface ScopedLogger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  scope: (child: string) => ScopedLogger;
}

function makeLogger(scope: string): ScopedLogger {
  return {
    debug: (m, c) => emit("debug", scope, m, c),
    info: (m, c) => emit("info", scope, m, c),
    warn: (m, c) => emit("warn", scope, m, c),
    error: (m, c) => emit("error", scope, m, c),
    scope: (child) => makeLogger(`${scope}:${child}`),
  };
}

export const logger = makeLogger("aegis");
