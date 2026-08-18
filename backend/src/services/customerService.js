import { AppError } from '../utils/AppError.js';
import { query } from '../config/database.js';
import { rowToDoc, buildInsert } from '../db/columns.js';

const MAX_ORDERS_SCAN = 5000;

function buildKey(email, phone, name) {
  return [email?.toLowerCase(), phone, name?.toLowerCase()].filter(Boolean).join('|');
}

async function loadOrderStats() {
  const res = await query(
    'SELECT id, customer_id, customer_name, customer_email, customer_phone, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT $1',
    [MAX_ORDERS_SCAN]
  );
  const orders = res.rows.map(rowToDoc);
  const stats = new Map();
  for (const order of orders) {
    const keys = new Set();
    if (order.customerId) keys.add(`id:${order.customerId}`);
    if (order.customerEmail) keys.add(`email:${order.customerEmail.toLowerCase()}`);
    if (order.customerPhone) keys.add(`phone:${order.customerPhone}`);
    if (order.customerName) keys.add(`name:${order.customerName.toLowerCase()}`);
    const amount = order.status !== 'cancelled' ? Number(order.total || 0) : 0;
    for (const key of keys) {
      const entry = stats.get(key) || { orders: new Map() };
      entry.orders.set(String(order._id), { amount, date: order.createdAt, status: order.status });
      stats.set(key, entry);
    }
  }
  return stats;
}

export async function attachStats(customer, stats) {
  const keys = [
    customer.customerId ? `id:${customer.customerId}` : null,
    customer.email ? `email:${customer.email.toLowerCase()}` : null,
    customer.phone ? `phone:${customer.phone}` : null,
    customer.name ? `name:${customer.name.toLowerCase()}` : null,
  ].filter(Boolean);
  const merged = new Map();
  for (const key of keys) {
    const entry = stats.get(key);
    if (!entry) continue;
    for (const [orderId, info] of entry.orders) {
      if (!merged.has(orderId)) merged.set(orderId, info);
    }
  }
  let totalSpending = 0;
  let lastOrder = null;
  for (const info of merged.values()) {
    totalSpending += info.amount;
    if (!lastOrder || (info.date && new Date(info.date) > new Date(lastOrder))) {
      lastOrder = info.date;
    }
  }
  return { ...customer, totalOrders: merged.size, totalSpending, lastOrder };
}

export const customerService = {
  async list(queryParams = {}) {
    const { search, status, page = 1, limit = 50 } = queryParams;
    const where = [];
    const params = [];

    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (search) {
      const escaped = String(search).replace(/[%_\\]/g, (c) => `\\${c}`);
      const fields = ['name', 'email', 'phone', 'city'];
      const ors = fields.map((field) => {
        params.push(`%${escaped}%`);
        return `${field} ILIKE $${params.length}`;
      });
      where.push(`(${ors.join(' OR ')})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);
    const [customersRes, totalRes] = await Promise.all([
      query(
        `SELECT * FROM customers ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), offset]
      ),
      query(`SELECT COUNT(*) AS total FROM customers ${whereSql}`, params),
    ]);

    const stats = await loadOrderStats();
    const items = await Promise.all(customersRes.rows.map((row) => attachStats(rowToDoc(row), stats)));
    items.sort((a, b) => (b.totalSpending || 0) - (a.totalSpending || 0));
    return { items, total: Number(totalRes.rows[0].total || 0), page: Number(page), limit: Number(limit) };
  },

  async getById(id) {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) throw new AppError('Record not found', 404);
    const res = await query('SELECT * FROM customers WHERE id = $1', [num]);
    if (!res.rows[0]) throw new AppError('Record not found', 404);
    const stats = await loadOrderStats();
    return attachStats(rowToDoc(res.rows[0]), stats);
  },

  async create(data) {
    const { columns, values } = buildInsert('customers', data);
    const res = await query(
      `INSERT INTO customers (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    );
    return rowToDoc(res.rows[0]);
  },

  async update(id, data) {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) throw new AppError('Record not found', 404);
    const fields = ['name', 'email', 'phone', 'address', 'city', 'country', 'status'];
    const sets = [];
    const values = [];
    for (const field of fields) {
      if (data[field] === undefined) continue;
      values.push(data[field]);
      sets.push(`${field} = $${values.length}`);
    }
    if (!sets.length) return this.getById(num);
    const res = await query(
      `UPDATE customers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
      [...values, num]
    );
    if (!res.rows[0]) throw new AppError('Record not found', 404);
    return rowToDoc(res.rows[0]);
  },

  async delete(id) {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) throw new AppError('Record not found', 404);
    const res = await query('DELETE FROM customers WHERE id = $1 RETURNING *', [num]);
    if (!res.rows[0]) throw new AppError('Record not found', 404);
    return rowToDoc(res.rows[0]);
  },
};