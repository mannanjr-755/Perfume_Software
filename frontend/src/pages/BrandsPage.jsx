import { FiAward } from 'react-icons/fi';
import ResourceCrudPage from './ResourceCrudPage.jsx';

const statusFilterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function BrandsPage() {
  return (
    <ResourceCrudPage
      title="Brands"
      subtitle="Manage perfume brands"
      resourcePath="/brands"
      statusFilterOptions={statusFilterOptions}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        {
          key: 'productCount',
          label: 'Products',
          render: (r) => (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold">
              <FiAward size={13} className="text-[var(--primary)]" />
              {r.productCount ?? 0}
            </span>
          ),
        },
        { key: 'status', label: 'Status', render: (r) => <span className="capitalize">{r.status || 'active'}</span> },
      ]}
      itemLabel="Brand"
      fields={[
        { name: 'name', label: 'Brand Name', fullWidth: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  );
}
