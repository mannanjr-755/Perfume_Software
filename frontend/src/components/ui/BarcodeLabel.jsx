import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeLabel({
  value,
  height = 36,
  width = 1.6,
  displayValue = true,
  className = '',
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    const text = String(value);
    const isEan13 = /^[0-9]{13}$/.test(text)
      && text.split('').reduce((sum, d, i) => sum + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === 0;
    try {
      JsBarcode(svgRef.current, text, {
        format: isEan13 ? 'EAN13' : 'CODE128',
        width,
        height,
        displayValue,
        margin: Math.ceil(width * 11),
        fontOptions: 'bold',
        background: '#ffffff',
      });
    } catch {
      /* invalid barcode value — render nothing */
    }
  }, [value, height, width, displayValue]);

  if (!value) return null;

  return <svg ref={svgRef} className={className} aria-label={`Barcode ${value}`} />;
}
