// import { useCallback, useEffect, useRef, useState } from 'react';
// import Swal from 'sweetalert2';
// import { LuKeyboard, LuScanBarcode } from 'react-icons/lu';
// import { FiCheckCircle, FiMinus, FiPlus, FiShoppingCart, FiX } from 'react-icons/fi';
// import ProductImage from './ui/ProductImage.jsx';
// import BarcodeScanInput from './BarcodeScanInput.jsx';
// import api, { getErrorMessage } from '../services/api.js';
// import { fetchResource, createResource } from '../services/resourceService.js';
// import { formatRs } from '../utils/currency.js';
// import { LOW_STOCK_THRESHOLD } from '../utils/barcode.js';
// import { upsertOrderItem } from '../utils/orderCart.js';

// const paymentMethods = [
//   { value: 'Cash', label: 'Cash' },
//   { value: 'Card', label: 'Card' },
//   { value: 'Bank Transfer', label: 'Bank Transfer' },
//   { value: 'JazzCash', label: 'JazzCash' },
//   { value: 'EasyPaisa', label: 'EasyPaisa' },
// ];

// function toCartItem(product) {
//   return {
//     productId: product._id,
//     productName: product.name || 'Product',
//     brand: product.brand || '',
//     category: product.category || '',
//     description: product.description || '',
//     image: product.image || '',
//     barcode: product.barcode || '',
//     size: product.size || '',
//     price: Number(product.price) || 0,
//     stock: Number(product.stock) || 0,
//     quantity: 1,
//   };
// }

// export default function PosScanner({ onOrderCreated }) {
//   const [products, setProducts] = useState([]);
//   const [taxRate, setTaxRate] = useState(0);
//   const [manualProductId, setManualProductId] = useState('');
//   const [cart, setCart] = useState([]);
//   const [scanState, setScanState] = useState('idle');
//   const [scanNotice, setScanNotice] = useState(null);
//   const [customerName, setCustomerName] = useState('');
//   const [customerPhone, setCustomerPhone] = useState('');
//   const [paymentMethod, setPaymentMethod] = useState('Cash');
//   const [discount, setDiscount] = useState(0);
//   const [notes, setNotes] = useState('');
//   const [completing, setCompleting] = useState(false);

//   const inputRef = useRef(null);
//   const cartRef = useRef(cart);
//   const noticeTimerRef = useRef(0);

//   useEffect(() => {
//     cartRef.current = cart;
//   }, [cart]);

//   const focusInput = useCallback(() => {
//     requestAnimationFrame(() => {
//       inputRef.current?.focus();
//     });
//   }, []);

//   const showNotice = useCallback((notice) => {
//     window.clearTimeout(noticeTimerRef.current);
//     setScanNotice(notice);
//     noticeTimerRef.current = window.setTimeout(() => setScanNotice(null), 2800);
//   }, []);

//   useEffect(
//     () => () => {
//       window.clearTimeout(noticeTimerRef.current);
//     },
//     []
//   );

//   const loadProducts = useCallback(async () => {
//     try {
//       const res = await fetchResource('/products', { limit: 200 });
//       const payload = res.data || res;
//       setProducts(payload.items || payload || []);
//     } catch {
//       setProducts([]);
//     }
//   }, []);

//   useEffect(() => {
//     loadProducts();
//     focusInput();
//   }, [loadProducts, focusInput]);

//   useEffect(() => {
//     let active = true;
//     (async () => {
//       try {
//         const { data } = await api.get('/settings');
//         const settings = data.data || data;
//         if (active) setTaxRate(Number(settings.taxRate) || 0);
//       } catch {
//         /* keep default tax rate */
//       }
//     })();
//     return () => {
//       active = false;
//     };
//   }, []);

//   const addProductToCart = useCallback(
//     (product) => {
//       const result = upsertOrderItem(cartRef.current, product, toCartItem);
//       const name = result.name || product.name || 'Product';
//       const size = product.size || '';

//       if (!result.ok) {
//         setScanState('error');
//         if (result.reason === 'inactive') {
//           showNotice({ type: 'error', title: 'Product inactive', text: `${name} is inactive and cannot be sold.` });
//         } else if (result.reason === 'out_of_stock') {
//           showNotice({ type: 'error', title: 'Out of Stock', text: `${name} is out of stock.` });
//         } else if (result.reason === 'stock_limit') {
//           showNotice({
//             type: 'error',
//             title: `Only ${result.stock} units available`,
//             text: `Cannot add more ${name} — ${result.stock} in stock.`,
//           });
//         } else {
//           showNotice({ type: 'error', title: 'Scan failed', text: `${name} could not be added to the order.` });
//         }
//         focusInput();
//         return;
//       }

//       setCart(result.items);
//       setScanState('success');
//       showNotice({
//         type: 'success',
//         title: result.added ? 'Added to Cart' : 'Quantity updated',
//         name,
//         size,
//         price: Number(product.price) || 0,
//         stock: result.stock,
//         quantity: result.quantity,
//       });
//       focusInput();
//     },
//     [focusInput, showNotice]
//   );

//   const handleNotFound = useCallback(
//     (code) => {
//       setScanState('error');
//       showNotice({
//         type: 'error',
//         title: 'Product Not Found',
//         text: `Barcode:\n${code}\nThis barcode is not assigned to any product.`,
//       });
//       focusInput();
//     },
//     [focusInput, showNotice]
//   );

