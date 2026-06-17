type LogContext = Record<string, unknown>;

const sensitiveKeyPattern =
  /password|senha|token|secret|key|authorization|cookie|email/i;

export function logServerError(message: string, context: LogContext = {}) {
  console.error(
    JSON.stringify({
      context: redactContext(context),
      level: "error",
      message,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function shouldLogUnexpectedActionError(formError?: string): boolean {
  return Boolean(formError?.startsWith("Nao foi possivel"));
}

function redactContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : normalizeValue(value),
    ]),
  );
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
    };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    return redactContext(value as LogContext);
  }

  return value;
}
