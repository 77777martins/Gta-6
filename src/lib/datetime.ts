/**
 * Data no formato exigido pelo Mercado Pago, no horário de Brasília:
 * "2026-11-25T18:30:00.000-03:00". O Brasil não tem horário de verão desde 2019,
 * então o deslocamento é fixo em -03:00.
 */
export function toSaoPauloIso(date: Date): string {
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().replace("Z", "-03:00");
}
