import "server-only";

/**
 * Rate limit de janela fixa em memória.
 *
 * Trade-off: simples e sem dependências, porém o contador é POR INSTÂNCIA.
 * Em deploy com várias instâncias/serverless, troque a implementação por Redis
 * (mesma interface `limit`), ou aplique rate limit também no proxy/CDN.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    // Proteção de memória contra inundação de chaves únicas.
    if (buckets.size > MAX_KEYS) buckets.clear();
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  return {
    ok: bucket.count <= max,
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}
