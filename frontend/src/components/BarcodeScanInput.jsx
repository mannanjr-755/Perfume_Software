import { useCallback, useEffect, useRef, useState } from 'react';
import { LuScanBarcode } from 'react-icons/lu';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import { fetchProductByBarcode } from '../services/resourceService.js';
import { normalizeBarcode } from '../utils/barcode.js';
import { toastError } from '../utils/toast.js';

const SCAN_KEY_GAP_MS = 60;

export default function BarcodeScanInput({
  onProductFound,
  onScanStateChange,
  disabled = false,
  inputRef: externalRef,
  className = '',
  ringClass = '',
  placeholder = 'Scan barcode here — or type the number and press Enter',
  autoFocus = true,
  captureGlobalScans = false,
}) {
  const [value, setValue] = useState('');
  const [searching, setSearching] = useState(false);
  const internalRef = useRef(null);
  const inputRef = externalRef || internalRef;
  const valueRef = useRef('');
  const searchingRef = useRef(false);
  const scanBufferRef = useRef('');
  const lastKeyAtRef = useRef(0);

  const setInputValue = useCallback((next) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  const lookupBarcode = useCallback(
    async (rawCode) => {
      if (searchingRef.current || disabled) return;
      const code = normalizeBarcode(rawCode);
      if (!code) {
        inputRef.current?.focus();
        return;
      }

      searchingRef.current = true;
      setSearching(true);
      onScanStateChange?.('idle');

      try {
        const res = await fetchProductByBarcode(code);
        const product = res.data ?? res;
        onProductFound?.(product);
        onScanStateChange?.('success');
        setInputValue('');
      } catch {
        onScanStateChange?.('error');
        toastError('Barcode not found', `No product matches barcode "${code}".`);
      } finally {
        searchingRef.current = false;
        setSearching(false);
        setInputValue('');
        inputRef.current?.focus();
        window.setTimeout(() => onScanStateChange?.('idle'), 1800);
      }
    },
    [disabled, inputRef, onProductFound, onScanStateChange, setInputValue]
  );

  useEffect(() => {
    if (!captureGlobalScans) return undefined;

    const onKeyDown = (event) => {
      if (disabled || searchingRef.current) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = Date.now();
      const gap = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;
      const fromBarcodeInput = event.target === inputRef.current;

      if (event.key === 'Enter') {
        const buffered = normalizeBarcode(scanBufferRef.current);
        const fromField = fromBarcodeInput
          ? normalizeBarcode(event.currentTarget?.value ?? valueRef.current)
          : '';

        if (fromBarcodeInput && fromField) {
          event.preventDefault();
          lookupBarcode(fromField);
          scanBufferRef.current = '';
          return;
        }

        if (!fromBarcodeInput && buffered.length >= 4 && gap <= SCAN_KEY_GAP_MS) {
          event.preventDefault();
          event.stopPropagation();
          setInputValue(buffered);
          lookupBarcode(buffered);
          scanBufferRef.current = '';
        } else {
          scanBufferRef.current = '';
        }
        return;
      }

      if (event.key.length !== 1) return;

      if (gap > SCAN_KEY_GAP_MS) {
        scanBufferRef.current = event.key;
      } else {
        scanBufferRef.current += event.key;
      }

      if (!fromBarcodeInput && gap <= SCAN_KEY_GAP_MS) {
        event.preventDefault();
        const next = scanBufferRef.current.slice(0, 64);
        setInputValue(next);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [captureGlobalScans, disabled, inputRef, lookupBarcode, setInputValue]);

  return (
    <div className={`relative flex-1 rounded-lg ${ringClass} ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-muted)]">
        <LuScanBarcode size={18} />
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        autoComplete="off"
        disabled={disabled || searching}
        value={value}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            lookupBarcode(e.currentTarget.value);
          }
        }}
        placeholder={placeholder}
        className="input-field pl-10 pr-10 barcode-ready"
        aria-label="Scan barcode"
      />
      {searching ? (
        <span className="absolute inset-y-0 right-3 flex items-center">
          <LoadingSpinner size="sm" />
        </span>
      ) : (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
        </span>
      )}
    </div>
  );
}
