export const CURRENCY_CODE = 'PKR';
export const CURRENCY_SYMBOL = 'Rs.';

export function formatMoney(value) {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `PKR ${safe.toLocaleString('en-PK')}`;
}

export function formatRs(value) {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `Rs. ${safe.toLocaleString('en-PK')}`;
}
