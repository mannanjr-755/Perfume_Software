import { createCrudService } from './crudService.js';
import { AppError } from '../utils/AppError.js';
import { query } from '../config/database.js';
import { rowToDoc } from '../db/columns.js';
import { normalizeBarcode, isValidBarcode, generateBarcode } from '../utils/barcode.js';

const base = createCrudService('products', {
  searchFields: ['name', 'brand', 'category', 'barcode', 'sku'],
});

function isDuplicateKeyError(error) {
  return error?.code === '23505';
}

function normalizeSku(input) {
  if (input == null) return undefined;
  const cleaned = String(input).replace(/[\s]+/g, '').trim().toUpperCase();
  return cleaned || undefined;
}

async function ensureUnique(field, value, excludeId, label) {
  if (!value) return undefined;
  const params = [value];
  let sql = `SELECT id FROM products WHERE ${field} = $1`;
  if (excludeId) {
    params.push(Number(excludeId));
    sql += ` AND id <> $2`;
  }
  const existing = await query(sql, params);
  if (existing.rows.length) throw new AppError(`A product with ${label} "${value}" already exists`, 400);
  return value;
}

async function ensureUniqueBarcode(barcode, excludeId) {
  if (!barcode) return undefined;
  if (!isValidBarcode(barcode)) {
    throw new AppError('Barcode must contain only letters/digits (4–48 characters)', 400);
  }
  return ensureUnique('barcode', barcode, excludeId, 'barcode');
}

function cleanPayload(data) {
  const payload = { ...data };
  payload.barcode = normalizeBarcode(payload.barcode);
  if (payload.barcode === undefined) delete payload.barcode;
  payload.sku = normalizeSku(payload.sku);
  if (payload.sku === undefined) delete payload.sku;
  if (payload.stock != null) payload.stock = Math.max(0, Number(payload.stock) || 0);
  if (payload.price != null) payload.price = Math.max(0, Number(payload.price) || 0);
  if (payload.purchasePrice != null) payload.purchasePrice = Math.max(0, Number(payload.purchasePrice) || 0);
  if (payload.lowStockThreshold != null) payload.lowStockThreshold = Math.max(0, Number(payload.lowStockThreshold) || 0);
  return payload;
}

async function create(data) {
  const payload = cleanPayload(data);
  payload.barcode = await ensureUniqueBarcode(payload.barcode);
  payload.sku = await ensureUnique('sku', payload.sku, null, 'SKU');
  try {
    return await base.create(payload);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('A product with this barcode/SKU already exists', 400);
    }
    throw error;
  }
}

async function update(id, data) {
  const payload = cleanPayload(data);
  payload.barcode = await ensureUniqueBarcode(payload.barcode, id);
  payload.sku = await ensureUnique('sku', payload.sku, id, 'SKU');
  try {
    return await base.update(id, payload);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('A product with this barcode/SKU already exists', 400);
    }
    throw error;
  }
}

async function findByBarcode(barcode) {
  const code = normalizeBarcode(barcode);
  if (!code) throw new AppError('Barcode cannot be empty', 400);
  const res = await query('SELECT * FROM products WHERE barcode = $1', [code]);
  if (!res.rows[0]) throw new AppError('No product found with this barcode', 404);
  return rowToDoc(res.rows[0]);
}

async function nextBarcode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateBarcode();
    const existing = await query('SELECT id FROM products WHERE barcode = $1', [code]);
    if (!existing.rows.length) return code;
  }
  throw new AppError('Could not generate a unique barcode, please try again', 500);
}

async function assignBarcode(id) {
  const code = await nextBarcode();
  return base.update(id, { barcode: code });
}

export const productService = {
  list: base.list,
  getById: base.getById,
  create,
  update,
  delete: base.delete,
  findByBarcode,
  nextBarcode,
  assignBarcode,
};