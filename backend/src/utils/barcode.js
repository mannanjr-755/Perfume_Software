import crypto from 'crypto';

export function normalizeBarcode(input) {
  if (input == null) return undefined;
  let cleaned = String(input).replace(/[\s\r\n\t]+/g, '').trim().toUpperCase();
  if (cleaned.startsWith(']') && cleaned.length > 3) cleaned = cleaned.slice(3);
  cleaned = cleaned.replace(/^\*+|\*+$/g, '');
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');
  return cleaned || undefined;
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

export function isValidBarcode(value) {
  return typeof value === 'string' && /^[A-Z0-9]{4,48}$/.test(value);
}

export function generateBarcode() {
  let code = '';
  for (let i = 0; i < 12; i += 1) code += String(crypto.randomInt(0, 10));
  const digits = code.split('').map(Number);
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return `${code}${check}`;
}
