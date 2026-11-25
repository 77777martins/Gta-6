import "server-only";

/**
 * Logger estruturado (JSON por linha) com redação de dados sensíveis.
 * Nunca registre CPF, e-mail completo, tokens ou payloads brutos de pagamento.
 */
type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SENSITIVE_KEY = /(token|secret|password|authorization|cpf|cookie|signature)/i;

function redact(ctx: Context): Context {
  const out: Context = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (SENSITIVE_KEY.test(key)) out[key] = "[REDACTED]";
    else if (value instanceof Error) out[key] = { name: value.name, message: value.message };
    else out[key] = value;
  }
  return out;
}

function write(level: Level, message: string, ctx: Context = {}) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...redact(ctx) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, ctx?: Context) => write("info", message, ctx),
  warn: (message: string, ctx?: Context) => write("warn", message, ctx),
  error: (message: string, ctx?: Context) => write("error", message, ctx),
};

/** "joao.silva@gmail.com" -> "jo***@gmail.com" */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}