//   const handleManualAdd = () => {
//     const product = products.find((entry) => String(entry._id) === String(manualProductId));
//     if (product) {
//       addProductToCart(product);
//       setManualProductId('');
//     }
//     focusInput();
//   };

//   const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
//   const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
//   const tax = Math.round((subtotal - discountValue) * (taxRate / 100) * 100) / 100;
//   const total = Math.round((subtotal - discountValue + tax) * 100) / 100;

//   const completeOrder = async () => {
//     if (completing) return;
//     if (!cart.length) {
//       showNotice({ type: 'error', title: 'Empty cart', text: 'Scan or add at least one product first.' });
//       focusInput();
//       return;
//     }
//     const confirm = await Swal.fire({
//       icon: 'question',
//       title: 'Complete order?',
//       html: `<div style="text-align:left;font-size:14px;line-height:1.9">
//         <p><b>Items:</b> ${cart.length}</p>
//         <p><b>Subtotal:</b> ${formatRs(subtotal)}</p>
//         ${discountValue > 0 ? `<p><b>Discount:</b> -${formatRs(discountValue)}</p>` : ''}
//         ${tax > 0 ? `<p><b>Tax (${taxRate}%):</b> +${formatRs(tax)}</p>` : ''}
//         <p style="font-size:16px"><b>Total:</b> ${formatRs(total)}</p>
//       </div>`,
//       showCancelButton: true,
//       confirmButtonColor: '#7c3aed',
//       confirmButtonText: 'Complete Sale',
//       cancelButtonText: 'Back',
//     });
//     if (!confirm.isConfirmed) {
//       focusInput();
//       return;
//     }

//     try {
//       setCompleting(true);
//       const payload = {
//         customerName: customerName.trim() || 'Walk-in Customer',
//         customerPhone: customerPhone.trim(),
//         paymentMethod,
//         discount: discountValue,
//         notes: notes.trim(),
//         status: 'delivered',
//         items: cart.map((item) => ({
//           productId: item.productId,
//           quantity: item.quantity,
//         })),
//       };
//       await createResource('/orders', payload);
//       showNotice({ type: 'success', title: 'Sale completed', text: `Total ${formatRs(total)} — stock updated.` });
//       setCart([]);
//       setDiscount(0);
//       setNotes('');
//       setCustomerName('');
//       setCustomerPhone('');
//       setScanState('idle');
//       loadProducts();
//       onOrderCreated?.();
//       focusInput();
//     } catch (error) {
//       Swal.fire({ icon: 'error', title: 'Order failed', text: getErrorMessage(error) });
//       loadProducts();
//       focusInput();
//     } finally {
//       setCompleting(false);
//     }
//   };

//   const ringClass =
//     scanState === 'success'
//       ? 'ring-2 ring-emerald-500/60'
//       : scanState === 'error'
//         ? 'ring-2 ring-red-500/60'
//         : '';

//   return (
//     <section className="card-surface overflow-hidden">
//       <div className="border-b divider-border px-4 py-3.5 sm:px-5">
//         <div className="flex flex-wrap items-center justify-between gap-3">
//           <div className="flex items-center gap-3">
//             <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-sm">
//               <LuScanBarcode size={20} />
//             </span>
//             <div>
//               <h2 className="text-base font-semibold panel-title">Barcode Point of Sale</h2>
//               <p className="text-xs panel-muted">Scan → add to cart → scan again. Checkout when ready.</p>
//             </div>
//           </div>
//           <span
//             className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
//               cart.length
//                 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
//                 : 'bg-[var(--surface-soft)] panel-muted'
//             }`}
//           >
//             {cart.length ? `${cart.length} item${cart.length === 1 ? '' : 's'} in cart` : 'Cart empty'}
//           </span>
//         </div>

//         <div className="mt-3.5 flex flex-col gap-2 lg:flex-row lg:items-stretch">
//           {/* <BarcodeScanInput
//             inputRef={inputRef}
//             ringClass={ringClass}
//             onProductFound={addProductToCart}
//             onNotFound={handleNotFound}
//             onScanStateChange={setScanState}
//             captureGlobalScans
//             notifyErrors={false}
//             placeholder="Scan barcode or enter barcode manually"
//             inputClassName="!h-12 text-base"
//           /> */}
//           <BarcodeScanInput
//   inputRef={inputRef}
//   ringClass={ringClass}
//   onProductFound={addProductToCart}
//   onNotFound={handleNotFound}
//   onScanStateChange={setScanState}
//   captureGlobalScans
//   notifyErrors={false}
//   placeholder="Scan barcode or enter barcode manually"
//   inputClassName="!h-12 text-base"
// />

//           <select
//             className="input-field lg:w-64"
//             value={manualProductId}
//             onChange={(e) => setManualProductId(e.target.value)}
//             aria-label="Add product manually"
//           >
//             <option value="">Quick add from catalog…</option>
//             {products.map((product) => (
//               <option key={product._id} value={product._id}>
//                 {product.name}
//                 {product.brand ? ` · ${product.brand}` : ''}
//                 {product.size ? ` · ${product.size}` : ''} — {formatRs(product.price)}
//                 {Number(product.stock) === 0
//                   ? ' (Out of stock)'
//                   : Number(product.stock) <= LOW_STOCK_THRESHOLD
//                     ? ` (${product.stock} left)`
//                     : ''}
//               </option>
//             ))}
//           </select>

