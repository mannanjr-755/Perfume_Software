import { normalizeBarcode, isValidBarcode } from '../src/utils/barcode.js';
import { upsertOrderItem } from '../../frontend/src/utils/orderCart.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function toItem(product) {
  return {
    productId: product._id,
    productName: product.name,
    barcode: product.barcode,
    size: product.size,
    price: product.price,
    stock: product.stock,
    quantity: 1,
  };
}

assert(normalizeBarcode('0123456789012') === '0123456789012', 'leading zeros must be kept');
assert(normalizeBarcode(' 6291234567890\n') === '6291234567890', 'whitespace must be stripped');
assert(normalizeBarcode('8901000000028\r') === '8901000000028', 'CR suffix must be stripped');
assert(normalizeBarcode('8901000000028\t') === '8901000000028', 'Tab suffix must be stripped');
assert(normalizeBarcode(']C18901000000028') === '8901000000028', 'AIM prefix must be stripped');
assert(isValidBarcode('0123456789012') === true, 'numeric barcode with leading zero is valid');
assert(isValidBarcode('12') === false, 'too-short barcode is invalid');

const product = {
  _id: 1,
  name: 'Dior Sauvage',
  barcode: '8901000000028',
  size: '100ml',
  price: 32000,
  stock: 3,
  status: 'active',
};

let cart = [];
let first = upsertOrderItem(cart, product, toItem);
assert(first.ok && first.added && first.quantity === 1 && first.items.length === 1, 'first scan adds one row');

let second = upsertOrderItem(first.items, product, toItem);
assert(second.ok && !second.added && second.quantity === 2 && second.items.length === 1, 'second scan increases qty');

let third = upsertOrderItem(second.items, product, toItem);
assert(third.ok && third.quantity === 3, 'third scan reaches stock');

let fourth = upsertOrderItem(third.items, product, toItem);
assert(!fourth.ok && fourth.reason === 'stock_limit' && fourth.stock === 3, 'fourth scan is blocked');

const empty = upsertOrderItem([], { ...product, stock: 0 }, toItem);
assert(!empty.ok && empty.reason === 'out_of_stock', 'zero stock is blocked');

const missing = upsertOrderItem([], { ...product, _id: null, name: undefined }, toItem);
assert(!missing.ok && missing.reason === 'invalid', 'invalid product is not added');

console.log('Barcode cart tests passed');
