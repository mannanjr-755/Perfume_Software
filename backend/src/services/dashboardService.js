import { query } from '../config/database.js';
import { rowToDoc } from '../db/columns.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from './orderService.js';

function computeRange(range) {
  const now = new Date();
  const start = new Date(now);
  if (range === '7d') start.setDate(now.getDate() - 7);
  else if (range === '30d') start.setDate(now.getDate() - 30);
  else if (range === '90d') start.setDate(now.getDate() - 90);
  else if (range === 'year') start.setMonth(now.getMonth() - 12, 1);
  else start.setDate(now.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function getSettings() {
  const res = await query('SELECT low_stock_threshold, store_name FROM settings ORDER BY id LIMIT 1');
  return res.rows[0]
    ? {
        lowStockThreshold: res.rows[0].low_stock_threshold,
        storeName: res.rows[0].store_name,
      }
    : null;
}

function bucketKey(date, range) {
  const d = new Date(date);
  if (range === 'year') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return d.toISOString().slice(0, 10);
}

export async function getDashboardStats({ range = '7d' } = {}) {
  const start = computeRange(range);
  const settings = await getSettings();
  const threshold = Number(settings?.lowStockThreshold) ?? DEFAULT_LOW_STOCK_THRESHOLD;

  const [counts, revenueRes, pendingRes, notificationsRes, lowStockRes, outOfStockRes] =
    await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*) FROM products) AS products,
           (SELECT COUNT(*) FROM orders) AS orders,
           (SELECT COUNT(*) FROM customers) AS customers`
      ),
      query(`SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status <> 'cancelled'`),
      query(`SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'`),
      query(`SELECT COUNT(*) AS count FROM notifications WHERE read = FALSE`),
      query(
        `SELECT COUNT(*) AS count FROM products WHERE status = 'active' AND stock > 0 AND stock <= $1`,
        [threshold]
      ),
      query(`SELECT COUNT(*) AS count FROM products WHERE status = 'active' AND stock = 0`),
    ]);

  const [recentOrdersRes, recentProductsRes, bestSellersRes, rangeOrdersRes, topCategoriesRes] =
    await Promise.all([
      query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8'),
      query('SELECT * FROM products ORDER BY created_at DESC LIMIT 8'),
      query(
        `SELECT
           (item->>'productId') AS product_id,
           MIN(item->>'productName') AS name,
           MIN(item->>'image') AS image,
           MIN(item->>'brand') AS brand,
           SUM((item->>'quantity')::numeric) AS sold,
           SUM((item->>'quantity')::numeric * (item->>'price')::numeric) AS revenue
         FROM orders, jsonb_array_elements(items) AS item
         WHERE status <> 'cancelled'
         GROUP BY item->>'productId'
         ORDER BY sold DESC
         LIMIT 5`
      ),
      query(`SELECT * FROM orders WHERE status <> 'cancelled' AND created_at >= $1 ORDER BY created_at`, [start]),
      query(
        `SELECT
           (item->>'category') AS category,
           SUM((item->>'quantity')::numeric) AS count
         FROM orders, jsonb_array_elements(items) AS item
         WHERE status <> 'cancelled' AND created_at >= $1
         GROUP BY item->>'category'
         ORDER BY count DESC
         LIMIT 5`,
        [start]
      ),
    ]);

  const products = Number(counts.rows[0].products);
  const orders = Number(counts.rows[0].orders);
  const customers = Number(counts.rows[0].customers);
  const revenue = Number(revenueRes.rows[0].total || 0);
  const pendingOrders = Number(pendingRes.rows[0].count);
  const notifications = Number(notificationsRes.rows[0].count);
  const lowStockCount = Number(lowStockRes.rows[0].count);
  const outOfStockCount = Number(outOfStockRes.rows[0].count);

  const recentOrders = recentOrdersRes.rows.map(rowToDoc);
  const recentProducts = recentProductsRes.rows.map(rowToDoc);

  const bestSellers = bestSellersRes.rows.map((row) => ({
    _id: row.product_id,
    name: row.name,
    image: row.image,
    brand: row.brand,
    sold: Number(row.sold),
    revenue: Number(row.revenue),
  }));

  const rangeOrders = rangeOrdersRes.rows.map(rowToDoc);
  const rangeRevenue = rangeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const salesByDate = {};
  rangeOrders.forEach((order) => {
    const key = bucketKey(order.createdAt, range);
    salesByDate[key] = (salesByDate[key] || 0) + Number(order.total || 0);
  });

  const salesOverview = Object.entries(salesByDate)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, total]) => ({ date, total }));

  const topCategories = topCategoriesRes.rows.map((row) => ({
    name: row.category || 'Uncategorized',
    count: Number(row.count),
  }));

  return {
    stats: {
      products,
      orders,
      customers,
      revenue,
      pendingOrders,
      unreadNotifications: notifications,
      lowStockItems: lowStockCount,
      outOfStockItems: outOfStockCount,
      rangeRevenue,
      storeName: settings?.storeName || 'Scent Yours',
      lowStockThreshold: threshold,
    },
    recentOrders,
    recentProducts,
    bestSellers,
    topCategories,
    salesOverview,
    range,
  };
}

