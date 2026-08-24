export const LOW_STOCK_THRESHOLD = 5;

export function normalizeBarcode(input) {
  if (input == null) return '';
  let cleaned = String(input).replace(/[\s\r\n\t]+/g, '').trim().toUpperCase();
  if (cleaned.startsWith(']') && cleaned.length > 3) cleaned = cleaned.slice(3);
  cleaned = cleaned.replace(/^\*+|\*+$/g, '');
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');
  return cleaned;
}

/** USB scanners may add/drop a UPC-A leading zero versus the stored EAN-13. */
export function barcodeCandidates(input) {
  const code = normalizeBarcode(input);
  if (!code) return [];
  const out = new Set([code]);
  if (/^\d+$/.test(code)) {
    const stripped = code.replace(/^0+/, '');
    if (stripped.length >= 4) out.add(stripped);
    if (code.length === 12) out.add(`0${code}`);
    if (code.length === 13 && code.startsWith('0') && code.slice(1).length >= 4) {
      out.add(code.slice(1));
    }
  }
  return [...out].filter((value) => value.length >= 4 && value.length <= 48);
}

export function barcodesMatch(left, right) {
  const rightKeys = new Set(barcodeCandidates(right));
  return barcodeCandidates(left).some((value) => rightKeys.has(value));
}
