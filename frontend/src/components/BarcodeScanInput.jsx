import { useCallback, useEffect, useRef, useState } from 'react';
import { LuScanBarcode } from 'react-icons/lu';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import { fetchProductByBarcode } from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import { normalizeBarcode } from '../utils/barcode.js';
import { toastError } from '../utils/toast.js';
import { publishBarcodeScan } from '../utils/scanner.js';

/** USB HID is ~5–20ms/char; Bluetooth wedges like Netum HW-L98 are often 30–150ms/char. */
const SCANNER_CHAR_GAP_MS = 220;
/** Start a new buffer after a real pause between scans. */
const BUFFER_RESET_MS = 900;
/** Submit when a Bluetooth scanner sends no Enter/Tab suffix. */
const IDLE_SUBMIT_MS = 320;
const MIN_BARCODE_LENGTH = 4;
const MAX_BARCODE_LENGTH = 64;

function isTerminator(key, code) {
  return (
    key === 'Enter' ||
    key === 'NumpadEnter' ||
    key === 'Tab' ||
    code === 'Enter' ||
    code === 'NumpadEnter' ||
    code === 'Tab'
  );
}

function charFromEvent(event) {
  const key = event.key;
  if (typeof key === 'string' && key.length === 1 && key.charCodeAt(0) >= 32) {
    return key;
  }

  const code = event.code || '';
  if (/^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code)) {
    return code.slice(-1);
  }

  if (event.which >= 48 && event.which <= 57) {
    return String.fromCharCode(event.which);
  }

  return '';
}

function isEditableTarget(target) {
  if (!target || target === document.body) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.isContentEditable);
}

