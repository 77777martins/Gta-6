/**
 * IDs públicos dos pixels de anúncio (não são segredos: ficam visíveis no site).
 * Validados por formato para que um valor mal digitado nunca injete nada na página.
 */
const META_PIXEL_ID = /^\d{10,20}$/;
const TIKTOK_PIXEL_ID = /^[A-Z0-9]{10,30}$/;

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

export function parseMetaPixelId(value: string | undefined): string | null {
  const id = clean(value);
  return META_PIXEL_ID.test(id) ? id : null;
}

export function parseTikTokPixelId(value: string | undefined): string | null {
  const id = clean(value).toUpperCase();
  return TIKTOK_PIXEL_ID.test(id) ? id : null;
}

export const ANALYTICS = {
  metaPixelId: parseMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID),
  tiktokPixelId: parseTikTokPixelId(process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID),
} as const;

export const hasAnyPixel = Boolean(ANALYTICS.metaPixelId || ANALYTICS.tiktokPixelId);
