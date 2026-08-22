import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LuBluetooth, LuKeyboard, LuScanBarcode } from 'react-icons/lu';
import {
  FiPackage,
  FiShoppingBag,
  FiUsers,
  FiCreditCard,
  FiAlertTriangle,
  FiTrendingUp,
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ProductImage from '../components/ui/ProductImage.jsx';
import { fetchDashboardStats } from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import { formatMoney } from '../utils/currency.js';
import PosScanner from '../components/PosScanner.jsx';
import { onBarcodeScan, readLastBarcodeScan } from '../utils/scanner.js';

const STATUS_COLORS = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#6366f1',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'Last 12 months' },
];

function StatCard({ icon: Icon, label, value, subtitle, colorClass }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold panel-title">{value}</p>
          {subtitle ? <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">{subtitle}</p> : null}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function statusBadge(status) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold capitalize';
  const map = {
    pending: `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`,
    processing: `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`,
    shipped: `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300`,
    delivered: `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`,
    cancelled: `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`,
  };
  return map[status] || `${base} bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300`;
}

function stockBadge(stock, threshold) {
  if (stock === 0) return 'rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300';
  if (stock <= threshold) return 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
}

function formatBucketLabel(bucket, range) {
  if (range === 'year') {
    const [year, month] = bucket.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[Number(month) - 1]} '${year.slice(2)}`;
  }
  const d = new Date(`${bucket}T00:00:00`);
  if (Number.isNaN(d.getTime())) return bucket;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function BestSellingPerfumes({ products = [], loading }) {
  if (loading) return <SkeletonCard title="Best Selling Perfumes" rows={5} />;
  return (
    <section className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold panel-title">Best Selling Perfumes</h3>
        <Link to="/dashboard/products" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          View All
        </Link>
      </div>
      {products.length === 0 ? (
        <EmptyState
          icon={FiTrendingUp}
          title="No sales yet"
          description="Best sellers appear once orders are placed."
        />
      ) : (
        <ul className="space-y-4">
          {products.map((item) => {
            const max = products[0]?.sold || 1;
            return (
              <li key={item._id || item.name} className="flex items-center gap-3">
                <ProductImage src={item.image} alt={item.name} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium panel-title">{item.name}</p>
                    <p className="shrink-0 text-xs panel-muted">{item.sold} sold</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.max((item.sold / max) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecentOrders({ orders = [], loading }) {
  if (loading) return <SkeletonCard title="Recent Orders" rows={5} />;
  return (
    <section className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold panel-title">Recent Orders</h3>
        <Link to="/dashboard/orders" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          View All
        </Link>
      </div>
      {orders.length === 0 ? (
        <EmptyState icon={FiShoppingBag} title="No orders yet" description="Orders will show up here." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order._id} className="flex items-center justify-between gap-3 rounded-lg border divider-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold panel-title">
                  {order.orderNumber || `#${String(order._id).slice(-6).toUpperCase()}`}
                </p>
                <p className="truncate text-xs panel-muted">{order.customerName}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold panel-title">{formatMoney(order.total)}</p>
                <p className="text-xs panel-muted">
                  {new Date(order.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className={statusBadge(order.status)}>{order.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LowStockProducts({ products = [], loading, threshold }) {
  if (loading) return <SkeletonCard title="Low Stock Products" rows={5} />;
  const lowStock = [...products]
    .filter((p) => (p.stock ?? 0) <= threshold)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 5);

  return (
    <section className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold panel-title">Low Stock Products</h3>
        <Link to="/dashboard/products" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          View All
        </Link>
      </div>
      {lowStock.length === 0 ? (
        <EmptyState icon={FiAlertTriangle} title="All stocked up" description="No products are below the low-stock threshold." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b divider-border text-left panel-muted">
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Stock</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((item) => (
                <tr key={item._id} className="border-b divider-border last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <ProductImage src={item.image} alt={item.name} className="h-9 w-9" />
                      <div className="min-w-0">
                        <p className="truncate font-medium panel-title">{item.name}</p>
                        <p className="truncate text-xs panel-muted">{item.category || 'Perfume'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 panel-title">{item.stock ?? 0}</td>
                  <td className="py-3">
                    <span className={stockBadge(item.stock ?? 0, threshold)}>
                      {item.stock === 0 ? 'Out of stock' : 'Low stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrdersOverview({ orders = [], loading }) {
  if (loading) return <SkeletonCard title="Orders Overview" rows={5} />;
  const grouped = orders.reduce(
    (acc, order) => {
      const key = order.status || 'pending';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 }
  );

  const dataset = STATUS_ORDER.map((name) => ({
    name,
    value: grouped[name] || 0,
    color: STATUS_COLORS[name] || '#9ca3af',
  }));
  const total = dataset.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="card-surface p-5">
      <h3 className="mb-4 text-sm font-semibold panel-title">Orders Overview</h3>
      {total === 0 ? (
        <EmptyState icon={FiShoppingBag} title="No orders" description="Order status breakdown will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={3}>
                  {dataset.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2">
            {dataset.map((row) => {
              const pct = total ? Math.round((row.value / total) * 100) : 0;
              return (
                <li key={row.name} className="flex items-center justify-between gap-3 rounded-lg border divider-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-sm capitalize panel-title">{row.name}</span>
                  </div>
                  <p className="shrink-0 text-xs panel-muted">
                    <span className="font-semibold panel-title">{row.value}</span> ({pct}%)
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function TopCategories({ categories = [], loading }) {
  if (loading) return <SkeletonCard title="Top Categories" rows={5} />;
  if (categories.length === 0) {
    return (
      <section className="card-surface p-5">
        <h3 className="mb-4 text-sm font-semibold panel-title">Top Categories</h3>
        <EmptyState icon={FiPackage} title="No sales data" description="Category performance appears once orders exist." />
      </section>
    );
  }
  const top = categories[0]?.count || 1;
  return (
    <section className="card-surface p-5">
      <h3 className="mb-4 text-sm font-semibold panel-title">Top Categories</h3>
      <div className="space-y-4">
        {categories.map((row) => (
          <div key={row.name}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="truncate panel-title">{row.name}</span>
              <span className="shrink-0 pl-2 panel-muted">{row.count} sold</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.max((row.count / top) * 100, 6)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkeletonCard({ title, rows }) {
  return (
    <section className="card-surface p-5">
      <h3 className="mb-4 text-sm font-semibold panel-title">{title}</h3>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface-soft)]" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-[var(--surface-soft)]" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScannerPanel({ onOrderCreated }) {
  const [lastScan, setLastScan] = useState(() => readLastBarcodeScan());
  const [bluetoothStatus, setBluetoothStatus] = useState('idle');
  const [bluetoothName, setBluetoothName] = useState('');

  useEffect(() => onBarcodeScan(setLastScan), []);

  const pairBluetoothScanner = async () => {
    if (!navigator.bluetooth) {
      setBluetoothStatus('unsupported');
      return;
    }

    setBluetoothStatus('connecting');
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      setBluetoothName(device.name || 'Netum HW-L98');
      setBluetoothStatus('connected');
    } catch (error) {
      setBluetoothStatus(error?.name === 'NotFoundError' ? 'idle' : 'error');
    }
  };

  const statusText = {
    idle: 'Pair the Netum HW-L98 in Windows Bluetooth settings (keyboard / HID mode), then scan into the field below.',
    connecting: 'Choose the scanner in the browser pairing dialog.',
    connected: `${bluetoothName} selected. Keep it in keyboard HID mode. Scan to add products to the order.`,
    unsupported: 'Pair the Netum HW-L98 in Windows Bluetooth settings. It types like a keyboard and will add products here.',
    error: 'Browser pairing was not completed. Use Windows Bluetooth settings, then scan here.',
  }[bluetoothStatus];

  return (
    <div className="mb-6 space-y-4">
      <section className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LuScanBarcode size={20} className="text-[var(--primary)]" />
              <h2 className="text-base font-semibold panel-title">Barcode Scanner</h2>
            </div>
            <p className="mt-1 text-sm panel-muted">Netum HW-L98 — scan to find a product and add it to the order</p>
          </div>
          <button
            type="button"
            onClick={pairBluetoothScanner}
            disabled={bluetoothStatus === 'connecting'}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <LuBluetooth size={17} />
            {bluetoothStatus === 'connecting' ? 'Pairing...' : 'Pair Bluetooth'}
          </button>
        </div>

        <div className="mt-4 rounded-lg border divider-border bg-[var(--surface-soft)] px-4 py-3">
          <p className="text-xs panel-muted">Bluetooth / keyboard wedge</p>
          <p className="mt-1 text-sm panel-title">{statusText}</p>
          <p className="mt-2 flex items-center gap-2 text-xs panel-muted">
            <LuKeyboard size={16} />
            Scanner works as a keyboard — scan anywhere on this page; products are added to the cart below.
          </p>
        </div>

        {lastScan ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t divider-border pt-4">
            <span className="text-xs panel-muted">Last scanned barcode</span>
            <span className="font-mono text-lg font-semibold panel-title">{lastScan.barcode}</span>
            <span className="text-xs panel-muted">{new Date(lastScan.scannedAt).toLocaleTimeString()}</span>
          </div>
        ) : (
          <p className="mt-4 border-t divider-border pt-4 text-sm panel-muted">No barcode scanned yet.</p>
        )}
      </section>

      <PosScanner onOrderCreated={onOrderCreated} />
    </div>
  );
}

export default function DashboardPage() {
  const { isDark } = useTheme();
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (rangeValue) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDashboardStats({ range: rangeValue });
      setData(res.data || res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const stats = data?.stats || {};
  const orders = data?.recentOrders || [];
  const products = data?.recentProducts || [];
  const salesOverview = data?.salesOverview || [];
  const bestSellers = data?.bestSellers || [];
  const topCategories = data?.topCategories || [];
  const threshold = stats.lowStockThreshold ?? 5;

  const chartData = salesOverview.map((row) => ({
    label: formatBucketLabel(row.date, data?.range || range),
    total: row.total,
  }));

  const statConfig = [
    { key: 'products', label: 'Total Products', icon: FiPackage, color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', format: (v) => Number(v || 0).toLocaleString() },
    { key: 'orders', label: 'Total Orders', icon: FiShoppingBag, color: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300', format: (v) => Number(v || 0).toLocaleString() },
    { key: 'customers', label: 'Total Customers', icon: FiUsers, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', format: (v) => Number(v || 0).toLocaleString() },
    { key: 'revenue', label: 'Total Revenue', icon: FiCreditCard, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', format: (v) => formatMoney(v) },
    { key: 'lowStockItems', label: 'Low Stock Items', icon: FiAlertTriangle, color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', format: (v) => Number(v || 0).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your store"
        action={
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-lg border divider-border bg-[var(--surface)] px-3 py-2 text-xs font-medium panel-muted"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        }
      />

      {error ? (
        <div className="card-surface p-6">
          <p className="font-medium text-red-500">Unable to load dashboard data</p>
          <p className="mt-1 text-sm panel-muted">{error}</p>
          <button type="button" className="btn-primary mt-4" onClick={() => load(range)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <ScannerPanel onOrderCreated={() => load(range)} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statConfig.map((item) => {
              const raw = stats[item.key];
              return (
                <StatCard
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  value={loading ? '—' : item.format(raw)}
                  subtitle={
                    item.key === 'orders'
                      ? `${Number(stats.pendingOrders || 0).toLocaleString()} pending`
                      : item.key === 'lowStockItems'
                        ? `${Number(stats.outOfStockItems || 0).toLocaleString()} out of stock`
                        : item.key === 'revenue'
                          ? `${formatMoney(stats.rangeRevenue || 0)} in period`
                          : undefined
                  }
                  colorClass={item.color}
                />
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="card-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold panel-title">Sales Overview</h3>
                <span className="text-xs panel-muted">{RANGE_OPTIONS.find((o) => o.value === range)?.label}</span>
              </div>
              {chartData.length === 0 ? (
                <div className="flex h-64 items-center justify-center">
                  <EmptyState icon={FiTrendingUp} title="No sales in this period" description="Place some orders to see the sales trend." />
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#F3F4F6'} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke={isDark ? '#9CA3AF' : '#6B7280'}
                        tickFormatter={(value) => Number(value).toLocaleString('en-PK')}
                      />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Sales']} />
                      <Area type="monotone" dataKey="total" stroke="#7c3aed" fill="url(#salesFill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <BestSellingPerfumes products={bestSellers} loading={loading} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
            <RecentOrders orders={orders} loading={loading} />
            <OrdersOverview orders={orders} loading={loading} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
            <LowStockProducts products={products} loading={loading} threshold={threshold} />
            <TopCategories categories={topCategories} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
}
