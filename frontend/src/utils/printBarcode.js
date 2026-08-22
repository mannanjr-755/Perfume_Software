import JsBarcode from 'jsbarcode';
import { formatRs } from './currency.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderBarcodeDataUrl(value, { width = 2, height = 90, displayValue = true } = {}) {
  const canvas = document.createElement('canvas');
  const text = String(value);
  const isEan13 = /^[0-9]{13}$/.test(text)
    && text.split('').reduce((sum, d, i) => sum + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === 0;
  try {
    JsBarcode(canvas, text, {
      format: isEan13 ? 'EAN13' : 'CODE128',
      width,
      height,
      displayValue,
      margin: Math.ceil(width * 11),
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function buildBarcodeLabelHtml(label = {}) {
  const value = String(label.value || '').trim();
  const image = renderBarcodeDataUrl(value);
  const name = escapeHtml(label.name || 'Product');
  const brand = escapeHtml(label.brand || '');
  const price = Number(label.price) > 0 ? formatRs(Number(label.price)) : '';
  const barcodeText = escapeHtml(value);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Barcode label ${barcodeText}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body {
        font-family: "Segoe UI", Inter, Arial, sans-serif;
        color: #1f1c3b;
      }
      .label {
        display: inline-block;
        min-width: 320px;
        border: 1px solid #ece9fb;
        border-radius: 8px;
        padding: 14px 16px;
        margin: 12px;
      }
      .store {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.1em;
        color: #5b21b6;
        text-transform: uppercase;
      }
      .name { margin-top: 6px; font-size: 14px; font-weight: 700; }
      .brand { font-size: 12px; color: #6b7280; }
      .code { font-family: Consolas, monospace; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; }
      .price { font-size: 15px; font-weight: 800; color: #5b21b6; margin-top: 4px; }
      .barcode { margin-top: 8px; }
      .barcode img { display: block; max-width: 100%; }
      @media print {
        @page { size: auto; margin: 8mm; }
        body { background: #fff; }
        .label { border: 1px solid #ddd; }
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="store">Scent Yours</div>
      <div class="name">${name}</div>
      ${brand ? `<div class="brand">${brand}</div>` : ''}
      ${price ? `<div class="price">${price}</div>` : ''}
      ${image ? `<div class="barcode"><img src="${image}" alt="Barcode ${barcodeText}" /></div>` : ''}
      <div class="code">${barcodeText}</div>
    </div>
  </body>
</html>`;
}

export function printBarcodeLabel(label) {
  const html = buildBarcodeLabelHtml(label);
  let iframe = document.getElementById('barcode-label-print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'barcode-label-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) return;

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();
  frameWindow.focus();
  frameWindow.print();
}
