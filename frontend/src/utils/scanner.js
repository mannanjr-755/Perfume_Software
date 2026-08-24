import { normalizeBarcode } from './barcode.js';

const LAST_SCAN_KEY = 'perfume-last-barcode-scan';
const SCAN_EVENT = 'perfume:barcode-scan';
const DEBUG_EVENT = 'perfume:barcode-debug';

export function logBarcodeDebug(eventName, payload = {}) {
  const entry = {
    eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  console.log(`[barcode:${eventName}]`, payload);

  try {
    const existing = JSON.parse(sessionStorage.getItem('perfume-barcode-debug') || '[]');
    const next = [...existing, entry].slice(-80);
    sessionStorage.setItem('perfume-barcode-debug', JSON.stringify(next));
  } catch {
    // storage unavailable
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEBUG_EVENT, { detail: entry }));
    window.__barcodeDebug = {
      ...(window.__barcodeDebug || {}),
      lastEvent: entry,
      lastBarcode: payload.barcode || payload.code || window.__barcodeDebug?.lastBarcode || null,
      lastApiRequest: payload.apiRequest || window.__barcodeDebug?.lastApiRequest || null,
      lastLookupResult: payload.lookupResult || window.__barcodeDebug?.lastLookupResult || null,
    };
  }
}

/** USB ~5–20ms/char; Bluetooth HID wedges (Netum HW-L98) ~30–200ms/char. */
export const SCANNER_CHAR_GAP_MS = 350;
export const BUFFER_RESET_MS = 1200;
export const IDLE_SUBMIT_MS = 450;
export const MIN_BARCODE_LENGTH = 4;
export const MAX_BARCODE_LENGTH = 64;

const wedgeHandlers = new Set();
let wedgeBuffer = '';
let wedgeLastKeyAt = 0;
let wedgeIdleTimer = null;
let wedgeListenerInstalled = false;

export function publishBarcodeScan(barcode) {
  const scan = {
    barcode,
    scannedAt: new Date().toISOString(),
  };

  logBarcodeDebug('scan-published', { barcode, scannedAt: scan.scannedAt });

  try {
    localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(scan));
  } catch {
    /* storage unavailable */
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

export function getOpenModal() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('[data-modal-open="true"]');
}

export function isNodeInsideOpenModal(node) {
  const modal = getOpenModal();
  if (!modal || !node) return false;
  return modal.contains(node);
}

/**
 * USB HID scanners type into the focused field. A barcode input behind an
 * open modal must not swallow the scan — the modal field should receive it.
 */
export function shouldFieldHandleBarcode(target) {
  if (!target || target.dataset?.barcodeScan !== 'true') return false;
  const modal = getOpenModal();
  if (!modal) return true;
  return modal.contains(target);
}

export function isTerminatorKey(key, code, keyCode) {
  const which = Number(keyCode) || 0;
  return (
    key === 'Enter' ||
    key === 'NumpadEnter' ||
    key === 'Tab' ||
    key === '\r' ||
    key === '\n' ||
    code === 'Enter' ||
    code === 'NumpadEnter' ||
    code === 'Tab' ||
    which === 13 ||
    which === 9
  );
}

export function charFromKeyboardEvent(event) {
  const key = event.key;

  if (typeof key === 'string' && key.length === 1 && key.charCodeAt(0) >= 32) {
    return key;
  }

  const code = event.code || '';
  if (/^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code)) {
    return code.slice(-1);
  }
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(-1);
  }

  const keyCode = event.keyCode || event.which;
  if (keyCode >= 48 && keyCode <= 57) return String.fromCharCode(keyCode);
  if (keyCode >= 96 && keyCode <= 105) return String(keyCode - 96);
  if (keyCode >= 65 && keyCode <= 90) return String.fromCharCode(keyCode);

  return '';
}

export function isEditableTarget(target) {
  if (!target || target === document.body) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.isContentEditable);
}

