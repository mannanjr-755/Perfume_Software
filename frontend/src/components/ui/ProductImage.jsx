const FALLBACK = '/products/default.png';

function resolveProductImage(src) {
  if (!src || typeof src !== 'string') return FALLBACK;
  const value = src.trim();
  if (!value) return FALLBACK;
  return value;
}

export default function ProductImage({ src, alt = 'Product', className = '' }) {
  return (
    <div className={`product-image-wrap ${className}`.trim()}>
      <img
        src={resolveProductImage(src)}
        alt={alt}
        className="product-image"
        onError={(event) => {
          if (event.currentTarget.dataset.fallback === '1') return;
          event.currentTarget.dataset.fallback = '1';
          event.currentTarget.src = '/perfume.png';
        }}
      />
    </div>
  );
}
