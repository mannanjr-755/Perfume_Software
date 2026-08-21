// import { useCallback, useEffect, useRef, useState } from 'react';
// import { LuScanBarcode } from 'react-icons/lu';
// import LoadingSpinner from './ui/LoadingSpinner.jsx';
// import { fetchProductByBarcode } from '../services/resourceService.js';
// import { getErrorMessage } from '../services/api.js';
// import { normalizeBarcode } from '../utils/barcode.js';
// import { toastError } from '../utils/toast.js';

// /** USB scanners are ~5–20ms/char; Bluetooth HID wedges are often 30–80ms/char. */
// const SCANNER_CHAR_GAP_MS = 80;
// /** Reset the buffer after a pause — new scan or human typing. */
// const BUFFER_RESET_MS = 400;
// /** Bluetooth scanners that send no Enter/Tab suffix. */
// const IDLE_SUBMIT_MS = 180;
// const MIN_BARCODE_LENGTH = 4;
// const MAX_BARCODE_LENGTH = 64;

// function isTerminator(key) {
//   return key === 'Enter' || key === 'NumpadEnter' || key === 'Tab';
// }

// function isBarcodeChar(key) {
//   return key.length === 1 && key.charCodeAt(0) >= 32;
// }

// function isEditableTarget(target) {
//   if (!target || target === document.body) return false;
//   const tag = target.tagName;
//   if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
//   return Boolean(target.isContentEditable);
// }

// export default function BarcodeScanInput({
//   onProductFound,
//   onCode,
//   onNotFound,
//   onScanStateChange,
//   disabled = false,
//   inputRef: externalRef,
//   className = '',
//   ringClass = '',
//   inputClassName = '',
//   placeholder = 'Scan barcode or enter barcode manually',
//   autoFocus = true,
//   captureGlobalScans = false,
//   /** lookup = GET product by barcode; value = only capture the code (product form). */
//   mode = 'lookup',
//   keepValue = false,
//   notifyErrors = true,
// }) {
//   const [searching, setSearching] = useState(false);
//   const internalRef = useRef(null);
//   const inputRef = externalRef || internalRef;
//   const searchingRef = useRef(false);
//   const bufferRef = useRef('');
//   const lastKeyAtRef = useRef(0);
//   const idleTimerRef = useRef(0);
//   const lookupRef = useRef(async () => {});
//   const queueRef = useRef([]);

//   const setFieldValue = useCallback((next) => {
//     if (inputRef.current) inputRef.current.value = next;
//   }, [inputRef]);

//   const lookupBarcode = useCallback(
//     async (rawCode) => {
//       const code = normalizeBarcode(rawCode);
//       if (!code) return;

//       if (searchingRef.current) {
//         if (!queueRef.current.includes(code)) queueRef.current.push(code);
//         return;
//       }

//       searchingRef.current = true;
//       setSearching(true);
//       onScanStateChange?.('idle');
//       bufferRef.current = '';
//       if (!keepValue) setFieldValue('');

//       try {
//         onCode?.(code);
//         if (mode === 'value') {
//           setFieldValue(code);
//           onScanStateChange?.('success');
//           return;
//         }

//         const res = await fetchProductByBarcode(code);
//         const product = res?.data ?? res;
//         if (!product || (product._id == null && !product.name)) {
//           throw new Error('Invalid product response');
//         }
//         onProductFound?.(product);
//         onScanStateChange?.('success');
//       } catch (error) {
//         onScanStateChange?.('error');
//         const status = error?.status;
//         if (status === 404) {
//           onNotFound?.(code);
//           if (notifyErrors && !onNotFound) {
//             toastError(
//               'Product Not Found',
//               `Barcode:\n${code}\nThis barcode is not assigned to any product.`
//             );
//           }
//         } else if (notifyErrors) {
//           toastError('Scan failed', getErrorMessage(error) || `Could not look up barcode "${code}".`);
//         }
//       } finally {
//         searchingRef.current = false;
//         setSearching(false);
//         if (!keepValue) setFieldValue('');
//         inputRef.current?.focus();
//         window.setTimeout(() => onScanStateChange?.('idle'), 1800);
//         const next = queueRef.current.shift();
//         if (next) lookupRef.current(next);
//       }
//     },
//     [
//       inputRef,
//       keepValue,
//       mode,
//       notifyErrors,
//       onCode,
//       onNotFound,
//       onProductFound,
//       onScanStateChange,
//       setFieldValue,
//     ]
//   );

