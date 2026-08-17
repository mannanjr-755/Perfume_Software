import { formatMoney } from './currency.js';

export function getOrderId(order) {
  if (order?.orderNumber) return String(order.orderNumber);
  return String(order?._id || '').slice(-8).toUpperCase() || '--------';
}

function titleCase(value) {
  const text = String(value ?? '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildReceiptHtml(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const total = Number(order?.total || subtotal || 0);
  const created = order?.createdAt ? new Date(order.createdAt) : new Date();
  const payment = order?.paymentMethod || 'Cash';

  const rows = items.length
    ? items
        .map((item) => {
          const qty = Number(item.quantity || 0);
          const price = Number(item.price || 0);
          const line = qty * price;
          const meta = [item.brand, item.category].filter(Boolean).join(' · ');
          return `
            <tr>
              <td>
                <div class="item-name">${escapeHtml(item.productName || 'Product')}</div>
                ${meta ? `<div class="item-meta">${escapeHtml(meta)}</div>` : ''}
                ${item.barcode ? `<div class="item-meta">${escapeHtml(item.barcode)}</div>` : ''}
              </td>
              <td class="num">${qty}</td>
              <td class="num">${formatMoney(price)}</td>
              <td class="num">${formatMoney(line)}</td>
            </tr>`;
        })
        .join('')
    : `<tr><td colspan="4" class="empty">No products</td></tr>`;

  const discount = Number(order?.discount) || 0;
  const tax = Number(order?.tax) || 0;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${getOrderId(order)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body {
        font-family: "Segoe UI", Inter, Arial, sans-serif;
        color: #1f1c3b;
      }
      .receipt {
        width: 360px;
        margin: 0 auto;
        padding: 22px 20px 18px;
        background: #fff;
      }
      .center { text-align: center; }
      .logo {
        display: block;
        width: 76px;
        height: auto;
        margin: 0 auto 10px;
        object-fit: contain;
      }
      .store {
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #5b21b6;
        text-transform: uppercase;
      }
      .tagline {
        margin-top: 4px;
        font-size: 11px;
        color: #6b7280;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .title {
        margin: 14px 0 2px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .rule {
        border: 0;
        border-top: 1px dashed #c4b5fd;
        margin: 12px 0;
      }
      .meta { font-size: 12px; line-height: 1.7; }
      .meta b { font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      th {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b7280;
        font-weight: 700;
        padding: 0 0 8px;
        border-bottom: 1px solid #ece9fb;
      }
      td {
        font-size: 12px;
        padding: 8px 0;
        border-bottom: 1px dotted #ece9fb;
        vertical-align: top;
      }
      .num { text-align: right; white-space: nowrap; }
      .item-name { font-weight: 700; }
      .item-meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
      .empty { text-align: center; color: #6b7280; }
      .totals { width: 100%; margin-top: 8px; }
      .totals td { border: 0; padding: 4px 0; font-size: 12px; }
      .grand td { font-size: 15px; font-weight: 800; padding-top: 8px; }
      .pay {
        font-size: 12px;
        line-height: 1.7;
      }
      .thanks {
        margin-top: 6px;
        font-size: 12px;
        color: #5b21b6;
        font-weight: 700;
      }
      .tiny { font-size: 10px; color: #9ca3af; margin-top: 4px; }
      @media screen and (max-width: 399px) {
        .receipt { width: 100%; max-width: 360px; }
      }
      @media print {
        @page { size: auto; margin: 8mm; }
        body { background: #fff; }
        .receipt { width: 100%; max-width: 360px; }
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="center">
        <img src="/logo.jpg" alt="Scent Yours logo" class="logo" />
        <div class="store">Scent Yours</div>
        <div class="tagline">Premium Fragrances</div>
        <div class="title">Sales Receipt</div>
      </div>
      <hr class="rule" />
      <div class="meta">
        <div><b>Order ID:</b> #${escapeHtml(getOrderId(order))}</div>
        <div><b>Date:</b> ${escapeHtml(created.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }))}</div>
        <div><b>Time:</b> ${escapeHtml(created.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }))}</div>
        <div><b>Status:</b> ${escapeHtml(titleCase(order?.status || '-'))}</div>
        <div><b>Payment status:</b> ${escapeHtml(titleCase(order?.paymentStatus || '-'))}</div>
      </div>
      <hr class="rule" />
      <div class="meta">
        <div><b>Customer:</b> ${escapeHtml(order?.customerName || '-')}</div>
        <div><b>Phone:</b> ${escapeHtml(order?.customerPhone || '-')}</div>
        <div><b>Email:</b> ${escapeHtml(order?.customerEmail || '-')}</div>
      </div>
      <hr class="rule" />
      <table>
        <thead>
          <tr>
            <th style="text-align:left">Product</th>
            <th class="num">Qty</th>
            <th class="num">Price</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="totals">
        <tr>
          <td>Subtotal</td>
          <td class="num">${formatMoney(subtotal)}</td>
        </tr>
        ${discount > 0 ? `<tr><td>Discount</td><td class="num">-${formatMoney(discount)}</td></tr>` : ''}
        ${tax > 0 ? `<tr><td>Tax</td><td class="num">+${formatMoney(tax)}</td></tr>` : ''}
        <tr class="grand">
          <td>Total</td>
          <td class="num">${formatMoney(total)}</td>
        </tr>
      </table>
      <hr class="rule" />
      <div class="pay">
        <div><b>Payment method:</b> ${escapeHtml(payment)}</div>
        <div><b>Currency:</b> PKR (Rs.)</div>
      </div>
      <hr class="rule" />
      <div class="center">
        <div class="thanks">Thank you for your purchase</div>
        <div class="tiny">This is a computer generated receipt</div>
      </div>
    </div>
  </body>
</html>`;
}

export function printReceipt(order) {
  const html = buildReceiptHtml(order);
  let iframe = document.getElementById('order-receipt-print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'order-receipt-print-frame';
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

  const images = Array.from(frameDocument.images || []);
  if (images.length === 0) {
    frameWindow.print();
    return;
  }
  Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          })
    )
  ).then(() => frameWindow.print());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
