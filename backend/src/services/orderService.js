import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Notification from '../models/Notification.js';
import Settings from '../models/Settings.js';
import { createCrudService } from './crudService.js';
import { AppError } from '../utils/AppError.js';

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const base = createCrudService(Order, {
  searchFields: ['customerName', 'customerEmail', 'customerPhone'],
});

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toQuantity(value) {
  const qty = Number(value);
  return Number.isInteger(qty) && qty >= 1 ? qty : null;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    productId: item.productId,
    productName: String(item.productName || item.name || 'Product'),
    brand: String(item.brand || ''),
    category: String(item.category || ''),
    description: String(item.description || ''),
    image: String(item.image || ''),
    barcode: String(item.barcode || ''),
    quantity: item.quantity,
    price: Number(item.price || 0),
  }));
}

async function getSettings() {
  const settings = await Settings.findOne();
  return settings || null;
}

async function getTaxRate() {
  const settings = await getSettings();
  return Number(settings?.taxRate) || 0;
}

async function getLowStockThreshold() {
  const settings = await getSettings();
  return Number(settings?.lowStockThreshold) ?? DEFAULT_LOW_STOCK_THRESHOLD;
}

function computeTotals(items, discount, taxRate) {
  const subtotal = round2(
    items.reduce((sum, item) => sum + item.price * (Number(item.quantity) || 0), 0)
  );
  const disc = round2(Math.min(Math.max(Number(discount) || 0, 0), subtotal));
  const tax = round2((subtotal - disc) * (taxRate / 100));
  const total = round2(subtotal - disc + tax);
  return { subtotal, discount: disc, tax, total };
}

async function maybeNotifyLowStock(product) {
  const threshold = await getLowStockThreshold();
  if (product.stock > threshold) return;
  const settings = await getSettings();
  if (settings?.notifyLowStock === false) return;
  const out = product.stock === 0;
  const title = out ? 'Out of stock' : 'Low stock';
  const message = out
    ? `${product.name} is out of stock.`
    : `${product.name} is low on stock (${product.stock} left).`;
  const existing = await Notification.findOne({ title, message, read: false });
  if (existing) return;
  await Notification.create({ title, message, type: out ? 'error' : 'warning' });
}

async function notifyOrderEvent(kind, order) {
  const settings = await getSettings();
  if (settings?.notifyNewOrder === false && kind !== 'cancelled') return;
  let title;
  let message;
  let type = 'info';
  if (kind === 'created') {
    title = 'New order';
    message = `Order #${String(order._id).slice(-8).toUpperCase()} for ${order.customerName} — ${order.total}`;
    type = 'info';
  } else if (kind === 'delivered') {
    title = 'Order completed';
    message = `Order #${String(order._id).slice(-8).toUpperCase()} for ${order.customerName} was completed.`;
    type = 'success';
  } else if (kind === 'cancelled') {
    title = 'Order cancelled';
    message = `Order #${String(order._id).slice(-8).toUpperCase()} for ${order.customerName} was cancelled.`;
    type = 'error';
  }
  if (!title) return;
  const existing = await Notification.findOne({ title, message, read: false });
  if (existing) return;
  await Notification.create({ title, message, type });
}

async function upsertCustomerFromOrder(order) {
  if (order.customerId) return order;
  const email = order.customerEmail?.trim();
  const phone = order.customerPhone?.trim();
  const name = order.customerName?.trim();
  if (!email && !phone && (!name || name.toLowerCase() === 'walk-in customer')) return order;
  const query = email ? { email } : phone ? { phone } : { name };
  let customer = await Customer.findOne(query);
  if (!customer) {
    customer = await Customer.create({
      name: name || 'Walk-in Customer',
      email: email || '',
      phone: phone || '',
    });
  }
  if (!order.customerId || String(order.customerId) !== String(customer._id)) {
    order.customerId = customer._id;
    await order.save();
  }
  return order;
}

async function deductStockForItems(items, deducted) {
  const acc = Array.isArray(deducted) ? deducted : [];
  for (const item of items) {
    const quantity = toQuantity(item.quantity);
    if (!item.productId) throw new AppError(`Missing product for "${item.productName}"`, 400);
    if (quantity === null) throw new AppError(`Invalid quantity for "${item.productName}"`, 400);

    const product = await Product.findById(item.productId);
    if (!product) throw new AppError(`Product "${item.productName}" no longer exists`, 400);
    if ((product.stock ?? 0) < quantity) {
      throw new AppError(
        `Not enough stock for "${product.name}". Available: ${product.stock}`,
        400
      );
    }

    const updated = await Product.findOneAndUpdate(
      { _id: product._id, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true }
    );
    if (!updated) {
      throw new AppError(`Not enough stock for "${product.name}". Available: ${product.stock}`, 400);
    }
    acc.push({ productId: item.productId, quantity });
    await maybeNotifyLowStock(updated);
  }
  return acc;
}