//           <button
//             type="button"
//             onClick={handleManualAdd}
//             className="btn-primary inline-flex shrink-0 items-center justify-center gap-2"
//             disabled={!manualProductId}
//             title="Add selected product"
//           >
//             <FiShoppingCart size={16} />
//             Add to cart
//           </button>
//         </div>

//         {scanNotice ? (
//           <div
//             className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
//               scanNotice.type === 'success'
//                 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
//                 : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200'
//             }`}
//             role="status"
//           >
//             <p className="font-semibold">
//               {scanNotice.type === 'success' ? '✓ ' : ''}
//               {scanNotice.title}
//             </p>
//             {scanNotice.name ? (
//               <p className="mt-0.5">
//                 {scanNotice.name}
//                 {scanNotice.size ? ` · ${scanNotice.size}` : ''}
//                 {scanNotice.quantity > 1 ? ` · Qty ${scanNotice.quantity}` : ''}
//               </p>
//             ) : null}
//             {scanNotice.price != null && scanNotice.type === 'success' ? (
//               <p className="mt-0.5">
//                 {formatRs(scanNotice.price)}
//                 {scanNotice.stock != null ? ` · Stock: ${scanNotice.stock}` : ''}
//               </p>
//             ) : null}
//             {scanNotice.text ? (
//               <p className="mt-0.5 whitespace-pre-line opacity-90">{scanNotice.text}</p>
//             ) : null}
//           </div>
//         ) : null}
//       </div>

