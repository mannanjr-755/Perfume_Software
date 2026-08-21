import { createCrudService } from './crudService.js';
import { AppError } from '../utils/AppError.js';
import { query, withTransaction } from '../config/database.js';
import { rowToDoc, buildInsert, buildUpdate } from '../db/columns.js';

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const base = createCrudService('orders', {
  searchFields: ['customerName', 'customerEmail', 'customerPhone'],
});

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toQuantity(value) {
  const qty = Number(value);
  return Number.isInteger(qty) && qty >= 1 ? qty : null;
}

function dbQuery(client, text, params) {
  return client ? client.query(text, params) : query(text, params);
}

function lineFromProduct(product, quantity) {
  return {
    productId: product._id,
    productName: String(product.name || 'Product'),
    brand: String(product.brand || ''),
    category: String(product.category || ''),
    description: String(product.description || ''),
    image: String(product.image || ''),
    barcode: String(product.barcode || ''),
    size: String(product.size || ''),
    quantity,
    price: Number(product.price) || 0,
  };
}

function requestedQuantities(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new AppError('Order must contain at least one product', 400);
  }
  const grouped = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = toQuantity(item.quantity);
    if (!productId) throw new AppError(`Missing product for "${item.productName || 'item'}"`, 400);
    if (quantity === null) throw new AppError(`Invalid quantity for "${item.productName || 'item'}"`, 400);
    grouped.set(productId, (grouped.get(productId) || 0) + quantity);
  }
  return grouped;
}

async function getSettings(client) {
  const res = await dbQuery(client, 'SELECT * FROM settings ORDER BY id LIMIT 1', []);
  return res.rows[0] ? rowToDoc(res.rows[0]) : null;
}

async function getTaxRate(client) {
  const settings = await getSettings(client);
  return Number(settings?.taxRate) || 0;
}

