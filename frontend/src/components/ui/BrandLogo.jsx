export default function BrandLogo({ title = 'Scent Yours', subtitle = 'Premium Fragrances', className = '' }) {
  return (
    <div className={`brand-identity ${className}`}>
      <div className="brand-logo-frame brand-logo-wrap">
        <img src="/logo.jpg" alt={`${title} logo`} className="brand-logo" />
      </div>
      <div className="brand-text">
        <p className="brand-name">{title}</p>
        {subtitle ? <p className="brand-subtitle">{subtitle}</p> : null}
      </div>
    </div>
  );
}
