import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiEye,
  FiInbox,
  FiPlus,
  FiSearch,
  FiShoppingBag,
  FiTrash2,
} from 'react-icons/fi';
import Modal from '../components/ui/Modal.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import {
  fetchResource,
  createResource,
  updateResource,
  deleteResource,
} from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import ProductImage from '../components/ui/ProductImage.jsx';
import BarcodeScanInput from '../components/BarcodeScanInput.jsx';
import { formatMoney } from '../utils/currency.js';
import { upsertOrderItem } from '../utils/orderCart.js';
import { toastSuccess, toastWarning, toastError } from '../utils/toast.js';

function isFullWidth(field) {
  return Boolean(field.fullWidth || field.type === 'textarea' || field.type === 'order-items');
}

function toOrderItem(product, quantity = 1) {
  return {
    productId: product._id || product.productId,
    productName: product.name || product.productName || '',
    brand: product.brand || '',
    category: product.category || '',
    description: product.description || '',
    image: product.image || '',
    barcode: product.barcode || '',
    quantity: Math.max(1, Number(quantity) || 1),
    price: Number(product.price || 0),
  };
}

function itemsTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border divider-border transition-colors';

export default function OrdersCrudPage({
  title,
  subtitle,
  resourcePath,
  columns,
  fields,
  emptyLabel = 'No records found',
  itemLabel,
  modalSize = 'md',
  extraActions,
  reloadKey = 0,
  addLabel = 'Add New',
  statusFilterOptions,
  pageSize = 10,
  createText,
  onCreated,
  onUpdated,
  onDeleted,
  viewDetails,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const loadRef = useRef(null);

  const entityName = itemLabel || title;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { search, page, limit: pageSize };
      if (statusFilter) params.status = statusFilter;
      const res = await fetchResource(resourcePath, params);
      const payload = res.data || res;
      setItems(payload.items || payload || []);
      setTotal(payload.total ?? 0);
    } catch (loadError) {
      setItems([]);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [resourcePath, search, statusFilter, page, pageSize]);

  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  const prevReloadKey = useRef(reloadKey);
  useEffect(() => {
    if (prevReloadKey.current === reloadKey) return;
    prevReloadKey.current = reloadKey;
    loadRef.current();
  }, [reloadKey]);

  const hasOrderItemsField = fields.some((field) => field.type === 'order-items');

  useEffect(() => {
    if (!modalOpen || !hasOrderItemsField) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await fetchResource('/products', { limit: 200 });
        const payload = res.data || res;
        if (active) setCatalogProducts(payload.items || payload || []);
      } catch {
        if (active) setCatalogProducts([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [modalOpen, hasOrderItemsField]);

  const openCreate = () => {
    setEditing(null);
    const initial = {};
    fields.forEach((f) => {
      initial[f.name] = f.defaultValue ?? (f.type === 'order-items' ? [] : '');
    });
    setSelectedProductId('');
    setForm(initial);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    const initial = {};
    fields.forEach((f) => {
      if (f.type === 'order-items') {
        initial[f.name] = item.items || [];
      } else {
        initial[f.name] = item[f.name] ?? f.defaultValue ?? '';
      }
    });
    setSelectedProductId('');
    setForm(initial);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const payload = { ...form };
      if (hasOrderItemsField) {
        const orderItems = Array.isArray(form.items) ? form.items.map((item) => toOrderItem(item, item.quantity)) : [];
        if (!orderItems.length) {
          Swal.fire({
            icon: 'warning',
            title: 'Add a product',
            text: 'Please select at least one product from the Products list before creating this order.',
          });
          return;
        }
        payload.items = orderItems;
        payload.total = itemsTotal(orderItems);
      }
      if (editing) {
        await updateResource(resourcePath, editing._id, payload);
        Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
        onUpdated?.(editing, payload);
      } else {
        await createResource(resourcePath, payload);
        Swal.fire({ icon: 'success', title: 'Created', timer: 1200, showConfirmButton: false });
        onCreated?.(payload);
      }
      setModalOpen(false);
      load();
    } catch (saveError) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(saveError) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
    });
    if (!result.isConfirmed) return;
    try {
      await deleteResource(resourcePath, item._id);
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
      if (items.length === 1 && page > 1) setPage(page - 1);
      else load();
      onDeleted?.(item);
    } catch (deleteError) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(deleteError) });
    }
  };

  const renderField = (field) => {
    if (field.type === 'select') {
      return (
        <select
          className="input-field"
          value={form[field.name]}
          onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          rows={2}
          className="input-field"
          value={form[field.name]}
          onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
        />
      );
    }

    if (field.type === 'order-items') {
      const orderItems = Array.isArray(form[field.name]) ? form[field.name] : [];
      const setOrderItems = (nextItems) => {
        setForm((current) => ({
          ...current,
          [field.name]: nextItems,
          total: itemsTotal(nextItems),
        }));
      };

      const addProduct = (productId) => {
        const product = catalogProducts.find((entry) => String(entry._id) === String(productId));
        if (!product) return;
        const result = upsertOrderItem(orderItems, product, (entry) => toOrderItem(entry, 1));
        if (!result.ok) {
          const name = result.name || product.name || 'Product';
          if (result.reason === 'inactive') {
            toastWarning('Product inactive', `${name} is inactive and cannot be sold.`);
          } else if (result.reason === 'out_of_stock') {
            toastError('Out of stock', `${name} is out of stock.`);
          } else if (result.reason === 'stock_limit') {
            toastWarning('Stock limit', `Only ${result.stock} unit${result.stock === 1 ? '' : 's'} of ${name} available.`);
          }
          return;
        }
        setOrderItems(result.items);
        if (result.added) {
          toastSuccess('Product added', result.name);
        } else {
          toastSuccess('Quantity updated', `${result.name} × ${result.quantity}`);
        }
        setSelectedProductId('');
      };

      const addProductFromScan = (product) => {
        const result = upsertOrderItem(orderItems, product, (entry) => toOrderItem(entry, 1));
        if (!result.ok) {
          const name = result.name || product.name || 'Product';
          if (result.reason === 'inactive') {
            toastWarning('Product inactive', `${name} is inactive and cannot be sold.`);
          } else if (result.reason === 'out_of_stock') {
            toastError('Out of stock', `${name} is out of stock.`);
          } else if (result.reason === 'stock_limit') {
            toastWarning('Stock limit', `Only ${result.stock} unit${result.stock === 1 ? '' : 's'} of ${name} available.`);
          }
          return;
        }
        setOrderItems(result.items);
        if (result.added) {
          toastSuccess('Product added', `${result.name} — ${formatMoney(product.price)}`);
        } else {
          toastSuccess('Quantity updated', `${result.name} × ${result.quantity}`);
        }
      };

      return (
        <div className="space-y-2">
          <BarcodeScanInput
            onProductFound={addProductFromScan}
            placeholder="Scan barcode to add product…"
            autoFocus={false}
          />
          <select
            className="input-field"
            value={selectedProductId}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedProductId(value);
              if (value) addProduct(value);
            }}
          >
            <option value="">Select a product to add</option>
            {catalogProducts.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name} {product.brand ? `· ${product.brand}` : ''} {product.category ? `· ${product.category}` : ''} — {formatMoney(product.price)}
              </option>
            ))}
          </select>
          {!catalogProducts.length ? (
            <p className="text-xs panel-muted">No products found. Add products first in the Products section.</p>
          ) : null}
          {orderItems.length ? (
            <div className="space-y-2">
              {orderItems.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex gap-3 rounded-lg border divider-border p-2">
                  <ProductImage src={item.image} alt={item.productName} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold panel-title">{item.productName}</p>
                    <p className="text-xs panel-muted">
                      {[item.brand, item.category].filter(Boolean).join(' · ') || 'Perfume'}
                    </p>
                    {item.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs panel-muted">{item.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-medium panel-title">
                      {formatMoney(item.price)} × {item.quantity} = {formatMoney(Number(item.price) * Number(item.quantity))}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <input
                      type="number"
                      min="1"
                      className="input-field h-8 w-16 px-2"
                      value={item.quantity}
                      onChange={(e) => {
                        const quantity = Math.max(1, Number(e.target.value) || 1);
                        setOrderItems(orderItems.map((row, rowIndex) => (
                          rowIndex === index ? { ...row, quantity } : row
                        )));
                      }}
                    />
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => setOrderItems(orderItems.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs panel-muted">Scan a barcode or select a product above to add it to this order.</p>
          )}
        </div>
      );
    }

    return (
      <input
        type={field.type || 'text'}
        className="input-field"
        readOnly={field.readOnly}
        value={form[field.name]}
        onChange={(e) =>
          setForm({
            ...form,
            [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value,
          })
        }
      />
    );
  };

  const changePage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  };

  return (
    <div>
      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b divider-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
              <FiShoppingBag size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold panel-title">{title}</h2>
              <p className="text-xs panel-muted">{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center justify-center gap-2">
            <FiPlus size={16} />
            {createText || addLabel}
          </button>
        </div>

        <div className="flex flex-col gap-2 border-b divider-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-muted)]">
                <FiSearch size={16} />
              </span>
              <input
                type="search"
                placeholder="Search orders…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input-field pl-9 sm:w-64"
              />
            </div>
            {statusFilterOptions ? (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="input-field sm:w-auto"
              >
                <option value="">All statuses</option>
                {statusFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="text-xs panel-muted">
            {total.toLocaleString()} {total === 1 ? entityName.toLowerCase() : `${entityName.toLowerCase()}s`}
          </p>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="font-medium text-red-500">Unable to load {title.toLowerCase()}</p>
            <p className="text-sm panel-muted">{error}</p>
            <button type="button" className="btn-secondary" onClick={load}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b divider-border bg-[var(--surface-soft)]">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <tr key={item._id} className="transition-colors hover:bg-[var(--surface-soft)]">
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 align-top ${col.align === 'right' ? 'text-right' : ''}`}
                      >
                        {col.key === 'image' && !col.render ? (
                          <ProductImage src={item.image} alt={item.name || 'Item'} className="h-12 w-12" />
                        ) : col.render ? (
                          col.render(item)
                        ) : (
                          item[col.key]
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {viewDetails ? (
                          <button
                            type="button"
                            onClick={() => setViewing(item)}
                            title={`View ${entityName}`}
                            aria-label={`View ${entityName}`}
                            className={`${iconButton} bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--primary)]`}
                          >
                            <FiEye size={18} />
                          </button>
                        ) : null}
                        {extraActions ? extraActions(item) : null}
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title={`Edit ${entityName}`}
                          aria-label={`Edit ${entityName}`}
                          className={`${iconButton} bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--primary)]`}
                          >
                            <FiEdit2 size={18} />
                          </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          title={`Delete ${entityName}`}
                          aria-label={`Delete ${entityName}`}
                          className={`${iconButton} bg-[var(--surface)] text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:border-red-500/30 dark:hover:bg-red-500/10`}
                          >
                            <FiTrash2 size={18} />
                          </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4">
                      <EmptyState icon={FiInbox} title={emptyLabel} description="Try a different search or add a new record." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t divider-border px-4 py-3 sm:flex-row sm:px-5">
            <p className="text-xs panel-muted">
              Page {page} of {totalPages} · {total.toLocaleString()} records
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
                className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
              >
                <FiChevronLeft size={16} /> Prev
              </button>
              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page >= totalPages}
                className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
              >
                Next <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={Boolean(viewing)}
        title={`${entityName} details`}
        onClose={() => setViewing(null)}
        size={modalSize}
        footer={
          <button type="button" onClick={() => setViewing(null)} className="btn-secondary">
            Close
          </button>
        }
      >
        {viewing ? viewDetails(viewing) : null}
      </Modal>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${entityName}` : `Add ${entityName}`}
        onClose={closeModal}
        size={modalSize}
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? (editing ? 'Saving...' : 'Creating...') : editing ? 'Save' : 'Create'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          {fields.map((field) => (
            <div key={field.name} className={isFullWidth(field) ? 'form-span-2' : undefined}>
              <label className="form-label">{field.label}</label>
              {renderField(field)}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