//       {cart.length ? (
//         <div className="grid gap-0 md:grid-cols-[1fr_320px]">
//           <div className="md:border-r divider-border">
//             <div className="max-h-[460px] overflow-auto">
//               <table className="min-w-full text-sm">
//                 <thead className="sticky top-0 bg-[var(--surface-soft)] text-left text-xs uppercase tracking-wide panel-muted">
//                   <tr>
//                     <th className="px-4 py-2.5 font-semibold">Product</th>
//                     <th className="px-3 py-2.5 font-semibold">Size</th>
//                     <th className="px-3 py-2.5 font-semibold">Qty</th>
//                     <th className="px-3 py-2.5 font-semibold text-right">Price</th>
//                     <th className="px-3 py-2.5 font-semibold text-right">Total</th>
//                     <th className="px-3 py-2.5" />
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {cart.map((item) => (
//                     <tr key={item.productId} className="border-t divider-border">
//                       <td className="px-4 py-3">
//                         <div className="flex items-center gap-3">
//                           <ProductImage src={item.image} alt={item.productName} className="h-12 w-12" />
//                           <div className="min-w-0">
//                             <p className="truncate font-semibold panel-title">{item.productName}</p>
//                             <p className="truncate text-xs panel-muted">{item.brand || 'Perfume'}</p>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-3 py-3 panel-muted">{item.size || '—'}</td>
//                       <td className="px-3 py-3">
//                         <div className="inline-flex items-center overflow-hidden rounded-lg border divider-border">
//                           <button
//                             type="button"
//                             className="flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-[var(--surface-soft)] disabled:opacity-40 dark:text-gray-300"
//                             disabled={item.quantity <= 1}
//                             onClick={() =>
//                               setCart((prev) =>
//                                 prev.map((it) =>
//                                   it.productId === item.productId ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it
//                                 )
//                               )
//                             }
//                             aria-label="Decrease quantity"
//                           >
//                             <FiMinus size={14} />
//                           </button>
//                           <input
//                             type="number"
//                             min="1"
//                             max={item.stock}
//                             value={item.quantity}
//                             className="h-8 w-12 border-x divider-border bg-[var(--surface)] text-center text-sm outline-none"
//                             onChange={(e) => {
//                               const qty = Math.max(1, Number(e.target.value) || 1);
//                               if (qty > item.stock) {
//                                 showNotice({
//                                   type: 'error',
//                                   title: `Only ${item.stock} units available`,
//                                   text: item.productName,
//                                 });
//                               }
//                               setCart((prev) =>
//                                 prev.map((it) =>
//                                   it.productId === item.productId ? { ...it, quantity: Math.min(item.stock, qty) } : it
//                                 )
//                               );
//                             }}
//                             aria-label="Quantity"
//                           />
//                           <button
//                             type="button"
//                             className="flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-[var(--surface-soft)] disabled:opacity-40 dark:text-gray-300"
//                             disabled={item.quantity >= item.stock}
//                             onClick={() => {
//                               if (item.quantity >= item.stock) {
//                                 showNotice({
//                                   type: 'error',
//                                   title: `Only ${item.stock} units available`,
//                                   text: item.productName,
//                                 });
//                                 return;
//                               }
//                               setCart((prev) =>
//                                 prev.map((it) =>
//                                   it.productId === item.productId
//                                     ? { ...it, quantity: Math.min(item.stock, it.quantity + 1) }
//                                     : it
//                                 )
//                               );
//                             }}
//                             aria-label="Increase quantity"
//                           >
//                             <FiPlus size={14} />
//                           </button>
//                         </div>
//                       </td>
//                       <td className="px-3 py-3 text-right">{formatRs(item.price)}</td>
//                       <td className="px-3 py-3 text-right font-semibold panel-title">
//                         {formatRs(item.price * item.quantity)}
//                       </td>
//                       <td className="px-3 py-3 text-right">
//                         <button
//                           type="button"
//                           onClick={() => setCart((prev) => prev.filter((it) => it.productId !== item.productId))}
//                           className="rounded-md p-1 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
//                           aria-label={`Remove ${item.productName}`}
//                         >
//                           <FiX size={16} />
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           <div className="flex flex-col border-t divider-border p-4 sm:p-5 md:border-t-0">
//             <div className="flex items-center justify-between">
//               <h3 className="text-sm font-semibold panel-title">Checkout</h3>
//               <span className="text-xs panel-muted">
//                 {cart.length} item{cart.length === 1 ? '' : 's'}
//               </span>
//             </div>
//             <div className="mt-3 space-y-2">
//               <input
//                 className="input-field"
//                 placeholder="Customer name (optional)"
//                 value={customerName}
//                 onChange={(e) => setCustomerName(e.target.value)}
//               />
//               <input
//                 className="input-field"
//                 placeholder="Phone (optional)"
//                 value={customerPhone}
//                 onChange={(e) => setCustomerPhone(e.target.value)}
//               />
//               <select
//                 className="input-field"
//                 value={paymentMethod}
//                 onChange={(e) => setPaymentMethod(e.target.value)}
//               >
//                 {paymentMethods.map((method) => (
//                   <option key={method.value} value={method.value}>
//                     {method.label}
//                   </option>
//                 ))}
//               </select>
//               <input
//                 type="number"
//                 min="0"
//                 className="input-field"
//                 placeholder="Discount (PKR)"
//                 value={discount}
//                 onChange={(e) => setDiscount(Number(e.target.value) || 0)}
//               />
//               <textarea
//                 rows={2}
//                 className="input-field"
//                 placeholder="Notes (optional)"
//                 value={notes}
//                 onChange={(e) => setNotes(e.target.value)}
//               />
//             </div>
//             <div className="mt-4 space-y-1.5 border-t divider-border pt-3 text-sm">
//               <div className="flex justify-between panel-muted">
//                 <span>Subtotal</span>
//                 <span>{formatRs(subtotal)}</span>
//               </div>
//               {discountValue > 0 ? (
//                 <div className="flex justify-between text-emerald-600">
//                   <span>Discount</span>
//                   <span>−{formatRs(discountValue)}</span>
//                 </div>
//               ) : null}
//               {tax > 0 ? (
//                 <div className="flex justify-between panel-muted">
//                   <span>Tax ({taxRate}%)</span>
//                   <span>+{formatRs(tax)}</span>
//                 </div>
//               ) : null}
//               <div className="flex justify-between pt-1 text-base font-bold panel-title">
//                 <span>Grand Total</span>
//                 <span>{formatRs(total)}</span>
//               </div>
//             </div>
//             <button
//               type="button"
//               onClick={completeOrder}
//               disabled={completing}
//               className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2"
//             >
//               <FiCheckCircle size={16} />
//               {completing ? 'Completing order…' : 'Checkout'}
//             </button>
//           </div>
//         </div>
//       ) : (
//         <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:py-14">
//           <div className="relative">
//             <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
//               <LuScanBarcode size={24} />
//             </span>
//             <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
//               <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-50" />
//               <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--primary)]" />
//             </span>
//           </div>
//           <div>
//             <p className="text-sm font-semibold panel-title">Ready to scan</p>
//             <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed panel-muted">
//               Point a USB or Bluetooth HID scanner at the field above, or type a barcode and press Enter.
//             </p>
//           </div>
//           <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-medium panel-muted">
//             <LuKeyboard size={16} /> Scanner works like a keyboard — no extra software
//           </span>
//         </div>
//       )}
//     </section>
//   );
// }


import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  LuKeyboard,
  LuScanBarcode,
} from 'react-icons/lu';
import {
  FiCheckCircle,
  FiMinus,
  FiPlus,
  FiShoppingCart,
  FiX,
} from 'react-icons/fi';

import ProductImage from './ui/ProductImage.jsx';
import BarcodeScanInput from './BarcodeScanInput.jsx';

import api, {
  getErrorMessage,
} from '../services/api.js';

import {
  fetchResource,
  createResource,
} from '../services/resourceService.js';

import { formatRs } from '../utils/currency.js';
import { LOW_STOCK_THRESHOLD } from '../utils/barcode.js';
import { upsertOrderItem } from '../utils/orderCart.js';

const paymentMethods = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'JazzCash', label: 'JazzCash' },
  { value: 'EasyPaisa', label: 'EasyPaisa' },
];

/*
 * Convert API product into cart item.
 */
function toCartItem(product) {
  const productId = product?._id ?? product?.id;

  return {
    productId,
    productName: product?.name || 'Product',
    brand: product?.brand || '',
    category: product?.category || '',
    description: product?.description || '',
    image: product?.image || '',
    barcode: product?.barcode || '',
    size: product?.size || '',
    price: Number(product?.price) || 0,
    stock: Number(product?.stock) || 0,
    quantity: 1,
  };
}