//   lookupRef.current = lookupBarcode;

//   const flushBuffer = useCallback(() => {
//     window.clearTimeout(idleTimerRef.current);
//     const code = normalizeBarcode(bufferRef.current);
//     bufferRef.current = '';
//     if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current(code);
//   }, []);

//   const scheduleIdleFlush = useCallback(() => {
//     window.clearTimeout(idleTimerRef.current);
//     idleTimerRef.current = window.setTimeout(() => {
//       if (normalizeBarcode(bufferRef.current).length >= MIN_BARCODE_LENGTH) {
//         flushBuffer();
//       }
//     }, IDLE_SUBMIT_MS);
//   }, [flushBuffer]);

//   const pushChar = useCallback(
//     (char, now) => {
//       const gap = now - lastKeyAtRef.current;
//       lastKeyAtRef.current = now;
//       if (gap > BUFFER_RESET_MS) bufferRef.current = '';
//       bufferRef.current = `${bufferRef.current}${char}`.slice(0, MAX_BARCODE_LENGTH);
//       return gap;
//     },
//     []
//   );

//   useEffect(() => {
//     const onKeyDown = (event) => {
//       if (disabled) return;
//       if (event.ctrlKey || event.metaKey || event.altKey) return;

//       const target = event.target;
//       const fromField = target === inputRef.current;
//       const now = Date.now();

//       if (event.key === 'Backspace' && fromField) {
//         event.preventDefault();
//         bufferRef.current = bufferRef.current.slice(0, -1);
//         setFieldValue(bufferRef.current);
//         window.clearTimeout(idleTimerRef.current);
//         return;
//       }

//       if (event.key === 'Escape' && fromField) {
//         event.preventDefault();
//         bufferRef.current = '';
//         setFieldValue('');
//         window.clearTimeout(idleTimerRef.current);
//         return;
//       }

//       if (isTerminator(event.key)) {
//         const buffered = normalizeBarcode(bufferRef.current);
//         const fieldValue = fromField ? normalizeBarcode(inputRef.current?.value || '') : '';
//         const code = buffered.length >= MIN_BARCODE_LENGTH ? buffered : fieldValue;
//         const scannerSuffix = now - lastKeyAtRef.current <= IDLE_SUBMIT_MS;

//         if (fromField) {
//           event.preventDefault();
//           bufferRef.current = '';
//           window.clearTimeout(idleTimerRef.current);
//           if (code.length >= MIN_BARCODE_LENGTH) lookupRef.current(code);
//           return;
//         }

//         if (target?.dataset?.barcodeScan) return;

//         const openModal = document.querySelector('[data-modal-open="true"]');
//         const blockedByModal = Boolean(openModal && inputRef.current && !openModal.contains(inputRef.current));

//         if (
//           captureGlobalScans &&
//           !blockedByModal &&
//           scannerSuffix &&
//           buffered.length >= MIN_BARCODE_LENGTH
//         ) {
//           event.preventDefault();
//           event.stopPropagation();
//           bufferRef.current = '';
//           window.clearTimeout(idleTimerRef.current);
//           lookupRef.current(buffered);
//           return;
//         }

//         bufferRef.current = '';
//         return;
//       }

//       if (!isBarcodeChar(event.key)) return;

//       if (!fromField && target?.dataset?.barcodeScan) return;

//       if (fromField) {
//         const gap = pushChar(event.key, now);
//         setFieldValue(bufferRef.current);
//         event.preventDefault();
//         if (gap <= SCANNER_CHAR_GAP_MS && bufferRef.current.length >= MIN_BARCODE_LENGTH) {
//           scheduleIdleFlush();
//         }
//         return;
//       }

//       if (!captureGlobalScans) return;

//       const openModal = document.querySelector('[data-modal-open="true"]');
//       if (openModal && inputRef.current && !openModal.contains(inputRef.current)) return;

//       const gap = now - lastKeyAtRef.current;
//       const otherField = isEditableTarget(target);
//       const burst = bufferRef.current.length > 0 && gap <= SCANNER_CHAR_GAP_MS;

