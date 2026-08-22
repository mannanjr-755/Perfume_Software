import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiGrid,
  FiPackage,
  FiTag,
  FiAward,
  FiShoppingCart,
  FiUsers,
  FiBarChart2,
  FiBell,
  FiSettings,
  FiMoon,
  FiSun,
  FiMenu,
  FiX,
} from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { fetchDashboardStats } from '../services/resourceService.js';
import GlobalSearch from '../components/GlobalSearch.jsx';
import BrandLogo from '../components/ui/BrandLogo.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/dashboard/orders', label: 'Orders', icon: FiShoppingCart },
  { to: '/dashboard/products', label: 'Products', icon: FiPackage },
  { to: '/dashboard/categories', label: 'Categories', icon: FiTag },
  { to: '/dashboard/brands', label: 'Brands', icon: FiAward },
  { to: '/dashboard/customers', label: 'Customers', icon: FiUsers },
  { to: '/dashboard/reports', label: 'Sales & Reports', icon: FiBarChart2 },
  { to: '/dashboard/notifications', label: 'Notifications', icon: FiBell },
  { to: '/dashboard/settings', label: 'Settings', icon: FiSettings },
];

export default function DashboardLayout() {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [storeName, setStoreName] = useState('Scent Yours');

  const pageTitle = useMemo(() => {
    const item = navItems.find((entry) =>
      entry.end ? location.pathname === entry.to : location.pathname.startsWith(entry.to)
    );
    return item?.label || 'Dashboard';
  }, [location.pathname]);

  const refreshBadge = useCallback(async () => {
    try {
      const res = await fetchDashboardStats();
      const stats = res?.data?.stats || {};
      setUnreadNotifications(stats.unreadNotifications ?? 0);
      if (stats.storeName) setStoreName(stats.storeName);
    } catch {
      /* keep last known values */
    }
  }, []);

  useEffect(() => {
    refreshBadge();
    const interval = setInterval(refreshBadge, 30000);
    return () => clearInterval(interval);
  }, [refreshBadge, location.pathname]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {mobileSidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`sidebar-shell relative fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 -translate-x-full flex-col overflow-hidden transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-72 lg:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0' : ''}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-5 pt-6 sm:px-5">
          <BrandLogo title={storeName} />
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-lg p-2 text-[var(--sidebar-muted)] hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <FiX size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'sidebar-item-active' : 'hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              <span className="flex flex-1 items-center justify-between">
                {label}
                {label === 'Notifications' && unreadNotifications > 0 ? (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {unreadNotifications}
                  </span>
                ) : null}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-44 overflow-hidden opacity-30">
          <img
            src="/sidebar-perfume.png"
            alt=""
            className="h-full w-full object-cover object-bottom"
          />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b divider-border bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-lg p-2 text-gray-600 hover:bg-[var(--surface-soft)] lg:hidden"
                aria-label="Open menu"
              >
                <FiMenu size={20} />
              </button>
              <p className="panel-title min-w-0 truncate text-xl font-semibold">{pageTitle}</p>
            </div>

            <div className="hidden flex-1 justify-center px-2 md:flex">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard/notifications')}
                className="relative rounded-lg p-2 text-gray-600 hover:bg-[var(--surface-soft)] dark:text-gray-300"
                aria-label="Notifications"
              >
                <FiBell size={20} />
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-white">
                    {Math.min(unreadNotifications, 99)}
                  </span>
                ) : (
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                )}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-gray-600 outline-none hover:bg-[var(--surface-soft)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] dark:text-gray-300"
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
              </button>
            </div>
          </div>
          <div className="mt-3 md:hidden">
            <GlobalSearch />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