export default function PosScanner({
  onOrderCreated,
}) {
  const [products, setProducts] = useState([]);
  const [taxRate, setTaxRate] = useState(0);

  const [manualProductId, setManualProductId] =
    useState('');

  const [cart, setCart] = useState([]);

  const [scanState, setScanState] =
    useState('idle');

  const [scanNotice, setScanNotice] =
    useState(null);

  const [customerName, setCustomerName] =
    useState('');

  const [customerPhone, setCustomerPhone] =
    useState('');

  const [paymentMethod, setPaymentMethod] =
    useState('Cash');

  const [discount, setDiscount] =
    useState(0);

  const [notes, setNotes] =
    useState('');

  const [completing, setCompleting] =
    useState(false);

  const inputRef = useRef(null);
  const sectionRef = useRef(null);
  const cartRef = useRef([]);
  const noticeTimerRef = useRef(null);

  /*
   * Always keep latest cart available.
   */
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  /*
   * Focus barcode input.
   */
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);

  /*
   * Show scanner notice.
   */
  const showNotice = useCallback((notice) => {
    window.clearTimeout(
      noticeTimerRef.current
    );

    setScanNotice(notice);

    noticeTimerRef.current =
      window.setTimeout(() => {
        setScanNotice(null);
      }, 2800);
  }, []);

  /*
   * Cleanup notice timer.
   */
  useEffect(() => {
    return () => {
      window.clearTimeout(
        noticeTimerRef.current
      );
    };
  }, []);

  /*
   * Load products for manual selection.
   */
  const loadProducts = useCallback(async () => {
    try {
      const response = await fetchResource(
        '/products',
        { limit: 200 }
      );

      const payload =
        response?.data ?? response;

      const items =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

      setProducts(items);
    } catch (error) {
      console.error(
        'Failed to load products:',
        error
      );

      setProducts([]);
    }
  }, []);

  /*
   * Initial load.
   */
  useEffect(() => {
    loadProducts();
    focusInput();
  }, [
    loadProducts,
    focusInput,
  ]);

  /*
   * Keep the barcode field ready unless the user is typing
   * in another control inside this POS section (checkout, manual add).
   */
  useEffect(() => {
    const refocusScanField = () => {
      if (completing) return;

      const active = document.activeElement;
      if (!active || active === inputRef.current) return;
      if (active.dataset?.barcodeScan === 'true') return;

      if (sectionRef.current?.contains(active)) {
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }

      focusInput();
    };

    const onPointerDown = () => {
      window.setTimeout(refocusScanField, 0);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [completing, focusInput]);

  /*
   * Load tax settings.
   */
  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const response =
          await api.get('/settings');

        const settings =
          response?.data?.data ??
          response?.data ??
          {};

        if (active) {
          setTaxRate(
            Number(settings.taxRate) || 0
          );
        }
      } catch (error) {
        console.warn(
          'Could not load tax settings:',
          error
        );
      }
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  /*
   * ==========================================
   * ADD PRODUCT TO CART
   * ==========================================
   *
   * BarcodeScanInput calls this function
   * after finding product by barcode.
   */
  const addProductToCart = useCallback(
    (product) => {
      if (!product) {
        setScanState('error');

        showNotice({
          type: 'error',
          title: 'Scan failed',
          text: 'No product was returned.',
        });

        focusInput();
        return;
      }

      /*
       * Support both Mongo _id and normal id.
       */
      const productId =
        product._id ?? product.id;

      if (!productId) {
        console.error(
          'Product has no ID:',
          product
        );

        setScanState('error');

        showNotice({
          type: 'error',
          title: 'Invalid Product',
          text: 'Product ID is missing.',
        });

        focusInput();
        return;
      }

      /*
       * Make sure product has valid stock.
       */
      const stock =
        Number(product.stock) || 0;

      const normalizedProduct = {
        ...product,
        _id: product._id ?? product.id,
        id: product.id ?? product._id,
        stock,
      };

      /*
       * Add/update item in cart.
       */
      const result = upsertOrderItem(
        cartRef.current,
        normalizedProduct,
        toCartItem
      );

      const name =
        result?.name ||
        normalizedProduct.name ||
        'Product';

      const size =
        normalizedProduct.size || '';

      /*
       * Cart utility rejected product.
       */
      if (!result?.ok) {
        setScanState('error');

        if (
          result.reason === 'inactive'
        ) {
          showNotice({
            type: 'error',
            title: 'Product inactive',
            text:
              `${name} is inactive and cannot be sold.`,
          });
        } else if (
          result.reason === 'out_of_stock'
        ) {
          showNotice({
            type: 'error',
            title: 'Out of Stock',
            text:
              `${name} is out of stock.`,
          });
        } else if (
          result.reason === 'stock_limit'
        ) {
          showNotice({
            type: 'error',
            title:
              `Only ${result.stock} units available`,
            text:
              `Cannot add more ${name} — ` +
              `${result.stock} in stock.`,
          });
        } else {
          showNotice({
            type: 'error',
            title: 'Scan failed',
            text:
              `${name} could not be added to the order.`,
          });
        }

        focusInput();
        return;
      }

      /*
       * ======================================
       * THIS IS THE ACTUAL CART UPDATE
       * ======================================
       */
      const newItems =
        Array.isArray(result.items)
          ? result.items
          : [];

      cartRef.current = newItems;
      setCart(newItems);

      setScanState('success');

      showNotice({
        type: 'success',
        title:
          result.added
            ? 'Added to Cart'
            : 'Quantity updated',

        name,

        size,

        price:
          Number(
            normalizedProduct.price
          ) || 0,

        stock:
          result.stock ?? stock,

        quantity:
          result.quantity ?? 1,
      });

      focusInput();
    },
    [
      focusInput,
      showNotice,
    ]
  );

  /*
   * Barcode not found.
   */
  const handleNotFound = useCallback(
    (code) => {
      setScanState('error');

      showNotice({
        type: 'error',
        title: 'Product Not Found',
        text:
          `Barcode:\n${code}\n` +
          `This barcode is not assigned to any product.`,
      });

      focusInput();
    },
    [
      focusInput,
      showNotice,
    ]
  );

  /*
   * Manual product add.
   */
  const handleManualAdd = useCallback(() => {
    if (!manualProductId) {
      focusInput();
      return;
    }

    const product =
      products.find(
        (entry) =>
          String(
            entry._id ?? entry.id
          ) ===
          String(manualProductId)
      );

    if (!product) {
      showNotice({
        type: 'error',
        title: 'Product not found',
        text:
          'Please select a valid product.',
      });

      focusInput();
      return;
    }

    addProductToCart(product);

    setManualProductId('');

    focusInput();
  }, [
    addProductToCart,
    focusInput,
    manualProductId,
    products,
    showNotice,
  ]);

  /*
   * Totals.
   */
  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        Number(item.quantity || 0),
    0
  );

  const discountValue = Math.min(
    Math.max(
      Number(discount) || 0,
      0
    ),
    subtotal
  );

  const tax = Math.round(
    (
      (subtotal - discountValue) *
      (taxRate / 100)
    ) *
      100
  ) / 100;

  const total = Math.round(
    (
      subtotal -
      discountValue +
      tax
    ) *
      100
  ) / 100;

  /*
   * ==========================================
   * COMPLETE ORDER
   * ==========================================
   */
  const completeOrder = async () => {
    if (completing) {
      return;
    }

    if (!cart.length) {
      showNotice({
        type: 'error',
        title: 'Empty cart',
        text:
          'Scan or add at least one product first.',
      });

      focusInput();
      return;
    }

    const confirm =
      await Swal.fire({
        icon: 'question',
        title: 'Complete order?',
        html:
          `<div style="text-align:left;font-size:14px;line-height:1.9">
            <p><b>Items:</b> ${cart.length}</p>
            <p><b>Subtotal:</b> ${formatRs(subtotal)}</p>
            ${
              discountValue > 0
                ? `<p><b>Discount:</b> -${formatRs(discountValue)}</p>`
                : ''
            }
            ${
              tax > 0
                ? `<p><b>Tax (${taxRate}%):</b> +${formatRs(tax)}</p>`
                : ''
            }
            <p style="font-size:16px">
              <b>Total:</b> ${formatRs(total)}
            </p>
          </div>`,

        showCancelButton: true,

        confirmButtonColor: '#7c3aed',

        confirmButtonText:
          'Complete Sale',

        cancelButtonText: 'Back',
      });

    if (!confirm.isConfirmed) {
      focusInput();
      return;
    }

    try {
      setCompleting(true);

      /*
       * Send only valid product IDs.
       */
      const items = cart
        .map((item) => ({
          productId:
            item.productId ??
            item._id ??
            item.id,

          quantity:
            Number(item.quantity) || 1,
        }))
        .filter(
          (item) => item.productId
        );

      if (!items.length) {
        throw new Error(
          'No valid products found in cart.'
        );
      }

      const payload = {
        customerName:
          customerName.trim() ||
          'Walk-in Customer',

        customerPhone:
          customerPhone.trim(),

        paymentMethod,

        discount:
          discountValue,

        notes:
          notes.trim(),

        status:
          'delivered',

        items,
      };

      await createResource(
        '/orders',
        payload
      );

      showNotice({
        type: 'success',
        title: 'Sale completed',
        text:
          `Total ${formatRs(total)} — stock updated.`,
      });

      /*
       * Clear cart.
       */
      cartRef.current = [];
      setCart([]);

      setDiscount(0);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setScanState('idle');

      await loadProducts();

      onOrderCreated?.();

      focusInput();
    } catch (error) {
      console.error(
        'Order creation failed:',
        error
      );

      await Swal.fire({
        icon: 'error',
        title: 'Order failed',
        text:
          getErrorMessage(error) ||
          'Could not create order.',
      });

      await loadProducts();

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
    <section ref={sectionRef} className="card-surface overflow-hidden">

      {/* HEADER */}
      <div className="border-b divider-border px-4 py-3.5 sm:px-5">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="flex items-center gap-3">

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-sm">
              <LuScanBarcode size={20} />
            </span>

            <div>
              <h2 className="text-base font-semibold panel-title">
                Barcode Point of Sale
              </h2>

              <p className="text-xs panel-muted">
                Scan → add to cart → scan again.
                Checkout when ready.
              </p>
            </div>

          </div>

          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              cart.length
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-[var(--surface-soft)] panel-muted'
            }`}
          >
            {cart.length
              ? `${cart.length} item${
                  cart.length === 1
                    ? ''
                    : 's'
                } in cart`
              : 'Cart empty'}
          </span>

        </div>

        {/* SCANNER */}
        <div className="mt-3.5 flex flex-col gap-2 lg:flex-row lg:items-stretch">

          <BarcodeScanInput
            inputRef={inputRef}
            ringClass={ringClass}
            onProductFound={addProductToCart}
            onNotFound={handleNotFound}
            onScanStateChange={setScanState}
            captureGlobalScans={true}
            notifyErrors={false}
            placeholder="Scan barcode or enter barcode manually"
            inputClassName="!h-12 text-base"
          />

          <select
            className="input-field lg:w-64"
            value={manualProductId}
            onChange={(event) =>
              setManualProductId(
                event.target.value
              )
            }
            aria-label="Add product manually"
          >
            <option value="">
              Quick add from catalog…
            </option>

            {products.map((product) => (
              <option
                key={
                  product._id ??
                  product.id
                }
                value={
                  product._id ??
                  product.id
                }
              >
                {product.name}

                {product.brand
                  ? ` · ${product.brand}`
                  : ''}

                {product.size
                  ? ` · ${product.size}`
                  : ''}

                {' — '}

                {formatRs(
                  product.price
                )}

                {Number(
                  product.stock
                ) === 0
                  ? ' (Out of stock)'
                  : Number(
                        product.stock
                      ) <=
                      LOW_STOCK_THRESHOLD
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
          >
            <FiShoppingCart size={16} />
            Add to cart
          </button>

        </div>

        {/* SCAN NOTICE */}
        {scanNotice ? (
          <div
            className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
              scanNotice.type ===
              'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200'
            }`}
            role="status"
          >

            <p className="font-semibold">
              {scanNotice.type ===
              'success'
                ? '✓ '
                : ''}

              {scanNotice.title}
            </p>

            {scanNotice.name ? (
              <p className="mt-0.5">
                {scanNotice.name}

                {scanNotice.size
                  ? ` · ${scanNotice.size}`
                  : ''}

                {scanNotice.quantity >
                1
                  ? ` · Qty ${scanNotice.quantity}`
                  : ''}
              </p>
            ) : null}

            {scanNotice.price != null &&
            scanNotice.type ===
              'success' ? (
              <p className="mt-0.5">
                {formatRs(
                  scanNotice.price
                )}

                {scanNotice.stock != null
                  ? ` · Stock: ${scanNotice.stock}`
                  : ''}
              </p>
            ) : null}

            {scanNotice.text ? (
              <p className="mt-0.5 whitespace-pre-line opacity-90">
                {scanNotice.text}
              </p>
            ) : null}

          </div>
        ) : null}

      </div>

      {/* CART */}
      {cart.length ? (
        <div className="grid gap-0 md:grid-cols-[1fr_320px]">

          <div className="md:border-r divider-border">

            <div className="max-h-[460px] overflow-auto">

              <table className="min-w-full text-sm">

                <thead className="sticky top-0 bg-[var(--surface-soft)] text-left text-xs uppercase tracking-wide panel-muted">

                  <tr>
                    <th className="px-4 py-2.5 font-semibold">
                      Product
                    </th>

                    <th className="px-3 py-2.5 font-semibold">
                      Size
                    </th>

                    <th className="px-3 py-2.5 font-semibold">
                      Qty
                    </th>

                    <th className="px-3 py-2.5 font-semibold text-right">
                      Price
                    </th>

                    <th className="px-3 py-2.5 font-semibold text-right">
                      Total
                    </th>

                    <th className="px-3 py-2.5" />
                  </tr>

                </thead>

                <tbody>

                  {cart.map((item) => (
                    <tr
                      key={
                        item.productId
                      }
                      className="border-t divider-border"
                    >

                      <td className="px-4 py-3">

                        <div className="flex items-center gap-3">

                          <ProductImage
                            src={item.image}
                            alt={
                              item.productName
                            }
                            className="h-12 w-12"
                          />

                          <div className="min-w-0">

                            <p className="truncate font-semibold panel-title">
                              {item.productName}
                            </p>

                            <p className="truncate text-xs panel-muted">
                              {item.brand ||
                                'Perfume'}
                            </p>

                          </div>

                        </div>

                      </td>

                      <td className="px-3 py-3 panel-muted">
                        {item.size ||
                          '—'}
                      </td>

                      <td className="px-3 py-3">

                        <div className="inline-flex items-center overflow-hidden rounded-lg border divider-border">

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-[var(--surface-soft)] disabled:opacity-40 dark:text-gray-300"
                            disabled={
                              item.quantity <=
                              1
                            }
                            onClick={() => {
                              setCart(
                                (prev) =>
                                  prev.map(
                                    (it) =>
                                      it.productId ===
                                      item.productId
                                        ? {
                                            ...it,
                                            quantity:
                                              Math.max(
                                                1,
                                                it.quantity -
                                                  1
                                              ),
                                          }
                                        : it
                                  )
                              );
                            }}
                            aria-label="Decrease quantity"
                          >
                            <FiMinus
                              size={14}
                            />
                          </button>

                          <input
                            type="number"
                            min="1"
                            max={
                              item.stock
                            }
                            value={
                              item.quantity
                            }
                            className="h-8 w-12 border-x divider-border bg-[var(--surface)] text-center text-sm outline-none"
                            onChange={(event) => {
                              const qty =
                                Math.max(
                                  1,
                                  Number(
                                    event.target
                                      .value
                                  ) || 1
                                );

                              if (
                                qty >
                                item.stock
                              ) {
                                showNotice({
                                  type: 'error',
                                  title:
                                    `Only ${item.stock} units available`,
                                  text:
                                    item.productName,
                                });
                              }

                              setCart(
                                (prev) =>
                                  prev.map(
                                    (it) =>
                                      it.productId ===
                                      item.productId
                                        ? {
                                            ...it,
                                            quantity:
                                              Math.min(
                                                item.stock,
                                                qty
                                              ),
                                          }
                                        : it
                                  )
                              );
                            }}
                            aria-label="Quantity"
                          />

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-[var(--surface-soft)] disabled:opacity-40 dark:text-gray-300"
                            disabled={
                              item.quantity >=
                              item.stock
                            }
                            onClick={() => {

                              if (
                                item.quantity >=
                                item.stock
                              ) {
                                showNotice({
                                  type: 'error',
                                  title:
                                    `Only ${item.stock} units available`,
                                  text:
                                    item.productName,
                                });

                                return;
                              }

                              setCart(
                                (prev) =>
                                  prev.map(
                                    (it) =>
                                      it.productId ===
                                      item.productId
                                        ? {
                                            ...it,
                                            quantity:
                                              Math.min(
                                                item.stock,
                                                it.quantity +
                                                  1
                                              ),
                                          }
                                        : it
                                  )
                              );

                            }}
                            aria-label="Increase quantity"
                          >
                            <FiPlus
                              size={14}
                            />
                          </button>

                        </div>

                      </td>

                      <td className="px-3 py-3 text-right">
                        {formatRs(
                          item.price
                        )}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold panel-title">
                        {formatRs(
                          item.price *
                            item.quantity
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">

                        <button
                          type="button"
                          onClick={() => {
                            const next =
                              cart.filter(
                                (it) =>
                                  it.productId !==
                                  item.productId
                              );

                            cartRef.current =
                              next;

                            setCart(next);
                          }}
                          className="rounded-md p-1 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                          aria-label={`Remove ${item.productName}`}
                        >
                          <FiX
                            size={16}
                          />
                        </button>

                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>

          </div>

          {/* CHECKOUT */}
          <div className="flex flex-col border-t divider-border p-4 sm:p-5 md:border-t-0">

            <div className="flex items-center justify-between">

              <h3 className="text-sm font-semibold panel-title">
                Checkout
              </h3>

              <span className="text-xs panel-muted">
                {cart.length} item
                {cart.length === 1
                  ? ''
                  : 's'}
              </span>

            </div>

            <div className="mt-3 space-y-2">

              <input
                className="input-field"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(event) =>
                  setCustomerName(
                    event.target.value
                  )
                }
              />

              <input
                className="input-field"
                placeholder="Phone (optional)"
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(
                    event.target.value
                  )
                }
              />

              <select
                className="input-field"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value
                  )
                }
              >
                {paymentMethods.map(
                  (method) => (
                    <option
                      key={
                        method.value
                      }
                      value={
                        method.value
                      }
                    >
                      {method.label}
                    </option>
                  )
                )}
              </select>

              <input
                type="number"
                min="0"
                className="input-field"
                placeholder="Discount (PKR)"
                value={discount}
                onChange={(event) =>
                  setDiscount(
                    Number(
                      event.target.value
                    ) || 0
                  )
                }
              />

              <textarea
                rows={2}
                className="input-field"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
              />

            </div>

            <div className="mt-4 space-y-1.5 border-t divider-border pt-3 text-sm">

              <div className="flex justify-between panel-muted">
                <span>
                  Subtotal
                </span>

                <span>
                  {formatRs(
                    subtotal
                  )}
                </span>
              </div>

              {discountValue > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <span>
                    Discount
                  </span>

                  <span>
                    −
                    {formatRs(
                      discountValue
                    )}
                  </span>
                </div>
              ) : null}

              {tax > 0 ? (
                <div className="flex justify-between panel-muted">
                  <span>
                    Tax ({taxRate}%)
                  </span>

                  <span>
                    +
                    {formatRs(tax)}
                  </span>
                </div>
              ) : null}

              <div className="flex justify-between pt-1 text-base font-bold panel-title">

                <span>
                  Grand Total
                </span>

                <span>
                  {formatRs(total)}
                </span>

              </div>

            </div>

            <button
              type="button"
              onClick={
                completeOrder
              }
              disabled={
                completing
              }
              className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2"
            >
              <FiCheckCircle
                size={16}
              />

              {completing
                ? 'Completing order…'
                : 'Checkout'}
            </button>

          </div>

        </div>
      ) : (

        /* EMPTY CART */
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:py-14">

          <div className="relative">

            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--primary)]">
              <LuScanBarcode
                size={24}
              />
            </span>

            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">

              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-50" />

              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--primary)]" />

            </span>

          </div>

          <div>

            <p className="text-sm font-semibold panel-title">
              Ready to scan
            </p>

            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed panel-muted">
              Point a USB or Bluetooth HID
              scanner at the field above,
              or type a barcode and press Enter.
            </p>

          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-medium panel-muted">
            <LuKeyboard
              size={16}
            />
            Scanner works like a keyboard
          </span>

        </div>

      )}

    </section>
  );
}