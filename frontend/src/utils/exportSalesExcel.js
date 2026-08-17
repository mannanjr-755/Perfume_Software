const SALES_COLUMNS = [
  { header: 'Order ID', key: 'orderId', width: 14 },
  { header: 'Date', key: 'date', width: 14 },
  { header: 'Time', key: 'time', width: 12 },
  { header: 'Customer', key: 'customer', width: 22 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Product', key: 'product', width: 28 },
  { header: 'Brand', key: 'brand', width: 16 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Quantity', key: 'quantity', width: 12 },
  { header: 'Price (PKR)', key: 'price', width: 14 },
  { header: 'Line Total (PKR)', key: 'lineTotal', width: 18 },
  { header: 'Order Total (PKR)', key: 'orderTotal', width: 18 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Payment Method', key: 'paymentMethod', width: 18 },
  { header: 'Delivery Method', key: 'deliveryMethod', width: 18 },
];

export function buildSalesExportRows(orders = []) {
  const rows = [];

  for (const order of orders) {
    const created = order.createdAt ? new Date(order.createdAt) : null;
    const base = {
      orderId: String(order._id || '').slice(-8).toUpperCase(),
      date: created ? created.toLocaleDateString('en-PK') : '',
      time: created ? created.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '',
      customer: order.customerName || '',
      email: order.customerEmail || '',
      phone: order.customerPhone || '',
      orderTotal: Number(order.total || 0),
      status: order.status || '',
      paymentMethod: order.paymentMethod || 'Cash',
      deliveryMethod: order.shippingMethod || '',
    };

    const items = Array.isArray(order.items) && order.items.length ? order.items : [null];
    for (const item of items) {
      const quantity = item ? Number(item.quantity || 0) : 0;
      const price = item ? Number(item.price || 0) : 0;
      rows.push({
        ...base,
        product: item?.productName || '',
        brand: item?.brand || '',
        category: item?.category || '',
        quantity,
        price,
        lineTotal: quantity * price,
      });
    }
  }

  return rows;
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C3AED' },
  };
  row.alignment = { vertical: 'middle' };
}

export async function createSalesWorkbook(data) {
  const ExcelJS = (await import('exceljs')).default;
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const summary = data?.summary || {};
  const rows = buildSalesExportRows(orders);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Scent Yours';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 24 },
    { header: 'Value', key: 'value', width: 22 },
  ];
  styleHeader(summarySheet.getRow(1));
  summarySheet.addRows([
    { metric: 'Total Orders', value: Number(summary.totalOrders ?? orders.length ?? 0) },
    { metric: 'Revenue (PKR)', value: Number(summary.totalRevenue ?? 0) },
    { metric: 'Delivered', value: Number(summary.delivered ?? 0) },
    { metric: 'Cancelled', value: Number(summary.cancelled ?? 0) },
    { metric: 'Currency', value: 'PKR' },
    { metric: 'Exported At', value: new Date().toLocaleString('en-PK') },
  ]);

  const salesSheet = workbook.addWorksheet('Sales');
  salesSheet.columns = SALES_COLUMNS;
  styleHeader(salesSheet.getRow(1));
  salesSheet.addRows(rows);
  salesSheet.views = [{ state: 'frozen', ySplit: 1 }];

  return { workbook, rows };
}

export async function exportSalesWorkbook(data) {
  const { workbook, rows } = await createSalesWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `sales-report-${stamp}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { rows: rows.length, fileName };
}
