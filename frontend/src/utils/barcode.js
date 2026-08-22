export const LOW_STOCK_THRESHOLD = 5;

export function normalizeBarcode(input) {
  if (input == null) return '';
  let cleaned = String(input).replace(/[\s\r\n\t]+/g, '').trim().toUpperCase();
  if (cleaned.startsWith(']') && cleaned.length > 3) cleaned = cleaned.slice(3);
  cleaned = cleaned.replace(/^\*+|\*+$/g, '');
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');
  return cleaned;
}
