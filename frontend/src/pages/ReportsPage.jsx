import { useEffect, useState } from 'react';
import { FiDownload, FiTrendingUp, FiShoppingCart, FiPackage, FiTag, FiAward } from 'react-icons/fi';
import Swal from 'sweetalert2';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ProductImage from '../components/ui/ProductImage.jsx';
import { fetchReports } from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import { formatMoney } from '../utils/currency.js';
import { exportSalesWorkbook } from '../utils/exportSalesExcel.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

function shortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
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

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const params = { from, to };
        const res = await fetchReports(params);
        if (active) setData(res.data || res);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [from, to]);

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const result = await exportSalesWorkbook(data);
      await Swal.fire({
        icon: 'success',
        title: 'Excel downloaded',
        text: `${result.fileName} includes ${result.rows} sales row(s).`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Export failed', text: getErrorMessage(err) });
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary || {};
  const bestSellers = data?.bestSellers || [];
  const byCategory = data?.byCategory || [];
  const byBrand = data?.byBrand || [];
  const salesByDate = data?.salesByDate || [];

  return (
    <div>
      <PageHeader
        title="Sales & Reports"
        subtitle="Revenue, top sellers and performance by category or brand"
        action={
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FiDownload size={16} />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="form-label">From</label>
          <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label">To</label>
          <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {error ? (
        <div className="card-surface flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium text-red-500">Unable to load reports</p>
          <p className="text-sm panel-muted">{error}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setLoading(true);
              setError('');
              fetchReports({ from, to })
                .then((res) => setData(res.data || res))
                .catch((err) => setError(getErrorMessage(err)))
                .finally(() => setLoading(false));
            }}
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Total Orders" value={summary.totalOrders ?? 0} icon={FiShoppingCart} color="bg-violet-100 text-violet-700" />
            <SummaryCard label="Revenue" value={formatMoney(summary.totalRevenue ?? 0)} icon={FiTrendingUp} color="bg-emerald-100 text-emerald-700" />
            <SummaryCard label="Delivered" value={summary.delivered ?? 0} icon={FiPackage} color="bg-blue-100 text-blue-700" />
            <SummaryCard label="Cancelled" value={summary.cancelled ?? 0} icon={FiAward} color="bg-red-100 text-red-700" />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <div className="card-surface p-5">
              <h3 className="mb-4 text-sm font-semibold panel-title">Sales by Date</h3>
              {salesByDate.length === 0 ? (
                <div className="h-64">
                  <EmptyState icon={FiTrendingUp} title="No sales in this range" description="Adjust the date range to see the sales trend." />
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesByDate}>
                      <defs>
                        <linearGradient id="repSalesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#F3F4F6'} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} tickFormatter={(v) => shortDate(v)} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke={isDark ? '#9CA3AF' : '#6B7280'}
                        tickFormatter={(value) => Number(value).toLocaleString('en-PK')}
                      />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Revenue']} labelFormatter={(v) => shortDate(v)} />
                      <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="url(#repSalesFill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card-surface p-5">
              <h3 className="mb-4 text-sm font-semibold panel-title">Revenue by Category</h3>
              {byCategory.length === 0 ? (
                <div className="h-64">
                  <EmptyState icon={FiTag} title="No category data" description="Category revenue appears once orders exist in the range." />
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#F3F4F6'} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke={isDark ? '#9CA3AF' : '#6B7280'}
                        tickFormatter={(value) => Number(value).toLocaleString('en-PK')}
                      />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <div className="card-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold panel-title">Best Selling Products</h3>
                <span className="text-xs panel-muted">{bestSellers.length} items</span>
              </div>
              {bestSellers.length === 0 ? (
                <EmptyState icon={FiTrendingUp} title="No best sellers" description="Top products appear once orders exist in the range." />
              ) : (
                <ul className="space-y-4">
                  {bestSellers.map((item, index) => (
                    <li key={item._id || item.name} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs font-bold text-[var(--primary)]">
                        {index + 1}
                      </span>
                      <ProductImage src={item.image} alt={item.name} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium panel-title">{item.name}</p>
                          <p className="shrink-0 text-xs panel-muted">{item.sold} sold</p>
                        </div>
                        <p className="text-xs font-semibold text-[var(--primary)]">{formatMoney(item.revenue)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card-surface overflow-hidden">
              <div className="flex items-center justify-between p-5 pb-3">
                <h3 className="text-sm font-semibold panel-title">Sales by Brand</h3>
                <span className="text-xs panel-muted">{byBrand.length} brands</span>
              </div>
              {byBrand.length === 0 ? (
                <EmptyState icon={FiAward} title="No brand data" description="Brand performance appears once orders exist in the range." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b divider-border bg-[var(--surface-soft)] text-left text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="px-5 py-3 font-medium">Brand</th>
                        <th className="px-5 py-3 font-medium">Units</th>
                        <th className="px-5 py-3 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byBrand.map((row) => (
                        <tr key={row.name} className="border-t divider-border">
                          <td className="px-5 py-3 text-gray-800 dark:text-gray-200">{row.name}</td>
                          <td className="px-5 py-3">{row.count}</td>
                          <td className="px-5 py-3 font-medium">{formatMoney(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card-surface overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
              <h3 className="text-sm font-semibold panel-title">Orders in Range</h3>
              <span className="text-xs panel-muted">{summary.totalOrders ?? 0} orders</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b divider-border bg-[var(--surface-soft)] text-left text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.orders || []).map((order) => (
                    <tr key={order._id} className="border-t divider-border">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">
                        {order.orderNumber || `#${String(order._id).slice(-6).toUpperCase()}`}
                      </td>
                      <td className="px-5 py-3 text-gray-800 dark:text-gray-200">{order.customerName}</td>
                      <td className="px-5 py-3">{formatMoney(order.total)}</td>
                      <td className="px-5 py-3">
                        <span className={statusBadge(order.status)}>{order.status}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{shortDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.orders?.length ? (
                <EmptyState icon={FiShoppingCart} title="No orders in this range" description="Adjust the date range to include orders." />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
