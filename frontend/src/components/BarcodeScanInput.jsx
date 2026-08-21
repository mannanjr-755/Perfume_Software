import { useCallback, useEffect, useRef, useState } from 'react';
import { LuScanBarcode } from 'react-icons/lu';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import { fetchProductByBarcode } from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import { normalizeBarcode } from '../utils/barcode.js';
import { toastError } from '../utils/toast.js';

/** USB scanners are ~5–20ms/char; Bluetooth HID wedges are often 30–80ms/char. */
const SCANNER_CHAR_GAP_MS = 80;
/** Reset the buffer after a pause — new scan or human typing. */
const BUFFER_RESET_MS = 400;
/** Bluetooth scanners that send no Enter/Tab suffix. */
const IDLE_SUBMIT_MS = 180;
const MIN_BARCODE_LENGTH = 4;
const MAX_BARCODE_LENGTH = 64;

function isTerminator(key) {
  return key === 'Enter' || key === 'NumpadEnter' || key === 'Tab';
}

function isBarcodeChar(key) {
  return key.length === 1 && !/[\u0000-\u001f]/.test(key);
}

function isEditableTarget(target) {
  if (!target || target === document.body) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.isContentEditable);
}

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
  const [searching, setSearching] = useState(false);
  const internalRef = useRef(null);
  const inputRef = externalRef || internalRef;
  const searchingRef = useRef(false);
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);
  const idleTimerRef = useRef(0);
  const lookupRef = useRef(async () => {});
  const queueRef = useRef([]);

  const setFieldValue = useCallback((next) => {
    if (inputRef.current) inputRef.current.value = next;
  }, [inputRef]);

  const lookupBarcode = useCallback(
    async (rawCode) => {
      const code = normalizeBarcode(rawCode);
      if (!code) return;

      if (searchingRef.current) {
        if (!queueRef.current.includes(code)) queueRef.current.push(code);
        return;
      }

      searchingRef.current = true;
      setSearching(true);
      onScanStateChange?.('idle');
      bufferRef.current = '';
      setFieldValue('');

      try {
        const res = await fetchProductByBarcode(code);
        const product = res?.data ?? res;
        if (!product || (product._id == null && !product.name)) {
          throw new Error('Invalid product response');
        }
        onProductFound?.(product);
        onScanStateChange?.('success');
      } catch (error) {
        onScanStateChange?.('error');
        const status = error?.status;
        if (status === 404) {
          toastError('Barcode not found', `No product matches barcode "${code}".`);
        } else {
          toastError('Scan failed', getErrorMessage(error) || `Could not look up barcode "${code}".`);
        }
      } finally {
        searchingRef.current = false;
        setSearching(false);
        setFieldValue('');
        inputRef.current?.focus();
        window.setTimeout(() => onScanStateChange?.('idle'), 1800);
        const next = queueRef.current.shift();
        if (next) lookupRef.current(next);
      }
    },
    [inputRef, onProductFound, onScanStateChange, setFieldValue]
  );

  lookupRef.current = lookupBarcode;

  const flushBuffer = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    const code = normalizeBarcode(bufferRef.current);
    bufferRef.current = '';
    if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current(code);
  }, []);

  const scheduleIdleFlush = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (normalizeBarcode(bufferRef.current).length >= MIN_BARCODE_LENGTH) {
        flushBuffer();
      }
    }, IDLE_SUBMIT_MS);
  }, [flushBuffer]);

  const pushChar = useCallback(
    (char, now) => {
      const gap = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;
      if (gap > BUFFER_RESET_MS) bufferRef.current = '';
      bufferRef.current = `${bufferRef.current}${char}`.slice(0, MAX_BARCODE_LENGTH);
      return gap;
    },
    []
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (disabled) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target;
      const fromField = target === inputRef.current;
      const now = Date.now();

      if (event.key === 'Backspace' && fromField) {
        event.preventDefault();
        bufferRef.current = bufferRef.current.slice(0, -1);
        setFieldValue(bufferRef.current);
        window.clearTimeout(idleTimerRef.current);
        return;
      }

      if (event.key === 'Escape' && fromField) {
        event.preventDefault();
        bufferRef.current = '';
        setFieldValue('');
        window.clearTimeout(idleTimerRef.current);
        return;
      }

      if (isTerminator(event.key)) {
        const buffered = normalizeBarcode(bufferRef.current);
        const fieldValue = fromField ? normalizeBarcode(inputRef.current?.value || '') : '';
        const code = buffered.length >= MIN_BARCODE_LENGTH ? buffered : fieldValue;
        const scannerSuffix = now - lastKeyAtRef.current <= IDLE_SUBMIT_MS;

        if (fromField) {
          event.preventDefault();
          bufferRef.current = '';
          window.clearTimeout(idleTimerRef.current);
          if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current(code);
          return;
        }

        if (target?.dataset?.barcodeScan) return;

        if (captureGlobalScans && scannerSuffix && buffered.length >= MIN_BARCODE_LENGTH) {
          event.preventDefault();
          event.stopPropagation();
          bufferRef.current = '';
          window.clearTimeout(idleTimerRef.current);
          lookupRef.current(buffered);
          return;
        }

        bufferRef.current = '';
        return;
      }

      if (!isBarcodeChar(event.key)) return;

      if (!fromField && target?.dataset?.barcodeScan) return;

      if (fromField) {
        const gap = pushChar(event.key, now);
        setFieldValue(bufferRef.current);
        event.preventDefault();
        if (gap <= SCANNER_CHAR_GAP_MS && bufferRef.current.length >= MIN_BARCODE_LENGTH) {
          scheduleIdleFlush();
        }
        return;
      }

      if (!captureGlobalScans) return;

      const gap = now - lastKeyAtRef.current;
      const otherField = isEditableTarget(target);
      const burst = bufferRef.current.length > 0 && gap <= SCANNER_CHAR_GAP_MS;

      if (otherField && !burst) {
        pushChar(event.key, now);
        return;
      }

      event.preventDefault();
      if (otherField && typeof target.value === 'string' && target.value.length) {
        const proto = Object.getPrototypeOf(target);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const trimmed = target.value.slice(0, -1);
        if (setter) setter.call(target, trimmed);
        else target.value = trimmed;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      pushChar(event.key, now);
      setFieldValue(bufferRef.current);
      inputRef.current?.focus();
      if (bufferRef.current.length >= MIN_BARCODE_LENGTH) scheduleIdleFlush();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout(idleTimerRef.current);
    };
  }, [captureGlobalScans, disabled, inputRef, pushChar, scheduleIdleFlush, setFieldValue]);

  return (
    <div className={`relative flex-1 rounded-lg ${ringClass} ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-muted)]">
        <LuScanBarcode size={18} />
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        defaultValue=""
        placeholder={placeholder}
        className="input-field pl-10 pr-10 barcode-ready"
        aria-label="Scan barcode"
        data-barcode-scan="true"
        onPaste={(event) => {
          const text = event.clipboardData?.getData('text') || '';
          event.preventDefault();
          lookupRef.current(text);
        }}
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