function stripLastTypedChar(target) {
  if (!target || typeof target.value !== 'string' || !target.value.length) return;
  const proto = Object.getPrototypeOf(target);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  const next = target.value.slice(0, -1);
  if (setter) setter.call(target, next);
  else target.value = next;
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

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
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);
  const lastLookupAtRef = useRef(0);
  const lastLookupCodeRef = useRef('');
  const fastScanRef = useRef(false);
  const idleTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const queueRef = useRef([]);
  const lookupRef = useRef(null);

  const setFieldValue = useCallback(
    (value) => {
      if (inputRef.current) inputRef.current.value = value;
    },
    [inputRef]
  );

  const lookupBarcode = useCallback(
    async (rawCode) => {
      const code = normalizeBarcode(String(rawCode || ''));
      if (!code || code.length < MIN_BARCODE_LENGTH) return;

      const now = Date.now();
      if (code === lastLookupCodeRef.current && now - lastLookupAtRef.current < 120) {
        return;
      }
      lastLookupCodeRef.current = code;
      lastLookupAtRef.current = now;

      if (searchingRef.current) {
        if (!queueRef.current.includes(code)) queueRef.current.push(code);
        return;
      }

      searchingRef.current = true;
      setSearching(true);

      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(statusTimerRef.current);
      bufferRef.current = '';

      if (!keepValue) setFieldValue('');

      onScanStateChange?.('searching');

      try {
        publishBarcodeScan(code);
        onCode?.(code);

        if (mode === 'value') {
          setFieldValue(code);
          onScanStateChange?.('success');
          return;
        }

        const response = await fetchProductByBarcode(code);
        const product = response?.data ?? response;

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
          if (!disabled) inputRef.current?.focus();
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
      setFieldValue,
    ]
  );

  lookupRef.current = lookupBarcode;

  const flushBuffer = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    const code = normalizeBarcode(bufferRef.current);
    bufferRef.current = '';
    if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current?.(code);
  }, []);

  const scheduleIdleSubmit = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (normalizeBarcode(bufferRef.current).length >= MIN_BARCODE_LENGTH) {
        flushBuffer();
      }
    }, IDLE_SUBMIT_MS);
  }, [flushBuffer]);

  const addToBuffer = useCallback((character, now) => {
    const gap = now - lastKeyAtRef.current;
    lastKeyAtRef.current = now;
    if (gap > BUFFER_RESET_MS) {
      bufferRef.current = '';
      fastScanRef.current = false;
    }
    bufferRef.current = `${bufferRef.current}${character}`.slice(0, MAX_BARCODE_LENGTH);
    if (bufferRef.current.length >= 2 && gap <= SCANNER_CHAR_GAP_MS) {
      fastScanRef.current = true;
    } else if (gap > SCANNER_CHAR_GAP_MS) {
      fastScanRef.current = false;
    }
    return gap;
  }, []);

  useEffect(() => {
    if (disabled) return undefined;

    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const target = event.target;
      const isOurInput = target === inputRef.current;
      const now = Date.now();

      if (isOurInput) {
        if (isTerminator(event.key, event.code)) {
          const buffered = normalizeBarcode(bufferRef.current);
          const fieldValue = normalizeBarcode(inputRef.current?.value || '');
          const code = buffered.length >= MIN_BARCODE_LENGTH ? buffered : fieldValue;

          event.preventDefault();
          event.stopPropagation();
          window.clearTimeout(idleTimerRef.current);
          bufferRef.current = '';

          if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current?.(code);
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          bufferRef.current = '';
          window.clearTimeout(idleTimerRef.current);
          setFieldValue('');
          return;
        }

        if (event.key === 'Backspace') {
          event.preventDefault();
          bufferRef.current = bufferRef.current.slice(0, -1);
          setFieldValue(bufferRef.current);
          window.clearTimeout(idleTimerRef.current);
          return;
        }

        const character = charFromEvent(event);
        if (!character) return;

        const gap = addToBuffer(character, now);
        event.preventDefault();
        setFieldValue(bufferRef.current);

        if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
          if (gap <= SCANNER_CHAR_GAP_MS || bufferRef.current.length >= 8) {
            scheduleIdleSubmit();
          }
        }
        return;
      }

      if (!captureGlobalScans) return;
      if (target?.dataset?.barcodeScan) return;

      if (isTerminator(event.key, event.code)) {
        const buffered = normalizeBarcode(bufferRef.current);
        const scannerSuffix =
          fastScanRef.current && now - lastKeyAtRef.current <= IDLE_SUBMIT_MS;

        if (buffered.length >= MIN_BARCODE_LENGTH && scannerSuffix) {
          event.preventDefault();
          event.stopPropagation();
          window.clearTimeout(idleTimerRef.current);
          bufferRef.current = '';
          fastScanRef.current = false;
          lookupRef.current?.(buffered);
        } else {
          bufferRef.current = '';
          fastScanRef.current = false;
        }
        return;
      }

      const character = charFromEvent(event);
      if (!character) return;

      const otherField = isEditableTarget(target);
      const gap = now - lastKeyAtRef.current;
      const burst = bufferRef.current.length > 0 && gap <= SCANNER_CHAR_GAP_MS;

      if (otherField && !burst) {
        addToBuffer(character, now);
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (otherField) stripLastTypedChar(target);

      addToBuffer(character, now);
      setFieldValue(bufferRef.current);
      inputRef.current?.focus();

      if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
        scheduleIdleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(statusTimerRef.current);
    };
  }, [addToBuffer, captureGlobalScans, disabled, inputRef, scheduleIdleSubmit, setFieldValue]);

  useEffect(() => {
    if (!autoFocus || disabled) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [autoFocus, disabled, inputRef]);

  useEffect(
    () => () => {
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(statusTimerRef.current);
      bufferRef.current = '';
      queueRef.current = [];
    },
    []
  );

  const submitRawValue = (raw) => {
    const code = normalizeBarcode(raw);
    if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current?.(code);
  };

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
        onPaste={(event) => {
          event.preventDefault();
          submitRawValue(event.clipboardData?.getData('text') || '');
        }}
        onInput={(event) => {
          const raw = event.target.value || '';
          if (/[\r\n\t]/.test(raw)) {
            event.preventDefault();
            submitRawValue(raw);
            return;
          }
          if (raw.length - bufferRef.current.length >= 4) {
            bufferRef.current = raw;
            lastKeyAtRef.current = Date.now();
            scheduleIdleSubmit();
          }
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