//       if (otherField && !burst) {
//         pushChar(event.key, now);
//         return;
//       }

//       event.preventDefault();
//       if (otherField && typeof target.value === 'string' && target.value.length) {
//         const proto = Object.getPrototypeOf(target);
//         const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
//         const trimmed = target.value.slice(0, -1);
//         if (setter) setter.call(target, trimmed);
//         else target.value = trimmed;
//         target.dispatchEvent(new Event('input', { bubbles: true }));
//       }
//       pushChar(event.key, now);
//       setFieldValue(bufferRef.current);
//       inputRef.current?.focus();
//       if (bufferRef.current.length >= MIN_BARCODE_LENGTH) scheduleIdleFlush();
//     };

//     window.addEventListener('keydown', onKeyDown, true);
//     return () => {
//       window.removeEventListener('keydown', onKeyDown, true);
//       window.clearTimeout(idleTimerRef.current);
//     };
//   }, [captureGlobalScans, disabled, inputRef, pushChar, scheduleIdleFlush, setFieldValue]);

//   return (
//     <div className={`relative flex-1 rounded-lg ${ringClass} ${className}`}>
//       <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-muted)]">
//         <LuScanBarcode size={18} />
//       </span>
//       <input
//         ref={inputRef}
//         type="text"
//         inputMode="text"
//         autoFocus={autoFocus}
//         autoComplete="off"
//         autoCorrect="off"
//         spellCheck={false}
//         disabled={disabled}
//         defaultValue=""
//         placeholder={placeholder}
//         className={`input-field pl-10 pr-10 barcode-ready ${inputClassName}`}
//         aria-label="Scan barcode"
//         data-barcode-scan="true"
//         onPaste={(event) => {
//           const text = event.clipboardData?.getData('text') || '';
//           event.preventDefault();
//           lookupRef.current(text);
//         }}
//       />
//       {searching ? (
//         <span className="absolute inset-y-0 right-3 flex items-center">
//           <LoadingSpinner size="sm" />
//         </span>
//       ) : (
//         <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
//           <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
//         </span>
//       )}
//     </div>
//   );
// }

import { useCallback, useEffect, useRef, useState } from 'react';
import { LuScanBarcode } from 'react-icons/lu';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import { fetchProductByBarcode } from '../services/resourceService.js';
import { getErrorMessage } from '../services/api.js';
import { normalizeBarcode } from '../utils/barcode.js';
import { toastError } from '../utils/toast.js';

const SCANNER_CHAR_GAP_MS = 100;
const BUFFER_RESET_MS = 500;
const IDLE_SUBMIT_MS = 250;
const MIN_BARCODE_LENGTH = 4;
const MAX_BARCODE_LENGTH = 64;

function isTerminator(key) {
  return (
    key === 'Enter' ||
    key === 'NumpadEnter' ||
    key === 'Tab'
  );
}

function isBarcodeChar(key) {
  return (
    typeof key === 'string' &&
    key.length === 1 &&
    key.charCodeAt(0) >= 32
  );
}

