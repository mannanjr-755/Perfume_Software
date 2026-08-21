export function camelToSnake(value) {
  return String(value).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function snakeToCamel(value) {
  return String(value).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function rowToDoc(row) {
  const doc = {};
  for (const [col, val] of Object.entries(row || {})) {
    if (col === 'id') doc._id = val;
    else doc[snakeToCamel(col)] = val;
  }
  return doc;
}

export const TABLE_COLUMNS = {
  products: [
    'name',
    'sku',
    'brand',
    'category',
    'description',
    'purchase_price',
    'price',
    'stock',
    'low_stock_threshold',
    'image',
    'status',
    'size',
    'barcode',
  ],
  orders: [
    'order_number',
    'customer_name',
    'customer_email',
    'customer_phone',
    'customer_id',
    'items',
    'subtotal',
    'discount',
    'tax',
    'total',
    'status',
    'payment_status',
    'shipping_method',
    'payment_method',
    'notes',
  ],
  customers: ['name', 'email', 'phone', 'address', 'city', 'country', 'status'],
  categories: ['name', 'description', 'status'],
  brands: ['name', 'description', 'status'],
  notifications: ['title', 'message', 'type', 'read'],
  settings: [
    'store_name',
    'store_email',
    'store_phone',
    'currency',
    'tax_rate',
    'low_stock_threshold',
    'address',
    'phone',
    'logo',
    'order_prefix',
    'notify_low_stock',
    'notify_new_order',
  ],
};

function serializeValue(table, column, value) {
  if (column === 'items') return JSON.stringify(value ?? []);
  if (column === 'barcode' && value != null) return String(value);
  if (value === undefined) return null;
  return value;
}

export function buildInsert(table, doc) {
  const allowed = TABLE_COLUMNS[table] || [];
  const columns = [];
  const values = [];
  for (const col of allowed) {
    const camel = snakeToCamel(col);
    if (doc[camel] === undefined) continue;
    columns.push(col);
    values.push(serializeValue(table, col, doc[camel]));
  }
  return { columns, values };
}

export function buildUpdate(table, doc) {
  const allowed = TABLE_COLUMNS[table] || [];
  const sets = [];
  const values = [];
  for (const col of allowed) {
    const camel = snakeToCamel(col);
    if (doc[camel] === undefined) continue;
    values.push(serializeValue(table, col, doc[camel]));
    sets.push(`${col} = $${values.length}`);
  }
  return { sets, values };
}