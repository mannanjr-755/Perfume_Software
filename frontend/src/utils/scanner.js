const LAST_SCAN_KEY = 'perfume-last-barcode-scan';
const SCAN_EVENT = 'perfume:barcode-scan';

export function publishBarcodeScan(barcode) {
  const scan = {
    barcode,
    scannedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(scan));
  } catch {
    // The in-memory event still works when storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(SCAN_EVENT, { detail: scan }));
}

export function readLastBarcodeScan() {
  try {
    const value = localStorage.getItem(LAST_SCAN_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function onBarcodeScan(listener) {
  const handleScan = (event) => listener(event.detail);
  window.addEventListener(SCAN_EVENT, handleScan);
  return () => window.removeEventListener(SCAN_EVENT, handleScan);
}
