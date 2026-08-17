import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPackage, FiShoppingCart, FiUsers, FiTag, FiAward, FiX } from 'react-icons/fi';
import api from '../services/api.js';

const groupMeta = {
  products: { icon: FiPackage, route: '/dashboard/products' },
  orders: { icon: FiShoppingCart, route: '/dashboard/orders' },
  customers: { icon: FiUsers, route: '/dashboard/customers' },
  categories: { icon: FiTag, route: '/dashboard/categories' },
  brands: { icon: FiAward, route: '/dashboard/brands' },
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const activeRef = useRef(true);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    clearTimeout(timerRef.current);
    activeRef.current = true;
    if (!q) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/search', { params: { q } });
        if (activeRef.current) setResults(data.data || {});
      } catch {
        if (activeRef.current) setResults({});
      } finally {
        if (activeRef.current) setLoading(false);
      }
    }, 300);
    return () => {
      activeRef.current = false;
    };
  }, [query]);

  const total = results
    ? Object.values(results).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0)
    : 0;

  const go = (route) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(route);
  };

  const renderGroup = (key, label) => {
    const items = results?.[key];
    if (!Array.isArray(items) || items.length === 0) return null;
    const meta = groupMeta[key];
    return (
      <div key={key} className="px-1 py-1">
        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </p>
        {items.slice(0, 6).map((item) => (
          <button
            key={item._id || item.id}
            type="button"
            onClick={() => go(meta.route)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)]"
          >
            <meta.icon size={16} className="shrink-0 text-[var(--text-muted)]" />
            <span className="min-w-0 flex-1 truncate font-medium">{item.name || item.title}</span>
            {item.sku ? <span className="shrink-0 text-xs text-[var(--text-muted)]">{item.sku}</span> : null}
            {typeof item.price === 'number' ? (
              <span className="shrink-0 text-xs font-semibold text-[var(--primary)]">
                {item.price.toLocaleString()}
              </span>
            ) : null}
            {key === 'orders' && item.orderNumber ? (
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{item.orderNumber}</span>
            ) : null}
          </button>
        ))}
        {items.length > 6 ? (
          <button
            type="button"
            onClick={() => go(meta.route)}
            className="w-full px-3 py-1.5 text-left text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-soft)]"
          >
            View all {items.length} {label.toLowerCase()} →
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border divider-border bg-[var(--surface)] px-3 py-2">
        <FiSearch size={16} className="panel-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          placeholder="Search products, orders, customers..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        {query ? (
          <button type="button" onClick={() => setQuery('')} className="panel-muted hover:text-[var(--text)]" aria-label="Clear search">
            <FiX size={16} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border divider-border bg-[var(--surface)] shadow-2xl">
          {loading ? (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-[var(--text-muted)]">
              <div className="spinner"></div> Searching...
            </div>
          ) : !query.trim() ? (
            <p className="px-4 py-4 text-sm text-[var(--text-muted)]">Type to search across the store.</p>
          ) : total === 0 ? (
            <p className="px-4 py-4 text-sm text-[var(--text-muted)]">
              No results for “{query.trim()}”.
            </p>
          ) : (
            <>
              {renderGroup('products', 'Products')}
              {renderGroup('orders', 'Orders')}
              {renderGroup('customers', 'Customers')}
              {renderGroup('categories', 'Categories')}
              {renderGroup('brands', 'Brands')}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