async function getLowStockThreshold(client) {
  const settings = await getSettings(client);
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

async function maybeNotifyLowStock(product, client) {
  const threshold = await getLowStockThreshold(client);
  if (product.stock > threshold) return;
  const settings = await getSettings(client);
  if (settings?.notifyLowStock === false) return;
  const out = product.stock === 0;
  const title = out ? 'Out of stock' : 'Low stock';
  const message = out
    ? `${product.name} is out of stock.`
    : `${product.name} is low on stock (${product.stock} left).`;
  const existing = await dbQuery(
    client,
    'SELECT id FROM notifications WHERE title = $1 AND message = $2 AND read = FALSE LIMIT 1',
    [title, message]
  );
  if (existing.rows.length) return;
  await dbQuery(client, 'INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)', [
    title,
    message,
    out ? 'error' : 'warning',
  ]);
}

async function notifyOrderEvent(kind, order, client) {
  const settings = await getSettings(client);
  if (settings?.notifyNewOrder === false && kind !== 'cancelled') return;
  const orderRef = order.orderNumber || `#${order._id}`;
  let title;
  let message;
  let type = 'info';
  if (kind === 'created') {
    title = 'New order';
    message = `${orderRef} for ${order.customerName} — ${order.total}`;
    type = 'info';
  } else if (kind === 'delivered') {
    title = 'Order completed';
    message = `${orderRef} for ${order.customerName} was completed.`;
    type = 'success';
  } else if (kind === 'cancelled') {
    title = 'Order cancelled';
    message = `${orderRef} for ${order.customerName} was cancelled.`;
    type = 'error';
  }
  if (!title) return;
  const existing = await dbQuery(
    client,
    'SELECT id FROM notifications WHERE title = $1 AND message = $2 AND read = FALSE LIMIT 1',
    [title, message]
  );
  if (existing.rows.length) return;
  await dbQuery(client, 'INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)', [
    title,
    message,
    type,
  ]);
}

async function upsertCustomerFromOrder(order, client) {
  if (order.customerId) return order;
  const email = order.customerEmail?.trim();
  const phone = order.customerPhone?.trim();
  const name = order.customerName?.trim();
  if (!email && !phone && (!name || name.toLowerCase() === 'walk-in customer')) return order;

  let customer;
  if (email) {
    const res = await dbQuery(client, 'SELECT * FROM customers WHERE email = $1 LIMIT 1', [email]);
    customer = res.rows[0];
  } else if (phone) {
    const res = await dbQuery(client, 'SELECT * FROM customers WHERE phone = $1 LIMIT 1', [phone]);
    customer = res.rows[0];
  } else {
    const res = await dbQuery(client, 'SELECT * FROM customers WHERE name = $1 LIMIT 1', [name]);
    customer = res.rows[0];
  }

  if (!customer) {
    const ins = await dbQuery(
      client,
      'INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name || 'Walk-in Customer', email || '', phone || '']
    );
    customer = ins.rows[0];
  }

  const customerId = customer.id;
  if (!order.customerId || Number(order.customerId) !== Number(customerId)) {
    await dbQuery(client, 'UPDATE orders SET customer_id = $1, updated_at = now() WHERE id = $2', [
      customerId,
      Number(order._id),
    ]);
    order.customerId = customerId;
  }
  return order;
}

async function restoreStockForItems(items, client) {
  const restored = [];
  for (const item of items || []) {
    const quantity = toQuantity(item.quantity);
    if (!item.productId || quantity === null) continue;
    await dbQuery(client, 'UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2', [
      quantity,
      Number(item.productId),
    ]);
    restored.push({ productId: item.productId, quantity });
  }
  return restored;
}

/**
 * Lock products in id order, validate stock, deduct, and return priced lines from DB.
 * Frontend prices/names/stock are never trusted.
 */
async function deductAndBuildLines(items, client) {
  const grouped = requestedQuantities(items);
  const ids = [...grouped.keys()].sort((a, b) => a - b);
  const lines = [];

  for (const id of ids) {
    const quantity = grouped.get(id);
    const locked = await dbQuery(client, 'SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (!locked.rows[0]) throw new AppError('A product on this order no longer exists', 400);
    const product = rowToDoc(locked.rows[0]);
    if (product.status && product.status !== 'active') {
      throw new AppError(`"${product.name}" is inactive and cannot be sold`, 400);
    }
    if ((product.stock ?? 0) < quantity) {
      throw new AppError(`Not enough stock for "${product.name}". Available: ${product.stock}`, 400);
    }

    const updated = await dbQuery(
      client,
      'UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2 AND stock >= $1 RETURNING *',
      [quantity, id]
    );
    if (!updated.rows[0]) {
      throw new AppError(`Not enough stock for "${product.name}". Available: ${product.stock}`, 400);
    }
    lines.push(lineFromProduct(product, quantity));
    await maybeNotifyLowStock(rowToDoc(updated.rows[0]), client);
  }

  return lines;
}

async function insertOrder(payload, client) {
  const { columns, values } = buildInsert('orders', payload);
  const res = await dbQuery(
    client,
    `INSERT INTO orders (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    values
  );
  return rowToDoc(res.rows[0]);
}

async function updateOrderRow(id, payload, client) {
  const { sets, values } = buildUpdate('orders', payload);
  if (!sets.length) {
    const existing = await dbQuery(client, 'SELECT * FROM orders WHERE id = $1', [Number(id)]);
    return existing.rows[0] ? rowToDoc(existing.rows[0]) : null;
  }
  const res = await dbQuery(
    client,
    `UPDATE orders SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
    [...values, Number(id)]
  );
  return res.rows[0] ? rowToDoc(res.rows[0]) : null;
}

async function nextOrderNumber(client) {
  const settings = await getSettings(client);
  const prefix = settings?.orderPrefix || 'PFM-';
  const res = await dbQuery(
    client,
    `INSERT INTO counters (name, seq) VALUES ('orders', 1)
     ON CONFLICT (name) DO UPDATE SET seq = counters.seq + 1
     RETURNING seq`
  );
  return `${prefix}${String(res.rows[0].seq).padStart(4, '0')}`;
}

async function create(data) {
  return withTransaction(async (client) => {
    const taxRate = await getTaxRate(client);
    const lines = await deductAndBuildLines(data.items, client);
    const totals = computeTotals(lines, data.discount, taxRate);
    const paymentStatus = data.paymentStatus || (data.status === 'delivered' ? 'paid' : 'pending');
    const orderNumber = await nextOrderNumber(client);

    const payload = {
      ...data,
      orderNumber,
      items: lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      paymentStatus,
    };

    let order = await insertOrder(payload, client);
    order = await upsertCustomerFromOrder(order, client);
    await notifyOrderEvent(order.status === 'delivered' ? 'delivered' : 'created', order, client);
    return order;
  });
}

async function update(id, data) {
  return withTransaction(async (client) => {
    const existingRes = await dbQuery(client, 'SELECT * FROM orders WHERE id = $1 FOR UPDATE', [Number(id)]);
    if (!existingRes.rows[0]) throw new AppError('Record not found', 404);
    const order = rowToDoc(existingRes.rows[0]);

    const wasActive = order.status !== 'cancelled';
    const newStatus = data.status || order.status;
    const incomingItems = Array.isArray(data.items) ? data.items : [];
    const sourceItems = incomingItems.length ? incomingItems : order.items;

    if (wasActive) {
      await restoreStockForItems(order.items, client);
    }

    let payload;
    if (newStatus === 'cancelled') {
      payload = { ...data, items: sourceItems, status: 'cancelled' };
    } else {
      const lines = await deductAndBuildLines(sourceItems, client);
      const taxRate = await getTaxRate(client);
      const discount = data.discount ?? order.discount ?? 0;
      const totals = computeTotals(lines, discount, taxRate);
      payload = {
        ...data,
        items: lines,
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

    const updated = await updateOrderRow(id, payload, client);
    if (!updated) throw new AppError('Record not found', 404);

    if (order.status !== 'cancelled' && newStatus === 'cancelled') {
      await notifyOrderEvent('cancelled', updated, client);
    } else if (order.status !== newStatus && newStatus === 'delivered') {
      await notifyOrderEvent('delivered', updated, client);
    }

    return updated;
  });
}

async function remove(id) {
  return withTransaction(async (client) => {
    const existingRes = await dbQuery(client, 'SELECT * FROM orders WHERE id = $1 FOR UPDATE', [Number(id)]);
    if (!existingRes.rows[0]) throw new AppError('Record not found', 404);
    const order = rowToDoc(existingRes.rows[0]);

    if (order.status !== 'cancelled') {
      await restoreStockForItems(order.items, client);
    }

    const deleted = await dbQuery(client, 'DELETE FROM orders WHERE id = $1 RETURNING *', [Number(id)]);
    if (!deleted.rows[0]) throw new AppError('Record not found', 404);
    return rowToDoc(deleted.rows[0]);
  });
}

export const orderService = {
  list: base.list,
  getById: base.getById,
  create,
  update,
  delete: remove,
};
