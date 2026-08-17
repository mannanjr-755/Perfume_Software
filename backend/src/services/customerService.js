import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';

const MAX_ORDERS_SCAN = 5000;

function buildKey(email, phone, name) {
  return [email?.toLowerCase(), phone, name?.toLowerCase()].filter(Boolean).join('|');
}

async function loadOrderStats() {
  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(MAX_ORDERS_SCAN)
    .select('customerId customerName customerEmail customerPhone total status createdAt')
    .lean();
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
  async list(query = {}) {
    const { search, status, page = 1, limit = 50 } = query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = ['name', 'email', 'phone', 'city'].map((field) => ({
        [field]: { $regex: search, $options: 'i' },
      }));
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Customer.countDocuments(filter),
    ]);
    const stats = await loadOrderStats();
    const items = await Promise.all(customers.map((customer) => attachStats(customer, stats)));
    items.sort((a, b) => (b.totalSpending || 0) - (a.totalSpending || 0));
    return { items, total, page: Number(page), limit: Number(limit) };
  },

  async getById(id) {
    const customer = await Customer.findById(id).lean();
    if (!customer) throw new AppError('Record not found', 404);
    const stats = await loadOrderStats();
    return attachStats(customer, stats);
  },

  create: (data) => Customer.create(data),
  update: async (id, data) => {
    const item = await Customer.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!item) throw new AppError('Record not found', 404);
    return item;
  },
  delete: async (id) => {
    const item = await Customer.findByIdAndDelete(id);
    if (!item) throw new AppError('Record not found', 404);
    return item;
  },
};
