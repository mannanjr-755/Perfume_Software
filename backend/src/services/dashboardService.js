import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import Notification from '../models/Notification.js';
import Settings from '../models/Settings.js';
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
  return Settings.findOne().select('lowStockThreshold storeName').lean();
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

  const [products, orders, customers, revenueAgg, pendingOrders, notifications, lowStockCount, outOfStockCount] =
    await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Customer.countDocuments(),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.countDocuments({ status: 'pending' }),
      Notification.countDocuments({ read: false }),
      Product.countDocuments({ status: 'active', stock: { $lte: threshold, $gt: 0 } }),
      Product.countDocuments({ status: 'active', stock: 0 }),
    ]);

  const revenue = revenueAgg[0]?.total || 0;

  const [recentOrders, recentProducts, bestSellers, rangeOrders, topCategoriesAgg] =
    await Promise.all([
      Order.find().sort({ createdAt: -1 }).limit(8),
      Product.find().sort({ createdAt: -1 }).limit(8),
      Order.aggregate([
        { $unwind: '$items' },
        { $match: { status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.productName' },
            image: { $first: '$items.image' },
            brand: { $first: '$items.brand' },
            sold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          },
        },
        { $sort: { sold: -1 } },
        { $limit: 5 },
      ]),
      Order.find({ status: { $ne: 'cancelled' }, createdAt: { $gte: start } }).sort({ createdAt: 1 }),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: start } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.category', count: { $sum: '$items.quantity' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

  const rangeRevenue = rangeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const salesByDate = {};
  rangeOrders.forEach((order) => {
    const key = bucketKey(order.createdAt, range);
    salesByDate[key] = (salesByDate[key] || 0) + Number(order.total || 0);
  });

  const salesOverview = Object.entries(salesByDate)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, total]) => ({ date, total }));

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
    topCategories: topCategoriesAgg.map((row) => ({ name: row._id || 'Uncategorized', count: row.count })),
    salesOverview,
    range,
  };
}

export async function getReports(query = {}) {
  const { from, to } = query;
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const [orders, bestSellers, byCategory, byBrand, byDateAgg] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }),
    Order.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.productName' },
          image: { $first: '$items.image' },
          brand: { $first: '$items.brand' },
          category: { $first: '$items.category' },
          sold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$items.category',
          count: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$items.brand',
          count: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $match: filter },
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

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
    bestSellers,
    byCategory: byCategory.map((row) => ({ name: row._id || 'Uncategorized', count: row.count, revenue: row.revenue })),
    byBrand: byBrand.map((row) => ({ name: row._id || 'Unknown', count: row.count, revenue: row.revenue })),
    salesByDate: byDateAgg.map((row) => ({ date: row._id, revenue: row.revenue, count: row.count })),
  };
}
