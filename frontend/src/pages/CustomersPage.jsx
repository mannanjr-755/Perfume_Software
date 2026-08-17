import ResourceCrudPage from './ResourceCrudPage.jsx';
import { formatMoney } from '../utils/currency.js';

const statusFilterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function CustomersPage() {
  return (
    <ResourceCrudPage
      title="Customers"
      subtitle="Manage your customer database"
      resourcePath="/customers"
      statusFilterOptions={statusFilterOptions}
      pageSize={10}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'city', label: 'City' },
        {
          key: 'totalOrders',
          label: 'Orders',
          render: (r) => <span className="font-medium">{r.totalOrders ?? 0}</span>,
        },
        {
          key: 'totalSpending',
          label: 'Total Spent',
          render: (r) => (
            <span className="font-semibold text-[var(--primary)]">{formatMoney(r.totalSpending ?? 0)}</span>
          ),
        },
        {
          key: 'lastOrder',
          label: 'Last Order',
          render: (r) =>
            r.lastOrder ? <span className="panel-muted">{new Date(r.lastOrder).toLocaleDateString()}</span> : <span className="panel-muted">—</span>,
        },
      ]}
      itemLabel="Customer"
      fields={[
        { name: 'name', label: 'Name' },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'city', label: 'City' },
        { name: 'country', label: 'Country' },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'active' },
        { name: 'address', label: 'Address', fullWidth: true },
      ]}
    />
  );
}
