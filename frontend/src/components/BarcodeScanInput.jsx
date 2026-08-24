import { useCallback, useEffect, useRef, useState } from 'react';
import { LuScanBarcode } from 'react-icons/lu';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import { fetchProductByBarcode } from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import { normalizeBarcode } from '../utils/barcode.js';
import { toastError } from '../utils/toast.js';
import {
  BUFFER_RESET_MS,
  IDLE_SUBMIT_MS,
  MAX_BARCODE_LENGTH,
  MIN_BARCODE_LENGTH,
  SCANNER_CHAR_GAP_MS,
  charFromKeyboardEvent,
  isNodeInsideOpenModal,
  isTerminatorKey,
  publishBarcodeScan,
  registerWedgeHandler,
} from '../utils/scanner.js';

export default function BarcodeScanInput({
  onProductFound,
  onCode,
  onNotFound,
  onScanStateChange,
  disabled = false,
  inputRef: externalRef,
  className = '',
  ringClass = '',
  inputClassName = '',
  placeholder = 'Scan barcode or enter barcode manually',
  autoFocus = true,
  captureGlobalScans = false,
  mode = 'lookup',
  keepValue = false,
  notifyErrors = true,
}) {
  const internalRef = useRef(null);
  const inputRef = externalRef || internalRef;

  const [searching, setSearching] = useState(false);

  const searchingRef = useRef(false);
  const lastInputAtRef = useRef(0);
  const idleTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const queueRef = useRef([]);
  const lookupRef = useRef(null);
  const keyBufferRef = useRef('');
  const keyBufferAtRef = useRef(0);

  const setFieldValue = useCallback(
    (value) => {
      if (inputRef.current) inputRef.current.value = value;
    },
    [inputRef]
  );

  const ownsScan = useCallback(() => {
    const el = inputRef.current;
    if (!el) return false;
    const modalOpen = Boolean(document.querySelector('[data-modal-open="true"]'));
    if (modalOpen && !isNodeInsideOpenModal(el)) return false;
    return true;
  }, [inputRef]);

  const lookupBarcode = useCallback(
    async (rawCode) => {
      if (!ownsScan()) return;

      const rawValue = String(rawCode || '');
      const code = normalizeBarcode(rawValue);

      console.log('[barcode:lookup:start]', {
        rawValue,
        normalized: code,
        length: code.length,
        mode,
        autoFocus,
      });

      if (!code || code.length < MIN_BARCODE_LENGTH) {
        console.warn('[barcode:lookup:ignored]', { rawValue, normalized: code, minLength: MIN_BARCODE_LENGTH });
        return;
      }

      if (searchingRef.current) {
        if (!queueRef.current.includes(code)) queueRef.current.push(code);
        return;
      }

      searchingRef.current = true;
      setSearching(true);

      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(statusTimerRef.current);

      if (!keepValue) setFieldValue('');

      onScanStateChange?.('searching');

      try {
        publishBarcodeScan(code);
        onCode?.(code);
        console.log('[barcode:lookup:fetching]', { code });

        if (mode === 'value') {
          setFieldValue(code);
          onScanStateChange?.('success');
          return;
        }

        const response = await fetchProductByBarcode(code);
        const rawProduct = response?.data ?? response;
        const product =
          rawProduct && typeof rawProduct === 'object'
            ? {
                ...rawProduct,
                _id: rawProduct._id ?? rawProduct.id,
                id: rawProduct.id ?? rawProduct._id,
                stock: Number(rawProduct.stock) || 0,
                price: Number(rawProduct.price) || 0,
              }
            : rawProduct;
        console.log('[barcode:lookup:response]', { code, product });

        if (!product || (product._id == null && product.id == null && !product.name)) {
          const error = new Error('Product not found');
          error.status = 404;
          throw error;
        }

        onProductFound?.(product);
        onScanStateChange?.('success');
      } catch (error) {
        onScanStateChange?.('error');
        const status = error?.status;

        if (status === 404) {
          onNotFound?.(code);
          if (notifyErrors && !onNotFound) {
            toastError(
              'Product Not Found',
              `Barcode:\n${code}\nThis barcode is not assigned to any product.`
            );
          }
        } else if (notifyErrors) {
          toastError(
            'Scan Failed',
            getErrorMessage(error) || `Could not look up barcode "${code}".`
          );
        }
      } finally {
        searchingRef.current = false;
        setSearching(false);

        if (!keepValue) setFieldValue('');

        requestAnimationFrame(() => {
          if (!disabled && ownsScan()) inputRef.current?.focus({ preventScroll: true });
        });

        statusTimerRef.current = window.setTimeout(() => {
          onScanStateChange?.('idle');
        }, 1000);

        const nextBarcode = queueRef.current.shift();
        if (nextBarcode) {
          window.setTimeout(() => lookupRef.current?.(nextBarcode), 0);
        }
      }
    },
    [
      disabled,
      inputRef,
      keepValue,
      mode,
      notifyErrors,
      onCode,
      onNotFound,
      onProductFound,
      onScanStateChange,
      ownsScan,
      setFieldValue,
    ]
  );

  lookupRef.current = lookupBarcode;

  const submitFieldValue = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    const fromInput = normalizeBarcode(inputRef.current?.value || '');
    const fromBuffer = normalizeBarcode(keyBufferRef.current);
    keyBufferRef.current = '';
    const code = fromInput.length >= fromBuffer.length ? fromInput : fromBuffer;
    if (inputRef.current) inputRef.current.value = '';
    if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current?.(code);
  }, [inputRef]);

  const scheduleFieldIdleSubmit = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      const fromInput = normalizeBarcode(inputRef.current?.value || '');
      const fromBuffer = normalizeBarcode(keyBufferRef.current);
      keyBufferRef.current = '';
      const code = fromInput.length >= fromBuffer.length ? fromInput : fromBuffer;
      if (code.length >= MIN_BARCODE_LENGTH) {
        if (inputRef.current) inputRef.current.value = '';
        lookupRef.current?.(code);
      }
    }, IDLE_SUBMIT_MS);
  }, [inputRef]);

  const handleInputChange = useCallback(
    (event) => {
      if (!ownsScan()) return;
      const raw = event.target.value || '';

      if (/[\r\n\t]/.test(raw)) {
        window.clearTimeout(idleTimerRef.current);
        const code = normalizeBarcode(raw);
        keyBufferRef.current = '';
        event.target.value = '';
        if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current?.(code);
        return;
      }

      const now = Date.now();
      const gap = now - lastInputAtRef.current;
      lastInputAtRef.current = now;

      const fastBurst = gap > 0 && gap <= SCANNER_CHAR_GAP_MS;
      const longEnough = normalizeBarcode(raw).length >= MIN_BARCODE_LENGTH;

      if (longEnough && (fastBurst || raw.length >= 8)) {
        scheduleFieldIdleSubmit();
      } else {
        window.clearTimeout(idleTimerRef.current);
      }
    },
    [ownsScan, scheduleFieldIdleSubmit]
  );

  const handleInputKeyDown = useCallback(
    (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (!ownsScan()) return;

      const character = charFromKeyboardEvent(event);
      const now = Date.now();
      if (character) {
        if (now - keyBufferAtRef.current > BUFFER_RESET_MS) keyBufferRef.current = '';
        keyBufferAtRef.current = now;
        keyBufferRef.current = `${keyBufferRef.current}${character}`.slice(0, MAX_BARCODE_LENGTH);
      }

      console.log('[barcode:keydown]', { key: event.key, code: event.code, value: event.target?.value || '' });

      if (isTerminatorKey(event.key, event.code, event.keyCode || event.which)) {
        console.log('[barcode:terminator]', { key: event.key, code: event.code, value: inputRef.current?.value || '', buffer: keyBufferRef.current });
        event.preventDefault();
        submitFieldValue();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        window.clearTimeout(idleTimerRef.current);
        keyBufferRef.current = '';
        setFieldValue('');
      }
    },
    [ownsScan, setFieldValue, submitFieldValue]
  );

  useEffect(() => {
    if (!captureGlobalScans || disabled) return undefined;

    return registerWedgeHandler((code) => {
      if (disabled || !ownsScan()) return false;

      setFieldValue(code);
      lookupRef.current?.(code);
      return true;
    });
  }, [captureGlobalScans, disabled, ownsScan, setFieldValue]);

  useEffect(() => {
    const syncFocus = () => {
      const el = inputRef.current;
      if (!el) return;
      if (!ownsScan() && document.activeElement === el) el.blur();
    };

    const observer = new MutationObserver(syncFocus);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-modal-open'],
    });
    document.addEventListener('focusin', syncFocus, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', syncFocus, true);
    };
  }, [inputRef, ownsScan]);

  useEffect(() => {
    if (!autoFocus || disabled) return undefined;
    const timer = window.setTimeout(() => {
      if (ownsScan()) inputRef.current?.focus({ preventScroll: true });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [autoFocus, disabled, inputRef, ownsScan]);

  useEffect(
    () => () => {
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(statusTimerRef.current);
      queueRef.current = [];
    },
    []
  );

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
        className={`input-field pl-10 pr-10 barcode-ready ${inputClassName}`}
        aria-label="Scan barcode"
        data-barcode-scan="true"
        onKeyDown={handleInputKeyDown}
        onChange={handleInputChange}
        onCompositionEnd={(event) => {
          const code = normalizeBarcode(event.target?.value || '');
          if (code.length >= MIN_BARCODE_LENGTH) {
            event.target.value = '';
            keyBufferRef.current = '';
            lookupRef.current?.(code);
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const rawText = event.clipboardData?.getData('text') || '';
          console.log('[barcode:paste]', { rawText });
          const code = normalizeBarcode(rawText);
          if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current?.(code);
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