export async function getReports(queryParams = {}) {
  const { from, to } = queryParams;
  const where = [];
  const params = [];
  if (from) {
    params.push(new Date(from));
    where.push(`created_at >= $${params.length}`);
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    params.push(end);
    where.push(`created_at <= $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const filterParams = [...params];
  const params2 = [...params];

  const [ordersRes, bestSellersRes, byCategoryRes, byBrandRes, byDateRes] = await Promise.all([
    query(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC`, filterParams),
    query(
      `SELECT
         (item->>'productId') AS product_id,
         MIN(item->>'productName') AS name,
         MIN(item->>'image') AS image,
         MIN(item->>'brand') AS brand,
         MIN(item->>'category') AS category,
         SUM((item->>'quantity')::numeric) AS sold,
         SUM((item->>'quantity')::numeric * (item->>'price')::numeric) AS revenue
       FROM orders, jsonb_array_elements(items) AS item
       WHERE status <> 'cancelled'${whereSql.replace(/^WHERE/, ' AND')}
       GROUP BY item->>'productId'
       ORDER BY sold DESC
       LIMIT 10`,
      params
    ),
    query(
      `SELECT
         (item->>'category') AS category,
         SUM((item->>'quantity')::numeric) AS count,
         SUM((item->>'quantity')::numeric * (item->>'price')::numeric) AS revenue
       FROM orders, jsonb_array_elements(items) AS item
       WHERE status <> 'cancelled'${whereSql.replace(/^WHERE/, ' AND')}
       GROUP BY item->>'category'
       ORDER BY count DESC`,
      params2
    ),
    query(
      `SELECT
         (item->>'brand') AS brand,
         SUM((item->>'quantity')::numeric) AS count,
         SUM((item->>'quantity')::numeric * (item->>'price')::numeric) AS revenue
       FROM orders, jsonb_array_elements(items) AS item
       WHERE status <> 'cancelled'${whereSql.replace(/^WHERE/, ' AND')}
       GROUP BY item->>'brand'
       ORDER BY count DESC`,
      params2
    ),
    query(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS date, SUM(total) AS revenue, COUNT(*) AS count
       FROM orders
       WHERE status <> 'cancelled'${whereSql.replace(/^WHERE/, ' AND')}
       GROUP BY to_char(created_at, 'YYYY-MM-DD')
       ORDER BY date`,
      params2
    ),
  ]);

  const orders = ordersRes.rows.map(rowToDoc);
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? Number(o.total || 0) : 0), 0);

  return {
    orders,
    summary: {
      totalOrders: orders.length,
      totalRevenue,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      pending: orders.filter((o) => o.status === 'pending').length,
      processing: orders.filter((o) => o.status === 'processing').length,
      shipped: orders.filter((o) => o.status === 'shipped').length,
    },
    bestSellers: bestSellersRes.rows.map((row) => ({
      _id: row.product_id,
      name: row.name,
      image: row.image,
      brand: row.brand,
      category: row.category,
      sold: Number(row.sold),
      revenue: Number(row.revenue),
    })),
    byCategory: byCategoryRes.rows.map((row) => ({
      name: row.category || 'Uncategorized',
      count: Number(row.count),
      revenue: Number(row.revenue),
    })),
    byBrand: byBrandRes.rows.map((row) => ({
      name: row.brand || 'Unknown',
      count: Number(row.count),
      revenue: Number(row.revenue),
    })),
    salesByDate: byDateRes.rows.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue),
      count: Number(row.count),
    })),
  };
}