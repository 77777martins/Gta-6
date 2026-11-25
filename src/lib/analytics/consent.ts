/**
 * Consentimento de cookies de marketing (LGPD). Guardado só no navegador do
 * visitante; qualquer falha de armazenamento equivale a "sem resposta".
 */
export type Consent = "granted" | "denied";
const KEY = "cookie-consent-v1";
export const CONSENT_EVENT = "cookie-consent-change";

export function readConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Navegação privada/armazenamento bloqueado: vale apenas para esta visita.
  }
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: value }));
}
