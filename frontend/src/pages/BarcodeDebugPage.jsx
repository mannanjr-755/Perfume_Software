import { useEffect, useMemo, useState } from 'react';
import { fetchProductByBarcode } from '../services/resourceService.js';
import { normalizeBarcode } from '../utils/barcode.js';

function readStoredDebugEvents() {
  try {
    const raw = sessionStorage.getItem('perfume-barcode-debug');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function BarcodeDebugPage() {
  const [barcode, setBarcode] = useState('');
  const [events, setEvents] = useState(readStoredDebugEvents());
  const [apiRequest, setApiRequest] = useState(null);
  const [apiResponse, setApiResponse] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (event) => {
      setEvents((current) => [...current.slice(-79), event.detail]);
    };

    window.addEventListener('perfume:barcode-debug', handler);
    return () => window.removeEventListener('perfume:barcode-debug', handler);
  }, []);

  const handleManualScan = async () => {
    const normalized = normalizeBarcode(barcode);
    if (!normalized) return;
    setLoading(true);
    setError('');
    setApiRequest({ barcode: normalized, time: new Date().toISOString() });
    try {
      const response = await fetchProductByBarcode(normalized);
      setApiResponse(response);
      setLookupResult(response?.data || response);
    } catch (err) {
      setError(err?.message || 'Lookup failed');
      setApiResponse({ error: err?.message || 'Lookup failed' });
      setLookupResult(null);
    } finally {
      setLoading(false);
    }
  };

  const formattedEvents = useMemo(() => [...events].reverse(), [events]);

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface p-5">
          <h1 className="text-2xl font-bold panel-title">Barcode Debug</h1>
          <p className="mt-2 text-sm panel-muted">Current barcode, scanner events, API requests and product lookup result.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold panel-title">Manual probe</h2>
            <div className="mt-4 flex gap-3">
              <input
                className="input-field flex-1"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Enter or scan a barcode"
              />
              <button type="button" onClick={handleManualScan} className="btn-primary" disabled={loading}>
                {loading ? 'Searching...' : 'Lookup'}
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div><span className="panel-muted">Current scanned barcode:</span> <span className="font-mono font-semibold">{barcode || '—'}</span></div>
              <div><span className="panel-muted">Normalized:</span> <span className="font-mono font-semibold">{normalizeBarcode(barcode) || '—'}</span></div>
            </div>
          </div>

          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold panel-title">API request / response</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-lg border divider-border bg-[var(--surface-soft)] p-3">
                <p className="font-semibold">Request</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">{apiRequest ? JSON.stringify(apiRequest, null, 2) : 'No request yet.'}</pre>
              </div>
              <div className="rounded-lg border divider-border bg-[var(--surface-soft)] p-3">
                <p className="font-semibold">Response</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">{apiResponse ? JSON.stringify(apiResponse, null, 2) : 'No response yet.'}</pre>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold panel-title">Scanner events</h2>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-auto">
              {formattedEvents.length === 0 ? (
                <p className="text-sm panel-muted">No scanner events yet.</p>
              ) : (
                formattedEvents.map((event, index) => (
                  <div key={`${event.timestamp}-${index}`} className="rounded border divider-border bg-[var(--surface-soft)] p-2 text-xs">
                    <div className="font-semibold text-[var(--primary)]">{event.eventName}</div>
                    <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(event, null, 2)}</pre>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold panel-title">Product lookup result</h2>
            <div className="mt-4 rounded-lg border divider-border bg-[var(--surface-soft)] p-3 text-sm">
              {error ? <div className="text-red-500">{error}</div> : null}
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">{lookupResult ? JSON.stringify(lookupResult, null, 2) : 'No product lookup yet.'}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
