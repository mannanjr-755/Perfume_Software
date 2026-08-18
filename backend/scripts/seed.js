import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, disconnectDatabase, query } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function upsertByName(table, items) {
  for (const item of items) {
    const existing = await query(`SELECT id FROM ${table} WHERE name = $1`, [item.name]);
    if (existing.rows[0]) {
      await query(
        `UPDATE ${table} SET description = $1, status = $2, updated_at = now() WHERE id = $3`,
        [item.description || '', item.status || 'active', existing.rows[0].id]
      );
    } else {
      await query(`INSERT INTO ${table} (name, description, status) VALUES ($1, $2, $3)`, [
        item.name,
        item.description || '',
        item.status || 'active',
      ]);
    }
  }
}

async function seed() {
  await connectDatabase();
  console.log('[Seed] Connected to database');

  const categories = [
    { name: 'Eau de Parfum', description: 'Long-lasting fragrance' },
    { name: 'Eau de Toilette', description: 'Light daily wear' },
    { name: 'Cologne', description: 'Fresh and subtle' },
  ];
  await upsertByName('categories', categories);
  console.log('[Seed] Categories synced');

  const brands = [
    { name: 'Chanel', description: 'French luxury house' },
    { name: 'Dior', description: 'Parisian elegance' },
    { name: 'Tom Ford', description: 'Modern luxury' },
  ];
  await upsertByName('brands', brands);
  console.log('[Seed] Brands synced');

  const catalog = [
    {
      name: 'Bleu de Chanel',
      brand: 'Chanel',
      category: 'Eau de Parfum',
      price: 120,
      stock: 50,
      description: 'A woody aromatic fragrance for men.',
      image: '/products/bleu-de-chanel.png',
      barcode: '8901000000011',
      status: 'active',
    },
    {
      name: 'Sauvage',
      brand: 'Dior',
      category: 'Eau de Toilette',
      price: 95,
      stock: 40,
      description: 'Fresh and spicy signature scent.',
      image: '/products/sauvage.png',
      barcode: '8901000000028',
      status: 'active',
    },
    {
      name: 'Tom Ford Oud Wood',
      brand: 'Tom Ford',
      category: 'Eau de Parfum',
      price: 185,
      stock: 22,
      description: 'Warm, smoky oud with a luxurious finish.',
      image: '/products/tom-ford.png',
      barcode: '8901000000035',
      status: 'active',
    },
    {
      name: 'Royal Oud',
      brand: 'Dior',
      category: 'Cologne',
      price: 160,
      stock: 18,
      description: 'Rich Arabic oud with gold-toned depth.',
      image: '/products/oud.png',
      barcode: '8901000000042',
      status: 'active',
    },
    {
      name: 'Rose Bloom',
      brand: 'Chanel',
      category: 'Eau de Parfum',
      price: 110,
      stock: 28,
      description: 'Elegant floral fragrance with a crystal finish.',
      image: '/products/floral.png',
      barcode: '8901000000059',
      status: 'active',
    },
  ];

  for (const item of catalog) {
    const existing = await query('SELECT id FROM products WHERE name = $1', [item.name]);
    if (existing.rows[0]) {
      await query(
        `UPDATE products SET
           brand = $1, category = $2, price = $3, stock = $4, description = $5,
           image = $6, barcode = $7, status = $8, updated_at = now()
         WHERE id = $9`,
        [
          item.brand,
          item.category,
          item.price,
          item.stock,
          item.description,
          item.image,
          item.barcode,
          item.status,
          existing.rows[0].id,
        ]
      );
    } else {
      await query(
        `INSERT INTO products (name, brand, category, price, stock, description, image, barcode, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          item.name,
          item.brand,
          item.category,
          item.price,
          item.stock,
          item.description,
          item.image,
          item.barcode,
          item.status,
        ]
      );
    }
  }
  await query(`UPDATE products SET image = '/products/default.png' WHERE image IS NULL OR image = ''`);
  console.log('[Seed] Products synced with catalog images');

  const customersRes = await query('SELECT COUNT(*) AS count FROM customers');
  if (Number(customersRes.rows[0].count) === 0) {
    await query(
      `INSERT INTO customers (name, email, phone, city) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      ['John Smith', 'john@example.com', '+1234567890', 'New York', 'Sarah Lee', 'sarah@example.com', '+1987654321', 'London']
    );
    console.log('[Seed] Sample customers created');
  }

  const settingsRes = await query('SELECT id FROM settings ORDER BY id LIMIT 1');
  if (!settingsRes.rows[0]) {
    await query(
      `INSERT INTO settings (store_name, store_email, currency, tax_rate, order_prefix)
       VALUES ($1, $2, $3, $4, $5)`,
      ['Scent Yours', 'hello@scentyours.com', 'PKR', 5, 'PFM-']
    );
    console.log('[Seed] Settings initialized');
  } else {
    await query(`UPDATE settings SET currency = 'PKR', updated_at = now() WHERE currency <> 'PKR'`);
  }

  await disconnectDatabase();
  console.log('[Seed] Done');
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});