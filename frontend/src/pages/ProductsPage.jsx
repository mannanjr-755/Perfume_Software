import { useEffect, useState } from 'react';
import ResourceCrudPage from './ResourceCrudPage.jsx';
import ProductImage from '../components/ui/ProductImage.jsx';
import BarcodeLabel from '../components/ui/BarcodeLabel.jsx';
import { fetchResource } from '../services/resourceService.js';
import { formatMoney } from '../utils/currency.js';

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const statusFilterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

function toSelectOptions(items, placeholder) {
  const options = [{ value: '', label: placeholder }];
  (items || []).forEach((item) => {
    if (item && item.name) options.push({ value: item.name, label: item.name });
  });
  return options;
}

function stockBadge(item) {
  const stock = Number(item.stock) || 0;
  const threshold = Number(item.lowStockThreshold) > 0 ? Number(item.lowStockThreshold) : 5;
  if (stock === 0) {
    return (
      <div className="space-y-1">
        <span className="font-medium text-red-500">0</span>
        <span className="block w-fit rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
          Out of Stock
        </span>
      </div>
    );
  }
  if (stock <= threshold) {
    return (
      <div className="space-y-1">
        <span className="font-medium text-amber-600 dark:text-amber-400">{stock}</span>
        <span className="block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          Low Stock
        </span>
      </div>
    );
  }
  return <span className="font-medium">{stock}</span>;
}

function barcodeCell(item) {
  if (!item.barcode) return <span className="panel-muted">—</span>;
  return <span className="break-all font-mono text-xs">{item.barcode}</span>;
}

function ProductInventoryDetails({ item }) {
  const stock = Number(item.stock) || 0;
  const threshold = Number(item.lowStockThreshold) > 0 ? Number(item.lowStockThreshold) : 5;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ProductImage src={item.image} alt={item.name} className="h-16 w-16" />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold panel-title">{item.name}</h3>
          <p className="text-sm panel-muted">
            {[item.brand, item.category, item.size].filter(Boolean).join(' · ') || 'Perfume'}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs panel-muted">Current stock</dt>
          <dd className="font-semibold panel-title">{stock}</dd>
        </div>
        <div>
          <dt className="text-xs panel-muted">Minimum stock</dt>
          <dd className="font-semibold panel-title">{threshold}</dd>
        </div>
        <div>
          <dt className="text-xs panel-muted">Purchase price</dt>
          <dd className="font-semibold panel-title">{formatMoney(item.purchasePrice)}</dd>
        </div>
        <div>
          <dt className="text-xs panel-muted">Sale price</dt>
          <dd className="font-semibold panel-title">{formatMoney(item.price)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs panel-muted">Barcode</dt>
          <dd className="break-all font-mono text-sm font-semibold panel-title">{item.barcode || '—'}</dd>
        </div>
      </dl>
      {item.barcode ? (
        <div className="rounded-lg border divider-border bg-white p-3">
          <BarcodeLabel value={item.barcode} height={48} />
        </div>
      ) : null}
      {item.description ? <p className="text-sm panel-muted">{item.description}</p> : null}
      <p className="text-xs panel-muted">
        Use Edit to adjust stock or prices. Stock is deducted only after a completed sale.
      </p>
    </div>
  );
}

export default function ProductsPage() {
  const [categoryOptions, setCategoryOptions] = useState([{ value: '', label: 'Select category' }]);
  const [brandOptions, setBrandOptions] = useState([{ value: '', label: 'Select brand' }]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          fetchResource('/categories', { limit: 200 }),
          fetchResource('/brands', { limit: 200 }),
        ]);
        if (!active) return;
        const cats = catRes.data || catRes;
        const brands = brandRes.data || brandRes;
        setCategoryOptions(toSelectOptions(cats.items || cats || [], 'Select category'));
        setBrandOptions(toSelectOptions(brands.items || brands || [], 'Select brand'));
      } catch {
        if (active) {
          setCategoryOptions([{ value: '', label: 'Select category' }]);
          setBrandOptions([{ value: '', label: 'Select brand' }]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ResourceCrudPage
      title="Products"
      subtitle="Add, edit and manage your perfume products"
      resourcePath="/products"
      statusFilterOptions={statusFilterOptions}
      pageSize={10}
      enableBarcodeScan
      viewDetails={(item) => <ProductInventoryDetails item={item} />}
      columns={[
        { key: 'image', label: 'Image' },
        { key: 'name', label: 'Name' },
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category' },
        { key: 'size', label: 'Size' },
        { key: 'price', label: 'Price', render: (r) => formatMoney(r.price) },
        { key: 'sku', label: 'SKU' },
        { key: 'barcode', label: 'Barcode', render: barcodeCell },
        { key: 'stock', label: 'Stock', render: stockBadge },
        { key: 'status', label: 'Status' },
      ]}
      itemLabel="Product"
      modalSize="lg"
      fields={[
        { name: 'name', label: 'Product Name' },
        { name: 'category', label: 'Category', type: 'select', options: categoryOptions },
        { name: 'brand', label: 'Brand', type: 'select', options: brandOptions },
        { name: 'size', label: 'Size / Volume', defaultValue: '100ml' },
        { name: 'sku', label: 'SKU (Stock Keeping Unit)' },
        { name: 'price', label: 'Sale Price (PKR)', type: 'number' },
        { name: 'purchasePrice', label: 'Purchase Price (PKR)', type: 'number', defaultValue: 0 },
        { name: 'stock', label: 'Current Stock', type: 'number', defaultValue: 0 },
        { name: 'lowStockThreshold', label: 'Minimum Stock / Low Stock Alert At', type: 'number', defaultValue: 5 },
        { name: 'barcode', label: 'Barcode', type: 'barcode' },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'active' },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'image', label: 'Product Image', type: 'image' },
      ]}
      onDeleted={() => {}}
    />
  );
}
