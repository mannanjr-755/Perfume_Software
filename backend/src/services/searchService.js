import { query } from '../config/database.js';
import { rowToDoc } from '../db/columns.js';
import { camelToSnake } from '../db/columns.js';

const DEFAULT_LIMIT = 8;

function escapeLike(value) {
  return String(value).replace(/[%_\\]/g, (c) => `\\${c}`);
}

async function searchTable(table, q, fields, limit = DEFAULT_LIMIT) {
  const columns = fields.map(camelToSnake);
  const ors = columns.map((field) => `${field} ILIKE $1`);
  const res = await query(
    `SELECT * FROM ${table} WHERE (${ors.join(' OR ')}) ORDER BY created_at DESC LIMIT $2`,
    [`%${escapeLike(q)}%`, limit]
  );
  return res.rows.map(rowToDoc);
}

export async function searchAll(queryStr) {
  const q = String(queryStr || '').trim();
  if (!q) {
    return { products: [], orders: [], customers: [], categories: [], brands: [] };
  }

  const [products, orders, customers, categories, brands] = await Promise.all([
    searchTable('products', q, ['name', 'brand', 'category', 'barcode', 'sku']),
    searchTable('orders', q, ['orderNumber', 'customerName', 'customerEmail', 'customerPhone']),
    searchTable('customers', q, ['name', 'email', 'phone', 'city']),
    searchTable('categories', q, ['name', 'description']),
    searchTable('brands', q, ['name', 'description']),
  ]);

  return { products, orders, customers, categories, brands };
}