import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { LuKeyboard, LuScanBarcode } from 'react-icons/lu';
import { FiCheckCircle, FiMinus, FiPlus, FiShoppingCart, FiX } from 'react-icons/fi';
import ProductImage from './ui/ProductImage.jsx';
import BarcodeScanInput from './BarcodeScanInput.jsx';
import api, { getErrorMessage } from '../services/api.js';
import { fetchResource, createResource } from '../services/resourceService.js';
import { formatRs } from '../utils/currency.js';
import { LOW_STOCK_THRESHOLD } from '../utils/barcode.js';
import { upsertOrderItem } from '../utils/orderCart.js';
import { toastSuccess, toastError, toastWarning } from '../utils/toast.js';

const paymentMethods = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'JazzCash', label: 'JazzCash' },
  { value: 'EasyPaisa', label: 'EasyPaisa' },
];

function toCartItem(product) {
  return {
    productId: product._id,
    productName: product.name || 'Product',
    brand: product.brand || '',
    category: product.category || '',
    description: product.description || '',
    image: product.image || '',
    barcode: product.barcode || '',
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    quantity: 1,
  };
}

export default function PosScanner({ onOrderCreated }) {
  const [products, setProducts] = useState([]);
  const [taxRate, setTaxRate] = useState(0);
  const [manualProductId, setManualProductId] = useState('');
  const [cart, setCart] = useState([]);
  const [scanState, setScanState] = useState('idle');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  const inputRef = useRef(null);
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetchResource('/products', { limit: 200 });
      const payload = res.data || res;
      setProducts(payload.items || payload || []);
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    focusInput();
  }, [loadProducts, focusInput]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/settings');
        const settings = data.data || data;
        if (active) setTaxRate(Number(settings.taxRate) || 0);
      } catch {
        /* keep default tax rate */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const addProductToCart = useCallback((product) => {
    const result = upsertOrderItem(cartRef.current, product, toCartItem);
    const name = result.name || product.name || 'Product';

    if (!result.ok) {
      setScanState('error');
      if (result.reason === 'inactive') {
        toastWarning('Product inactive', `${name} is inactive and cannot be sold.`);
      } else if (result.reason === 'out_of_stock') {
        toastError('Out of stock', `${name} is out of stock.`);
      } else if (result.reason === 'stock_limit') {
        toastWarning('Stock limit', `Only ${result.stock} unit${result.stock === 1 ? '' : 's'} of ${name} available.`);
      }
      return;
    }

    setCart(result.items);
    setScanState('success');

    if (result.stock <= LOW_STOCK_THRESHOLD) {
      toastWarning('Low stock', `Only ${result.stock} unit${result.stock === 1 ? '' : 's'} left for ${name}.`);
    } else if (result.added) {
      toastSuccess('Product added', `${name} — ${formatRs(product.price)}`);
    } else {
      toastSuccess('Quantity updated', `${name} × ${result.quantity}`);
    }
  }, []);

  const handleManualAdd = () => {
    const product = products.find((entry) => String(entry._id) === String(manualProductId));
    if (product) {
      addProductToCart(product);
      setManualProductId('');
    }
    focusInput();
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const tax = Math.round((subtotal - discountValue) * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal - discountValue + tax) * 100) / 100;

  const completeOrder = async () => {
    if (completing) return;
    if (!cart.length) {
      Swal.fire({ icon: 'warning', title: 'Empty cart', text: 'Scan or add at least one product first.' });
      focusInput();
      return;
    }
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Complete order?',
      html: `<div style="text-align:left;font-size:14px;line-height:1.9">
        <p><b>Items:</b> ${cart.length}</p>
        <p><b>Subtotal:</b> ${formatRs(subtotal)}</p>
        ${discountValue > 0 ? `<p><b>Discount:</b> -${formatRs(discountValue)}</p>` : ''}
        ${tax > 0 ? `<p><b>Tax (${taxRate}%):</b> +${formatRs(tax)}</p>` : ''}
        <p style="font-size:16px"><b>Total:</b> ${formatRs(total)}</p>
      </div>`,
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
      confirmButtonText: 'Complete Sale',
      cancelButtonText: 'Back',
    });
    if (!confirm.isConfirmed) return;

    try {
      setCompleting(true);
      const payload = {
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim(),
        paymentMethod,
        discount: discountValue,
        notes: notes.trim(),
        status: 'delivered',
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          category: item.category,
          description: item.description,
          image: item.image,
          barcode: item.barcode,
          quantity: item.quantity,
          price: item.price,
        })),
      };
      await createResource('/orders', payload);
      toastSuccess('Order completed', `Total ${formatRs(total)} — stock updated.`);
      setCart([]);
      setDiscount(0);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setScanState('idle');
      loadProducts();
      onOrderCreated?.();
      focusInput();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Order failed', text: getErrorMessage(error) });
      loadProducts();
      focusInput();
    } finally {
      setCompleting(false);
    }
  };

  const ringClass =
    scanState === 'success'
      ? 'ring-2 ring-emerald-500/60'
      : scanState === 'error'
        ? 'ring-2 ring-red-500/60'
        : '';

  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b divider-border px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-sm">
              <LuScanBarcode size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold panel-title">Barcode Point of Sale</h2>
              <p className="text-xs panel-muted">Scan a barcode to add products — rescan to increase quantity</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              cart.length
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-[var(--surface-soft)] panel-muted'
            }`}
          >
            {cart.length ? `${cart.length} item${cart.length === 1 ? '' : 's'} in cart` : 'Cart empty'}
          </span>
        </div>

        <div className="mt-3.5 flex flex-col gap-2 lg:flex-row lg:items-center">
          <BarcodeScanInput
            inputRef={inputRef}
            ringClass={ringClass}
            onProductFound={addProductToCart}
            onScanStateChange={setScanState}
            captureGlobalScans
            placeholder="Scan barcode here — or type the number and press Enter"
          />

          <select
            className="input-field lg:w-64"
            value={manualProductId}
            onChange={(e) => setManualProductId(e.target.value)}
            aria-label="Add product manually"
          >
            <option value="">Quick add from catalog…</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name}
                {product.brand ? ` · ${product.brand}` : ''} — {formatRs(product.price)}
                {Number(product.stock) === 0
                  ? ' (Out of stock)'
                  : Number(product.stock) <= LOW_STOCK_THRESHOLD
                    ? ` (${product.stock} left)`
                    : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleManualAdd}
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-2"
            disabled={!manualProductId}
            title="Add selected product"
          >
            <FiShoppingCart size={16} />
            Add to cart
          </button>
        </div>
      </div>

      {cart.length ? (
        <div className="grid gap-0 md:grid-cols-[1fr_320px]">
          <div className="md:border-r divider-border">
            <ul className="max-h-[420px] space-y-2 overflow-y-auto p-4 sm:p-5">
              {cart.map((item) => (
                <li key={item.productId} className="flex gap-3 rounded-xl border divider-border bg-[var(--surface)] p-3 transition-shadow hover:shadow-sm">
                  <ProductImage src={item.image} alt={item.productName} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold panel-title">{item.productName}</p>
                        <p className="truncate text-xs panel-muted">
                          {[item.brand, item.category].filter(Boolean).join(' · ') || 'Perfume'}
                          {item.barcode ? ` · ${item.barcode}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCart((prev) => prev.filter((it) => it.productId !== item.productId))}
                        className="rounded-md p-1 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                        aria-label={`Remove ${item.productName}`}
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--primary)]">{formatRs(item.price)}</p>
                      <p
                        className={`text-[11px] ${
                          item.stock - item.quantity <= LOW_STOCK_THRESHOLD ? 'text-amber-600' : 'panel-muted'
                        }`}
                      >
                        {item.stock} in stock
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="inline-flex items-center overflow-hidden rounded-lg border divider-border">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-[var(--surface-soft)] disabled:opacity-40 dark:text-gray-300"
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((it) =>
                                it.productId === item.productId ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it
                              )
                            )
                          }
                          aria-label="Decrease quantity"
                        >
                          <FiMinus size={14} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          className="h-8 w-12 border-x divider-border bg-[var(--surface)] text-center text-sm outline-none"
                          onChange={(e) => {
                            const qty = Math.max(1, Number(e.target.value) || 1);
                            setCart((prev) =>
                              prev.map((it) =>
                                it.productId === item.productId ? { ...it, quantity: Math.min(item.stock, qty) } : it
                              )
                            );
                          }}
                          aria-label="Quantity"
                        />
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-[var(--surface-soft)] disabled:opacity-40 dark:text-gray-300"
                          disabled={item.quantity >= item.stock}
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((it) =>
                                it.productId === item.productId
                                  ? { ...it, quantity: Math.min(item.stock, it.quantity + 1) }
                                  : it
                              )
                            )
                          }
                          aria-label="Increase quantity"
                        >
                          <FiPlus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col border-t divider-border p-4 sm:p-5 md:border-t-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold panel-title">Checkout</h3>
              <span className="text-xs panel-muted">
                {cart.length} item{cart.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="input-field"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="input-field"
                placeholder="Phone (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <select
                className="input-field"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                className="input-field"
                placeholder="Discount (PKR)"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
              <textarea
                rows={2}
                className="input-field"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="mt-4 space-y-1.5 border-t divider-border pt-3 text-sm">
              <div className="flex justify-between panel-muted">
                <span>Subtotal</span>
                <span>{formatRs(subtotal)}</span>
              </div>
              {discountValue > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>−{formatRs(discountValue)}</span>
                </div>
              ) : null}
              {tax > 0 ? (
                <div className="flex justify-between panel-muted">
                  <span>Tax ({taxRate}%)</span>
                  <span>+{formatRs(tax)}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 text-base font-bold panel-title">
                <span>Total</span>
                <span>{formatRs(total)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={completeOrder}
              disabled={completing}
              className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2"
            >
              <FiCheckCircle size={16} />
              {completing ? 'Completing order…' : 'Complete order'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:py-14">
          <div className="relative">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
              <LuScanBarcode size={24} />
            </span>
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-50" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--primary)]" />
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold panel-title">Your cart is empty</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed panel-muted">
              Scan a barcode above or pick a product from the catalog dropdown to start a sale.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-medium panel-muted">
            <LuKeyboard size={16} /> USB scanners work like keyboards — just scan
          </span>
        </div>
      )}
    </section>
  );
}
