export const LOW_STOCK_THRESHOLD = 5;

export function normalizeBarcode(input) {
  if (input == null) return '';
  return String(input).replace(/[\s\r\n\t]+/g, '').trim().toUpperCase();
}
