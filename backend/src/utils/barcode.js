import crypto from 'crypto';

export function normalizeBarcode(input) {
  if (input == null) return undefined;
  const cleaned = String(input).replace(/[\s\r\n\t]+/g, '').trim().toUpperCase();
  return cleaned || undefined;
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
