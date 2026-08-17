import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import api from '../services/api.js';
import { getErrorMessage } from '../services/api.js';
import { uploadProductImage } from '../services/resourceService.js';

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

function Section({ title, subtitle, children, actions }) {
  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold panel-title">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs panel-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="form-grid">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/settings');
        setSettings(data.data || data);
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { data } = await api.put('/settings', settings);
      setSettings(data.data || data);
      Swal.fire({ icon: 'success', title: 'Settings saved', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await uploadProductImage(file);
      const url = res.data?.url || res.url;
      if (!url) throw new Error('Upload succeeded but no image URL was returned.');
      setSettings((current) => ({ ...current, logo: url }));
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Upload failed', text: getErrorMessage(error) });
    } finally {
      setUploadingLogo(false);
      input.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!settings) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Store configuration"
        action={
          <button type="button" onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        }
      />

      <Section title="Store Information" subtitle="Shown across the store and receipts">
        <Field label="Store Name">
          <input className="input-field" value={settings.storeName ?? ''} onChange={(e) => set('storeName', e.target.value)} />
        </Field>
        <Field label="Store Email">
          <input className="input-field" type="email" value={settings.storeEmail ?? ''} onChange={(e) => set('storeEmail', e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className="input-field" value={settings.storePhone ?? ''} onChange={(e) => set('storePhone', e.target.value)} />
        </Field>
        <Field label="Currency">
          <input className="input-field" value="PKR (Rs.)" readOnly />
        </Field>
        <Field label="Address">
          <input className="input-field" value={settings.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Order Number Prefix" hint="Used for new order numbers, e.g. PFM-0001.">
          <input className="input-field" value={settings.orderPrefix ?? 'PFM-'} onChange={(e) => set('orderPrefix', e.target.value)} />
        </Field>
      </Section>

      <Section title="Store Logo" subtitle="Used in the header and receipts">
        <div className="form-span-2 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="brand-logo-wrap h-20 w-20 rounded-2xl bg-[var(--surface-soft)] p-2">
            <img src={settings.logo || '/logo.jpg'} alt="Store logo" className="brand-logo" />
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="input-field"
              disabled={uploadingLogo}
              onChange={handleLogoUpload}
            />
            {uploadingLogo ? <p className="text-xs panel-muted">Uploading logo...</p> : null}
            <input
              type="text"
              placeholder="Or paste an image URL"
              className="input-field"
              value={settings.logo || ''}
              onChange={(e) => set('logo', e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="Inventory & Notifications" subtitle="Low stock alerts and order event notifications">
        <Field label="Low Stock Threshold" hint="Products at or below this quantity trigger a low-stock alert.">
          <input
            type="number"
            min="0"
            className="input-field"
            value={settings.lowStockThreshold ?? 5}
            onChange={(e) => set('lowStockThreshold', Math.max(0, Number(e.target.value)))}
          />
        </Field>
        <Field label="Tax Rate (%)">
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field"
            value={settings.taxRate ?? 0}
            onChange={(e) => set('taxRate', Number(e.target.value))}
          />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border divider-border p-3">
          <span className="text-sm font-medium text-[var(--text)]">Low stock notifications</span>
          <input
            type="checkbox"
            checked={settings.notifyLowStock !== false}
            onChange={(e) => set('notifyLowStock', e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border divider-border p-3">
          <span className="text-sm font-medium text-[var(--text)]">New order notifications</span>
          <input
            type="checkbox"
            checked={settings.notifyNewOrder !== false}
            onChange={(e) => set('notifyNewOrder', e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        </label>
      </Section>
    </div>
  );
}