function isEditableTarget(target) {
  if (!target || target === document.body) {
    return false;
  }

  const tag = target.tagName;

  if (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  ) {
    return true;
  }

  return Boolean(target.isContentEditable);
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
  const idleTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const queueRef = useRef([]);

  /*
   * Always keep latest lookup function.
   * This avoids stale callback problems without putting
   * lookupBarcode itself inside keyboard effect dependencies.
   */
  const lookupRef = useRef(null);

  const setFieldValue = useCallback(
    (value) => {
      if (inputRef.current) {
        inputRef.current.value = value;
      }
    },
    [inputRef]
  );

  const lookupBarcode = useCallback(
    async (rawCode) => {
      const code = normalizeBarcode(String(rawCode || ''));

      if (!code || code.length < MIN_BARCODE_LENGTH) {
        return;
      }

      /*
       * If another lookup is running,
       * put the next barcode in queue.
       */
      if (searchingRef.current) {
        if (!queueRef.current.includes(code)) {
          queueRef.current.push(code);
        }

        return;
      }

      searchingRef.current = true;
      setSearching(true);

      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(statusTimerRef.current);

      bufferRef.current = '';

      if (!keepValue) {
        setFieldValue('');
      }

      onScanStateChange?.('searching');

      try {
        /*
         * Send scanned barcode to parent.
         */
        onCode?.(code);

        /*
         * VALUE MODE
         *
         * Used when barcode is being entered
         * while creating/editing a product.
         */
        if (mode === 'value') {
          setFieldValue(code);
          onScanStateChange?.('success');
          return;
        }

        /*
         * LOOKUP MODE
         *
         * Find product from backend.
         */
        const response = await fetchProductByBarcode(code);

        /*
         * Supports both:
         *
         * { data: product }
         *
         * and
         *
         * product
         */
        const product = response?.data ?? response;

        if (
          !product ||
          (
            product._id == null &&
            product.id == null &&
            !product.name
          )
        ) {
          const error = new Error('Product not found');
          error.status = 404;
          throw error;
        }

        /*
         * VERY IMPORTANT:
         *
         * PosScanner.jsx has:
         *
         * onProductFound={addProductToCart}
         *
         * Therefore this sends the product directly
         * to the existing cart logic.
         */
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
            getErrorMessage(error) ||
              `Could not look up barcode "${code}".`
          );
        }
      } finally {
        searchingRef.current = false;
        setSearching(false);

        if (!keepValue) {
          setFieldValue('');
        }

        /*
         * Keep scanner input focused.
         */
        requestAnimationFrame(() => {
          if (!disabled) {
            inputRef.current?.focus();
          }
        });

        /*
         * Reset status.
         */
        statusTimerRef.current = window.setTimeout(() => {
          onScanStateChange?.('idle');
        }, 1000);

        /*
         * Process next queued scan.
         */
        const nextBarcode = queueRef.current.shift();

        if (nextBarcode) {
          window.setTimeout(() => {
            lookupRef.current?.(nextBarcode);
          }, 0);
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

  /*
   * Always store latest lookup function.
   */
  lookupRef.current = lookupBarcode;

  /*
   * Submit scanner buffer.
   */
  const flushBuffer = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);

    const code = normalizeBarcode(bufferRef.current);

    bufferRef.current = '';

    if (code.length >= MIN_BARCODE_LENGTH) {
      lookupRef.current?.(code);
    }
  }, []);

  /*
   * Automatically submit scanners which don't
   * send ENTER at the end.
   */
  const scheduleIdleSubmit = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);

    idleTimerRef.current = window.setTimeout(() => {
      const code = normalizeBarcode(bufferRef.current);

      if (code.length >= MIN_BARCODE_LENGTH) {
        flushBuffer();
      }
    }, IDLE_SUBMIT_MS);
  }, [flushBuffer]);

  /*
   * Add character to scanner buffer.
   */
  const addToBuffer = useCallback((character, now) => {
    const gap = now - lastKeyAtRef.current;

    lastKeyAtRef.current = now;

    /*
     * If scanner stopped for too long,
     * start a new barcode.
     */
    if (gap > BUFFER_RESET_MS) {
      bufferRef.current = '';
    }

    bufferRef.current = (
      bufferRef.current + character
    ).slice(0, MAX_BARCODE_LENGTH);

    return gap;
  }, []);

  /*
   * KEYBOARD / BARCODE SCANNER
   *
   * IMPORTANT:
   * If captureGlobalScans is false,
   * we DO NOT install a global keyboard listener.
   *
   * This prevents Product / Order navigation
   * from being affected.
   */
  useEffect(() => {
    if (disabled) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      const target = event.target;

      const isOurInput =
        target === inputRef.current;

      /*
       * ------------------------------------------------
       * OUR BARCODE INPUT
       * ------------------------------------------------
       */
      if (isOurInput) {
        /*
         * ENTER / TAB
         */
        if (isTerminator(event.key)) {
          const value = normalizeBarcode(
            inputRef.current?.value || ''
          );

          const buffered = normalizeBarcode(
            bufferRef.current
          );

          const code =
            buffered.length >= MIN_BARCODE_LENGTH
              ? buffered
              : value;

          event.preventDefault();
          event.stopPropagation();

          window.clearTimeout(idleTimerRef.current);

          bufferRef.current = '';

          if (code.length >= MIN_BARCODE_LENGTH) {
            lookupRef.current?.(code);
          }

          return;
        }

        /*
         * ESCAPE
         */
        if (event.key === 'Escape') {
          event.preventDefault();

          bufferRef.current = '';

          window.clearTimeout(idleTimerRef.current);

          setFieldValue('');

          return;
        }

        /*
         * BACKSPACE
         */
        if (event.key === 'Backspace') {
          event.preventDefault();

          bufferRef.current =
            bufferRef.current.slice(0, -1);

          setFieldValue(bufferRef.current);

          window.clearTimeout(idleTimerRef.current);

          return;
        }

        /*
         * Ignore Shift / Arrow / F keys etc.
         */
        if (!isBarcodeChar(event.key)) {
          return;
        }

        /*
         * Scanner is typing into our barcode input.
         */
        const now = Date.now();

        const gap = addToBuffer(
          event.key,
          now
        );

        /*
         * Prevent duplicate browser input.
         */
        event.preventDefault();

        setFieldValue(bufferRef.current);

        /*
         * If characters are arriving quickly,
         * this is most likely a scanner.
         */
        if (
          gap <= SCANNER_CHAR_GAP_MS &&
          bufferRef.current.length >= MIN_BARCODE_LENGTH
        ) {
          scheduleIdleSubmit();
        }

        return;
      }

      /*
       * ------------------------------------------------
       * GLOBAL SCANNER MODE
       * ------------------------------------------------
       *
       * Only enabled on Create Order / POS scanner.
       */
      if (!captureGlobalScans) {
        return;
      }

      /*
       * Never interfere with normal typing.
       */
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      /*
       * If user is typing in another field,
       * don't steal the characters.
       */
      if (isEditableTarget(target)) {
        return;
      }

      /*
       * ENTER
       */
      if (isTerminator(event.key)) {
        const buffered = normalizeBarcode(
          bufferRef.current
        );

        const timeSinceLastKey =
          Date.now() - lastKeyAtRef.current;

        if (
          buffered.length >= MIN_BARCODE_LENGTH &&
          timeSinceLastKey <= BUFFER_RESET_MS
        ) {
          event.preventDefault();
          event.stopPropagation();

          window.clearTimeout(idleTimerRef.current);

          bufferRef.current = '';

          lookupRef.current?.(buffered);
        } else {
          bufferRef.current = '';
        }

        return;
      }

      /*
       * Ignore non-barcode keys.
       */
      if (!isBarcodeChar(event.key)) {
        return;
      }

      const now = Date.now();

      const gap = addToBuffer(
        event.key,
        now
      );

      /*
       * Global scanner only accepts
       * fast keyboard bursts.
       */
      if (
        gap > SCANNER_CHAR_GAP_MS &&
        bufferRef.current.length <= 1
      ) {
        bufferRef.current = event.key;
      }

      /*
       * Prevent scanner characters from
       * going into the current page.
       */
      event.preventDefault();
      event.stopPropagation();

      /*
       * Show scanned barcode in our input.
       */
      setFieldValue(bufferRef.current);

      /*
       * Make sure scanner input remains ready.
       */
      inputRef.current?.focus();

      if (
        bufferRef.current.length >= MIN_BARCODE_LENGTH
      ) {
        scheduleIdleSubmit();
      }
    };

    /*
     * Capture phase.
     */
    window.addEventListener(
      'keydown',
      handleKeyDown,
      true
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
        true
      );

      window.clearTimeout(
        idleTimerRef.current
      );

      window.clearTimeout(
        statusTimerRef.current
      );
    };
  }, [
    captureGlobalScans,
    disabled,
    inputRef,
    addToBuffer,
    scheduleIdleSubmit,
    setFieldValue,
  ]);

  /*
   * Autofocus only when component is mounted.
   */
  useEffect(() => {
    if (!autoFocus || disabled) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    autoFocus,
    disabled,
    inputRef,
  ]);

  /*
   * Component cleanup.
   */
  useEffect(() => {
    return () => {
      window.clearTimeout(
        idleTimerRef.current
      );

      window.clearTimeout(
        statusTimerRef.current
      );

      bufferRef.current = '';
      queueRef.current = [];
    };
  }, []);

  return (
    <div
      className={`relative flex-1 rounded-lg ${ringClass} ${className}`}
    >
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

          const barcode =
            event.clipboardData?.getData('text') || '';

          if (barcode) {
            lookupRef.current?.(barcode);
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