async function rollbackStock(deducted) {
  for (const { productId, quantity } of deducted) {
    await Product.findOneAndUpdate({ _id: productId }, { $inc: { stock: quantity } });
  }
}

async function restoreStockForItems(items) {
  const restored = [];
  for (const item of items) {
    const quantity = toQuantity(item.quantity);
    if (!item.productId || quantity === null) continue;
    await Product.findOneAndUpdate(
      { _id: item.productId },
      { $inc: { stock: quantity } }
    );
    restored.push({ productId: item.productId, quantity });
  }
  return restored;
}

async function create(data) {
  const items = normalizeItems(data.items);
  if (!items.length) throw new AppError('Order must contain at least one product', 400);

  let deducted = [];
  try {
    await deductStockForItems(items, deducted);
  } catch (error) {
    await rollbackStock(deducted);
    throw error;
  }

  const taxRate = await getTaxRate();
  const totals = computeTotals(items, data.discount, taxRate);
  const paymentStatus = data.paymentStatus || (data.status === 'delivered' ? 'paid' : 'pending');

  const payload = {
    ...data,
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    paymentStatus,
  };

  let order;
  try {
    order = await base.create(payload);
  } catch (error) {
    await rollbackStock(deducted);
    throw error;
  }

  await upsertCustomerFromOrder(order);
  await notifyOrderEvent(order.status === 'delivered' ? 'delivered' : 'created', order);
  return order;
}

async function update(id, data) {
  const order = await Order.findById(id);
  if (!order) throw new AppError('Record not found', 404);

  const wasActive = order.status !== 'cancelled';
  const newStatus = data.status || order.status;
  const items = normalizeItems(data.items);
  const effectiveItems = items.length ? items : order.items;

  // An active order already had its items' stock deducted. To modify it we must
  // give that stock back first and then deduct for the new item set. If anything
  // fails after the restore, we re-deduct the ORIGINAL items so the stock in the
  // database always matches the stored order.
  let restored = [];
  let payload;

  try {
    if (wasActive) {
      restored = await restoreStockForItems(order.items);
    }

    if (newStatus === 'cancelled') {
      payload = { ...data, items: effectiveItems, status: 'cancelled' };
    } else {
      let deducted = [];
      try {
        await deductStockForItems(effectiveItems, deducted);
      } catch (error) {
        await rollbackStock(deducted);
        throw error;
      }
      const taxRate = await getTaxRate();
      const discount = data.discount ?? order.discount ?? 0;
      const totals = computeTotals(effectiveItems, discount, taxRate);
      payload = {
        ...data,
        items: effectiveItems,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        status: newStatus,
      };
    }

    if (payload.paymentStatus === undefined) {
      payload.paymentStatus = newStatus === 'delivered' ? 'paid' : order.paymentStatus || 'pending';
    }

    const updated = await base.update(id, payload);
    restored = [];

    if (order.status !== 'cancelled' && newStatus === 'cancelled') {
      await notifyOrderEvent('cancelled', updated);
    } else if (order.status !== newStatus && newStatus === 'delivered') {
      await notifyOrderEvent('delivered', updated);
    }

    return updated;
  } catch (error) {
    if (restored.length) {
      try {
        await deductStockForItems(restored);
      } catch (rollbackError) {
        console.error('[Order] Failed to re-deduct stock after update failure:', rollbackError.message);
      }
    }
    throw error;
  }
}

async function remove(id) {
  const order = await Order.findById(id);
  if (!order) throw new AppError('Record not found', 404);
  if (order.status === 'cancelled') return base.delete(id);

  const restored = await restoreStockForItems(order.items);
  try {
    return await base.delete(id);
  } catch (error) {
    try {
      await deductStockForItems(restored);
    } catch (rollbackError) {
      console.error('[Order] Failed to re-deduct stock after delete failure:', rollbackError.message);
    }
    throw error;
  }
}

export const orderService = {
  list: base.list,
  getById: base.getById,
  create,
  update,
  delete: remove,
};
