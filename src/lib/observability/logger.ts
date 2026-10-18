type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";
type Fields = Record<string, unknown>;

const SENSITIVE_KEY = /token|secret|password|authorization|api[-_]?key|credential|cookie/i;

const SENSITIVE_VALUE = /(Bearer\s+)[\w.-]+|AIza[\w-]{20,}|csk-[\w-]{10,}/g;

export function redact(fields: Fields, depth = 0): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) out[key] = "[redacted]";
    else if (typeof value === "string") out[key] = value.replace(SENSITIVE_VALUE, "[redacted]");
    else if (value && typeof value === "object" && !Array.isArray(value) && depth < 4) out[key] = redact(value as Fields, depth + 1);
    else out[key] = value;
  }
  return out;
}

// Cloud Logging parses one JSON object per stdout/stderr line and maps `severity`/`message`.
function write(severity: Severity, message: string, fields: Fields = {}): void {
  const entry = JSON.stringify({ severity, message, timestamp: new Date().toISOString(), ...redact(fields) });
  if (severity === "ERROR" || severity === "WARNING") console.error(entry);
  else console.log(entry);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("DEBUG", message, fields),
  info: (message: string, fields?: Fields) => write("INFO", message, fields),
  warn: (message: string, fields?: Fields) => write("WARNING", message, fields),
  error: (message: string, fields?: Fields) => write("ERROR", message, fields),
};

export function describeError(error: unknown): Fields {
  if (error instanceof Error) return { errorName: error.name, errorMessage: error.message };
  return { errorName: "UnknownError" };
}
