import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { LuBarcode } from 'react-icons/lu';
import { FiChevronLeft, FiChevronRight, FiInbox } from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader.jsx';
import Modal from '../components/ui/Modal.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import {
  fetchResource,
  createResource,
  updateResource,
  deleteResource,
  uploadProductImage,
  generateProductBarcode,
} from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import ProductImage from '../components/ui/ProductImage.jsx';
import BarcodeLabel from '../components/ui/BarcodeLabel.jsx';
import BarcodeScanInput from '../components/BarcodeScanInput.jsx';
import { printBarcodeLabel } from '../utils/printBarcode.js';
import { formatMoney } from '../utils/currency.js';

function isFullWidth(field) {
  return Boolean(
    field.fullWidth ||
      field.type === 'textarea' ||
      field.type === 'image' ||
      field.type === 'order-items' ||
      field.type === 'barcode'
  );
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
    size: product.size || '',
    quantity: Math.max(1, Number(quantity) || 1),
    price: Number(product.price || 0),
  };
}

function itemsTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

export default function ResourceCrudPage({
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
  enableBarcodeScan = false,
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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
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
      const options = field.options || [];
      const value = form[field.name];
      const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
      const missingValue = hasValue && !options.some((opt) => String(opt.value) === String(value));
      return (
        <select
          className="input-field"
          value={value}
          onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
        >
          {missingValue ? <option value={value}>{value}</option> : null}
          {options.map((opt) => (
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

    if (field.type === 'barcode') {
      const handleGenerate = async () => {
        try {
          const res = await generateProductBarcode();
          const code = res.data?.barcode || res.barcode;
          if (!code) throw new Error('No barcode returned.');
          setForm({ ...form, [field.name]: code });
        } catch (genError) {
          Swal.fire({ icon: 'error', title: 'Generate failed', text: getErrorMessage(genError) });
        }
      };

      return (
        <div className="space-y-2">
          <BarcodeScanInput
            mode="value"
            keepValue
            autoFocus={false}
            captureGlobalScans
            placeholder="Scan barcode to fill this field"
            onCode={(code) => setForm((current) => ({ ...current, [field.name]: code }))}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[var(--text-muted)]">
                <LuBarcode size={16} />
              </span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Or type barcode manually (leading zeros are kept)"
                className="input-field pl-9"
                value={form[field.name] || ''}
                onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
              />
            </div>
            <button type="button" onClick={handleGenerate} className="btn-secondary whitespace-nowrap">
              Generate
            </button>
          </div>
          {form[field.name] ? (
            <div className="flex flex-col gap-3 rounded-lg border divider-border bg-[var(--surface-soft)] p-3 sm:flex-row sm:items-center">
              <div className="shrink-0 rounded-md bg-white p-2">
                <BarcodeLabel value={form[field.name]} height={40} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-all font-mono text-sm font-semibold panel-title">{form[field.name]}</p>
                <p className="text-xs panel-muted">EAN-13 / Code 128 — scanned or generated barcode</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  printBarcodeLabel({
                    value: form[field.name],
                    name: form.name || '',
                    brand: form.brand || '',
                    price: form.price,
                  })
                }
                className="btn-secondary whitespace-nowrap"
              >
                Print label
              </button>
            </div>
          ) : (
            <p className="text-xs panel-muted">
              Scan a USB/Bluetooth HID scanner, type the code (leading zeros are kept), or Generate. Duplicate barcodes cannot be saved. If left empty on create, a unique barcode is assigned automatically.
            </p>
          )}
        </div>
      );
    }

    if (field.type === 'order-items') {
      const orderItems = Array.isArray(form[field.name]) ? form[field.name] : [];
      const available = catalogProducts.filter(
        (product) => !orderItems.some((item) => String(item.productId) === String(product._id))
      );

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
        setOrderItems([...orderItems, toOrderItem(product, 1)]);
        setSelectedProductId('');
      };

      return (
        <div className="space-y-2">
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
            {available.map((product) => (
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
            <p className="text-xs panel-muted">Select a product above. It will be added to this order immediately.</p>
          )}
        </div>
      );
    }

    if (field.type === 'image') {
      return (
        <div className="flex items-start gap-3">
          <ProductImage src={form[field.name]} alt="Preview" className="h-14 w-14" />
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="input-field"
              disabled={uploading}
              onChange={async (e) => {
                const input = e.target;
                const file = input.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const res = await uploadProductImage(file);
                  const url = res.data?.url || res.url;
                  if (!url) throw new Error('Upload succeeded but no image URL was returned.');
                  setForm((current) => ({ ...current, [field.name]: url }));
                } catch (uploadError) {
                  Swal.fire({ icon: 'error', title: 'Upload failed', text: getErrorMessage(uploadError) });
                } finally {
                  setUploading(false);
                  input.value = '';
                }
              }}
            />
            {uploading ? <p className="text-xs panel-muted">Uploading image...</p> : null}
            <input
              type="text"
              placeholder="Or paste an image URL"
              className="input-field"
              value={form[field.name] || ''}
              onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
            />
          </div>
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
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <button type="button" onClick={openCreate} className="btn-primary">
            {createText || addLabel}
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {enableBarcodeScan && !modalOpen ? (
            <BarcodeScanInput
              autoFocus={false}
              captureGlobalScans
              placeholder="Scan barcode to open product"
              className="sm:min-w-[280px]"
              onProductFound={(product) => {
                if (viewDetails) setViewing(product);
                else openEdit(product);
              }}
              onNotFound={(code) => {
                Swal.fire({
                  icon: 'error',
                  title: 'Product Not Found',
                  text: `Barcode:\n${code}\nThis barcode is not assigned to any product.`,
                });
              }}
              notifyErrors={false}
            />
          ) : null}
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field sm:max-w-xs"
          />
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
        <div className="card-surface flex flex-col items-center gap-3 p-8 text-center">
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
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b divider-border bg-[var(--surface-soft)] text-left text-gray-600 dark:text-gray-300">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-medium">{col.label}</th>
                  ))}
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-t divider-border hover:bg-[var(--surface-soft)]">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-gray-800 dark:text-gray-200">
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
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {viewDetails ? (
                          <button
                            type="button"
                            onClick={() => setViewing(item)}
                            className="text-sm font-medium text-[var(--primary)] hover:underline"
                          >
                            View
                          </button>
                        ) : null}
                        {extraActions ? extraActions(item) : null}
                        <button type="button" onClick={() => openEdit(item)} className="text-sm font-medium text-gray-700 hover:underline dark:text-gray-300">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(item)} className="text-sm font-medium text-red-500 hover:underline">
                          Delete
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

          {total > pageSize ? (
            <div className="flex flex-col items-center justify-between gap-3 border-t divider-border px-4 py-3 sm:flex-row">
              <p className="text-xs panel-muted">
                Page {page} of {totalPages} · {total.toLocaleString()} records
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => changePage(page - 1)}
                  disabled={page <= 1}
                  className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <FiChevronLeft size={15} /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => changePage(page + 1)}
                  disabled={page >= totalPages}
                  className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
                >
                  Next <FiChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

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
            <button type="button" onClick={handleSave} className="btn-primary" disabled={uploading || saving}>
              {uploading ? 'Uploading...' : saving ? (editing ? 'Saving...' : 'Creating...') : editing ? 'Save' : 'Create'}
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
