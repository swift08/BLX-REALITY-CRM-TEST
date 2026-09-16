/**
 * Server-safe logger — never prints secrets, tokens, or full request payloads.
 * In production, only errors/warnings are emitted (scrubbed).
 */

const IS_PROD = process.env.NODE_ENV === "production";

const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9\-._~+/]+=*/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*/g,
  /(service_role|anon_key|api[_-]?key|secret|password|token|refresh_token|access_token)\s*[:=]\s*["']?[^"'\s,;}]+/gi,
  /supabase\.co\/[^\s"']+/gi,
];

function scrub(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    let out = value;
    for (const pattern of SECRET_PATTERNS) {
      out = out.replace(pattern, "[REDACTED]");
    }
    return out;
  }
  if (value instanceof Error) {
    return scrub(value.message);
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|key|authorization|cookie|rawBody|headers/i.test(k)) {
        clone[k] = "[REDACTED]";
      } else {
        clone[k] = scrub(v);
      }
    }
    return clone;
  }
  return value;
}

export const safeLogger = {
  error(...args: unknown[]) {
    // eslint-disable-next-line no-console
    console.error(...args.map(scrub));
  },
  warn(...args: unknown[]) {
    // eslint-disable-next-line no-console
    console.warn(...args.map(scrub));
  },
  info(...args: unknown[]) {
    if (IS_PROD) return;
    // eslint-disable-next-line no-console
    console.info(...args.map(scrub));
  },
};
