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
    try {
      JsBarcode(svgRef.current, String(value), {
        format: 'CODE128',
        width,
        height,
        displayValue,
        margin: 4,
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
