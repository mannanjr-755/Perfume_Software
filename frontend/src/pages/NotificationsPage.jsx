import { useCallback, useEffect, useState } from 'react';
import { FiBell, FiTrash2, FiInfo, FiCheckCircle, FiAlertTriangle, FiXCircle } from 'react-icons/fi';
import Swal from 'sweetalert2';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import api from '../services/api.js';
import { getErrorMessage } from '../services/api.js';

const typeMeta = {
  info: { icon: FiInfo, color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  success: { icon: FiCheckCircle, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  warning: { icon: FiAlertTriangle, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  error: { icon: FiXCircle, color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
};

function timeAgo(value) {
  if (!value) return '';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/notifications', { params: { limit: 100, sort: '-createdAt' } });
      setItems(data.data?.items || data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (item) => {
    if (item.read) return;
    try {
      await api.put(`/notifications/${item._id}/read`);
      setItems((current) => current.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(err) });
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((current) => current.map((n) => ({ ...n, read: true })));
      Swal.fire({ icon: 'success', title: 'All marked as read', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(err) });
    }
  };

  const removeOne = async (item) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete notification?',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/notifications/${item._id}`);
      setItems((current) => current.filter((n) => n._id !== item._id));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(err) });
    }
  };

  const clearAll = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Clear all notifications?',
      text: 'This will remove every notification permanently.',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete('/notifications');
      setItems([]);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(err) });
    }
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Store alerts, order events and low stock warnings"
        action={
          items.length ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={markAllRead} disabled={unread === 0}>
                Mark all read
              </button>
              <button type="button" className="btn-secondary text-red-600" onClick={clearAll}>
                Clear all
              </button>
            </div>
          ) : null
        }
      />

      {error ? (
        <div className="card-surface flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium text-red-500">Unable to load notifications</p>
          <p className="text-sm panel-muted">{error}</p>
          <button type="button" className="btn-secondary" onClick={load}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="card-surface">
          <EmptyState icon={FiBell} title="No notifications" description="New order, low stock and other alerts will appear here." />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs panel-muted">
            {unread > 0 ? `${unread} unread of ${items.length}` : `All ${items.length} read`}
          </p>
          {items.map((item) => {
            const meta = typeMeta[item.type] || typeMeta.info;
            return (
              <div
                key={item._id}
                className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition ${
                  item.read
                    ? 'divider-border bg-[var(--surface)]'
                    : 'border-[var(--primary)]/40 bg-[var(--primary)]/5'
                }`}
                onClick={() => markRead(item)}
              >
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                  <meta.icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</span>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">{timeAgo(item.createdAt)}</span>
                  </span>
                  {item.message ? (
                    <span className="mt-0.5 block text-sm text-[var(--text-muted)]">{item.message}</span>
                  ) : null}
                </span>
                {!item.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" /> : null}
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-red-500"
                  title="Delete"
                  aria-label="Delete notification"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOne(item);
                  }}
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
