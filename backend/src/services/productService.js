import { createCrudService } from './crudService.js';
import { AppError } from '../utils/AppError.js';
import { query } from '../config/database.js';
import { rowToDoc } from '../db/columns.js';
import { normalizeBarcode, isValidBarcode, generateBarcode, barcodeCandidates } from '../utils/barcode.js';

const base = createCrudService('products', {
  searchFields: ['name', 'brand', 'category', 'barcode', 'sku', 'size'],
});

function isDuplicateKeyError(error) {
  return error?.code === '23505';
}

function duplicateMessage(error) {
  const constraint = String(error?.constraint || '');
  const detail = String(error?.detail || '');
  if (constraint.includes('barcode') || detail.includes('(barcode)')) {
    return 'This barcode is already assigned to another product.';
  }
  if (constraint.includes('sku') || detail.includes('(sku)')) {
    return 'A product with this SKU already exists';
  }
  return 'A product with this barcode/SKU already exists';
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
  if (existing.rows.length) {
    if (field === 'barcode') {
      throw new AppError('This barcode is already assigned to another product.', 400);
    }
    throw new AppError(`A product with ${label} "${value}" already exists`, 400);
  }
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
  if (Object.prototype.hasOwnProperty.call(data, 'barcode')) {
    payload.barcode = normalizeBarcode(data.barcode) || null;
  } else {
    delete payload.barcode;
  }
  payload.sku = normalizeSku(payload.sku);
  if (payload.sku === undefined) delete payload.sku;
  if (payload.size != null) payload.size = String(payload.size).trim();
  if (payload.stock != null) payload.stock = Math.max(0, Number(payload.stock) || 0);
  if (payload.price != null) payload.price = Math.max(0, Number(payload.price) || 0);
  if (payload.purchasePrice != null) payload.purchasePrice = Math.max(0, Number(payload.purchasePrice) || 0);
  if (payload.lowStockThreshold != null) payload.lowStockThreshold = Math.max(0, Number(payload.lowStockThreshold) || 0);
  return payload;
}

async function create(data) {
  const payload = cleanPayload(data);
  if (!payload.barcode) {
    payload.barcode = await nextBarcode();
  } else {
    payload.barcode = await ensureUniqueBarcode(payload.barcode);
  }
  payload.sku = await ensureUnique('sku', payload.sku, null, 'SKU');
  try {
    return await base.create(payload);
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AppError(duplicateMessage(error), 400);
    throw error;
  }
}

async function update(id, data) {
  const payload = cleanPayload(data);
  if (payload.barcode) {
    payload.barcode = await ensureUniqueBarcode(payload.barcode, id);
  }
  payload.sku = await ensureUnique('sku', payload.sku, id, 'SKU');
  try {
    return await base.update(id, payload);
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AppError(duplicateMessage(error), 400);
    throw error;
  }
}

async function findByBarcode(barcode) {
  const rawBarcode = String(barcode ?? '');
  const code = normalizeBarcode(rawBarcode);
  const candidates = barcodeCandidates(rawBarcode);
  const stripped = [...new Set(candidates.map((value) => value.replace(/^0+/, '')).filter((value) => value.length >= 4))];

  console.log('[barcode:lookup:backend:start]', {
    rawBarcode,
    normalizedBarcode: code,
    candidates,
  });

  if (!code) throw new AppError('Barcode cannot be empty', 400);
  if (!candidates.length) {
    console.warn('[barcode:lookup:backend:invalid]', { rawBarcode, normalizedBarcode: code });
    throw new AppError('Invalid barcode format', 400);
  }

  const res = await query(
    `SELECT * FROM products
     WHERE barcode = ANY($1::text[])
        OR UPPER(TRIM(barcode)) = ANY($1::text[])
        OR regexp_replace(UPPER(TRIM(COALESCE(barcode, ''))), '[^A-Z0-9]', '', 'g') = ANY($1::text[])
        OR regexp_replace(
             regexp_replace(UPPER(TRIM(COALESCE(barcode, ''))), '[^A-Z0-9]', '', 'g'),
             '^0+',
             ''
           ) = ANY($2::text[])
     LIMIT 1`,
    [candidates, stripped.length ? stripped : ['__none__']]
  );

  if (!res.rows[0]) {
    const sampleRows = await query(
      'SELECT id, barcode, name FROM products WHERE barcode IS NOT NULL ORDER BY id DESC LIMIT 20'
    );
    console.warn('[barcode:lookup:backend:no-match]', {
      scannedBarcode: code,
      candidates,
      sampleRows: sampleRows.rows.map((row) => ({
        id: row.id,
        barcode: row.barcode,
        name: row.name,
      })),
    });
    throw new AppError('Product Not Found', 404);
  }

  const match = res.rows[0];
  console.log('[barcode:lookup:backend:match]', {
    scannedBarcode: code,
    dbBarcode: match.barcode,
    exactMatch: match.barcode === code,
    productId: match.id,
    productName: match.name,
  });

  return rowToDoc(match);
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
