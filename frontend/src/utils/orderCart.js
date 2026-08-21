export function upsertOrderItem(items, product, toItem) {
  const productId = product._id ?? product.productId;
  const stock = Number(product.stock) || 0;
  const name = product.name || product.productName || 'Product';

  if (productId == null || productId === '') {
    return { ok: false, reason: 'invalid', name };
  }

  if (product.status && product.status !== 'active') {
    return { ok: false, reason: 'inactive', name };
  }
  if (stock <= 0) {
    return { ok: false, reason: 'out_of_stock', name };
  }

  const index = items.findIndex((item) => String(item.productId) === String(productId));
  if (index >= 0) {
    const existing = items[index];
    const nextQty = existing.quantity + 1;
    if (nextQty > stock) {
      return { ok: false, reason: 'stock_limit', name, stock };
    }
    return {
      ok: true,
      items: items.map((item, i) => (i === index ? { ...item, quantity: nextQty } : item)),
      added: false,
      quantity: nextQty,
      name,
      stock,
    };
  }

  return {
    ok: true,
    items: [...items, toItem(product)],
    added: true,
    quantity: 1,
    name,
    stock,
  };
}