function clearEditableValue(target) {
  if (!target || typeof target.value !== 'string') return;
  const proto = Object.getPrototypeOf(target);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(target, '');
  else target.value = '';
  target.dispatchEvent(new Event('input', { bubbles: true }));
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

function dispatchWedge(code) {
  const normalized = normalizeBarcode(code);
  if (normalized.length < MIN_BARCODE_LENGTH) return false;

  const handlers = [...wedgeHandlers];
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    const handler = handlers[index];
    if (handler?.(normalized)) return true;
  }
  return false;
}

function resetWedgeBuffer() {
  wedgeBuffer = '';
  window.clearTimeout(wedgeIdleTimer);
  wedgeIdleTimer = null;
}

function scheduleWedgeIdleSubmit() {
  window.clearTimeout(wedgeIdleTimer);
  wedgeIdleTimer = window.setTimeout(() => {
    const code = normalizeBarcode(wedgeBuffer);
    resetWedgeBuffer();
    if (code.length >= MIN_BARCODE_LENGTH) {
      dispatchWedge(code);
    }
  }, IDLE_SUBMIT_MS);
}

function onGlobalWedgeKeyDown(event) {
  if (!wedgeHandlers.size) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.defaultPrevented) return;

  const target = event.target;
  if (shouldFieldHandleBarcode(target)) return;

  const now = Date.now();
  const key = event.key ?? '';
  const code = event.code ?? '';
  const character = charFromKeyboardEvent(event);

  logBarcodeDebug('keyboard-event', {
    key,
    code,
    char: character || null,
    targetTag: target?.tagName || null,
    targetType: target?.type || null,
    buffer: wedgeBuffer,
  });

  if (isTerminatorKey(event.key, event.code, event.keyCode || event.which)) {
    const finalCode = normalizeBarcode(wedgeBuffer);
    const recent = now - wedgeLastKeyAt <= BUFFER_RESET_MS;

    logBarcodeDebug('terminator-key', {
      key,
      code,
      buffer: wedgeBuffer,
      finalCode,
      recent,
    });

    resetWedgeBuffer();

    if (finalCode.length >= MIN_BARCODE_LENGTH && recent) {
      event.preventDefault();
      event.stopPropagation();
      dispatchWedge(finalCode);
    }
    return;
  }

  if (!character) return;

  const gap = now - wedgeLastKeyAt;
  wedgeLastKeyAt = now;

  if (gap > BUFFER_RESET_MS) wedgeBuffer = '';
  wedgeBuffer = `${wedgeBuffer}${character}`.slice(0, MAX_BARCODE_LENGTH);

  const otherField = isEditableTarget(target);
  const burst = wedgeBuffer.length > 1 && gap <= SCANNER_CHAR_GAP_MS;

  if (otherField && wedgeBuffer.length === 1) {
    return;
  }

  if (otherField && !burst) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (otherField) {
    if (burst) clearEditableValue(target);
    else stripLastTypedChar(target);
  }

  if (wedgeBuffer.length >= MIN_BARCODE_LENGTH) {
    logBarcodeDebug('scanner-buffer-ready', {
      buffer: wedgeBuffer,
      length: wedgeBuffer.length,
      gap,
    });
    scheduleWedgeIdleSubmit();
  }
}

function ensureWedgeListener() {
  if (wedgeListenerInstalled) return;
  window.addEventListener('keydown', onGlobalWedgeKeyDown, true);
  wedgeListenerInstalled = true;
}

function removeWedgeListenerIfIdle() {
  if (wedgeHandlers.size || !wedgeListenerInstalled) return;
  window.removeEventListener('keydown', onGlobalWedgeKeyDown, true);
  wedgeListenerInstalled = false;
  resetWedgeBuffer();
  wedgeLastKeyAt = 0;
}

/**
 * Register a global keyboard-wedge handler (USB / Bluetooth HID scanners).
 * Returns an unregister function. Handlers receive normalized barcode strings.
 */
export function registerWedgeHandler(handler) {
  wedgeHandlers.add(handler);
  ensureWedgeListener();

  return () => {
    wedgeHandlers.delete(handler);
    removeWedgeListenerIfIdle();
  };
}
