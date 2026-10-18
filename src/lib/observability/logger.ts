type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";
type Fields = Record<string, unknown>;

const SENSITIVE_KEY = /token|secret|password|authorization|api[-_]?key|credential|cookie/i;

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : value;
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
