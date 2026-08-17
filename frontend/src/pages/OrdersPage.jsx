import { useState } from 'react';
import { FiPrinter } from 'react-icons/fi';
import OrdersCrudPage from './OrdersCrudPage.jsx';
import ProductImage from '../components/ui/ProductImage.jsx';
import OrderReceiptModal from '../components/OrderReceiptModal.jsx';
import PosScanner from '../components/PosScanner.jsx';
import { formatMoney } from '../utils/currency.js';

const orderStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const paymentMethods = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'JazzCash', label: 'JazzCash' },
  { value: 'EasyPaisa', label: 'EasyPaisa' },
];

const paymentStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
];

function statusBadge(status) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize';
  const map = {
    pending: `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`,
    processing: `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`,
    shipped: `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300`,
    delivered: `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`,
    cancelled: `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`,
  };
  return map[status] || `${base} bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300`;
}

function paymentBadge(status) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize';
  const map = {
    paid: `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`,
    pending: `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`,
    refunded: `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`,
  };
  return map[status] || `${base} bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300`;
}

function OrderProductsCell({ order }) {
  const products = Array.isArray(order.items) ? order.items : [];
  if (!products.length) {
    return <span className="panel-muted">—</span>;
  }

  const visible = products.slice(0, 2);
  const extra = products.length - visible.length;

  return (
    <div className="flex min-w-[220px] flex-col gap-1.5">
      {visible.map((item, index) => (
        <div key={`${item.productId || item.productName}-${index}`} className="flex items-center gap-2">
          <ProductImage src={item.image} alt={item.productName} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium panel-title">{item.productName}</p>
            <p className="text-xs panel-muted">
              Qty {item.quantity} · {formatMoney(item.price)}
            </p>
          </div>
        </div>
      ))}
      {extra > 0 ? (
        <p className="text-xs font-semibold text-[var(--primary)]">+{extra} more</p>
      ) : null}
    </div>
  );
}

function OrderDetails({ item }) {
  const items = Array.isArray(item.items) ? item.items : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-[var(--text)]">{item.orderNumber || item.customerName}</h3>
        <span className={statusBadge(item.status)}>{item.status}</span>
        <span className={paymentBadge(item.paymentStatus)}>{item.paymentStatus} payment</span>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs font-medium text-[var(--text-muted)]">Customer</dt>
          <dd className="text-sm font-semibold text-[var(--text)]">{item.customerName}</dd>
          {item.customerEmail ? <dd className="text-xs text-[var(--text-muted)]">{item.customerEmail}</dd> : null}
          {item.customerPhone ? <dd className="text-xs text-[var(--text-muted)]">{item.customerPhone}</dd> : null}
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-muted)]">Total</dt>
          <dd className="text-sm font-semibold text-[var(--text)]">{formatMoney(item.total)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-muted)]">Payment method</dt>
          <dd className="text-sm font-semibold text-[var(--text)]">{item.paymentMethod || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-muted)]">Delivery method</dt>
          <dd className="text-sm font-semibold text-[var(--text)]">{item.shippingMethod || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-muted)]">Created</dt>
          <dd className="text-sm font-semibold text-[var(--text)]">
            {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
          </dd>
        </div>
      </dl>
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Items</p>
        <div className="space-y-2">
          {items.map((entry, index) => (
            <div key={`${entry.productId}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border divider-border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProductImage src={entry.image} alt={entry.productName} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{entry.productName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Qty {entry.quantity} × {formatMoney(entry.price)}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold text-[var(--text)]">
                {formatMoney(Number(entry.price) * Number(entry.quantity))}
              </p>
            </div>
          ))}
          {items.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No items.</p> : null}
        </div>
      </div>
      {item.notes ? (
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--text-muted)]">Notes</p>
          <p className="text-sm text-[var(--text)]">{item.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function OrdersPage() {
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <PosScanner onOrderCreated={() => setReloadKey((key) => key + 1)} />
      <OrdersCrudPage
        title="Orders"
        subtitle="Keep track of all customer orders"
        resourcePath="/orders"
        reloadKey={reloadKey}
        pageSize={10}
        statusFilterOptions={orderStatuses}
        addLabel="Create Order"
        columns={[
          {
            key: 'orderNumber',
            label: 'Order',
            render: (r) => (
              <div>
                <p className="font-semibold panel-title">{r.orderNumber || `#${String(r._id).slice(-6).toUpperCase()}`}</p>
                <p className="text-xs panel-muted">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            ),
          },
          {
            key: 'customerName',
            label: 'Customer',
            render: (r) => (
              <div>
                <p className="font-medium panel-title">{r.customerName || '—'}</p>
                {r.customerEmail || r.customerPhone ? (
                  <p className="truncate text-xs panel-muted">{r.customerEmail || r.customerPhone}</p>
                ) : null}
              </div>
            ),
          },
          { key: 'items', label: 'Products', render: (order) => <OrderProductsCell order={order} /> },
          { key: 'total', label: 'Total', align: 'right', render: (r) => <span className="font-semibold panel-title">{formatMoney(r.total)}</span> },
          { key: 'status', label: 'Status', render: (r) => <span className={statusBadge(r.status)}>{r.status}</span> },
          {
            key: 'paymentStatus',
            label: 'Payment',
            render: (r) => (
              <span className={paymentBadge(r.paymentStatus)}>
                {r.paymentStatus || 'pending'}
              </span>
            ),
          },
        ]}
        itemLabel="Order"
        modalSize="lg"
        viewDetails={OrderDetails}
        extraActions={(order) => (
          <button
            type="button"
            onClick={() => setReceiptOrder(order)}
            title="Print receipt"
            aria-label="Print order"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border divider-border bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--primary)]"
          >
            <FiPrinter size={18} />
          </button>
        )}
        fields={[
          { name: 'customerName', label: 'Customer Name' },
          { name: 'customerEmail', label: 'Email' },
          { name: 'customerPhone', label: 'Phone' },
          { name: 'items', label: 'Products', type: 'order-items' },
          { name: 'subtotal', label: 'Subtotal (PKR)', type: 'number', readOnly: true, defaultValue: 0 },
          { name: 'discount', label: 'Discount (PKR)', type: 'number', defaultValue: 0 },
          { name: 'tax', label: 'Tax (PKR, auto from settings)', type: 'number', readOnly: true, defaultValue: 0 },
          { name: 'total', label: 'Total (PKR)', type: 'number', readOnly: true, defaultValue: 0 },
          { name: 'shippingMethod', label: 'Delivery Method' },
          { name: 'paymentMethod', label: 'Payment Method', type: 'select', options: paymentMethods, defaultValue: 'Cash' },
          { name: 'paymentStatus', label: 'Payment Status', type: 'select', options: paymentStatuses, defaultValue: 'pending' },
          { name: 'status', label: 'Status', type: 'select', options: orderStatuses, defaultValue: 'pending' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
      />
      <OrderReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
    </>
  );
}
