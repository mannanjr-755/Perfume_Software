import { useEffect, useState } from 'react';
import ResourceCrudPage from './ResourceCrudPage.jsx';
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
      columns={[
        { key: 'image', label: 'Image' },
        { key: 'name', label: 'Name' },
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category' },
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
        { name: 'sku', label: 'SKU (Stock Keeping Unit)' },
        { name: 'price', label: 'Price (PKR)', type: 'number' },
        { name: 'purchasePrice', label: 'Purchase Price (PKR)', type: 'number', defaultValue: 0 },
        { name: 'stock', label: 'Stock', type: 'number', defaultValue: 0 },
        { name: 'lowStockThreshold', label: 'Low Stock Alert At', type: 'number', defaultValue: 5 },
        { name: 'barcode', label: 'Barcode (Code 128)', type: 'barcode' },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'active' },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'image', label: 'Product Image', type: 'image' },
      ]}
      onDeleted={() => {}}
    />
  );
}
