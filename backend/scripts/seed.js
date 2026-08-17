import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../src/models/Product.js';
import Category from '../src/models/Category.js';
import Brand from '../src/models/Brand.js';
import Customer from '../src/models/Customer.js';
import Settings from '../src/models/Settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/perfume_store';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('[Seed] Connected to MongoDB');

  const categories = [
    { name: 'Eau de Parfum', description: 'Long-lasting fragrance' },
    { name: 'Eau de Toilette', description: 'Light daily wear' },
    { name: 'Cologne', description: 'Fresh and subtle' },
  ];
  for (const item of categories) {
    await Category.findOneAndUpdate({ name: item.name }, { $set: item }, { upsert: true, new: true });
  }
  console.log('[Seed] Categories synced');

  const brands = [
    { name: 'Chanel', description: 'French luxury house' },
    { name: 'Dior', description: 'Parisian elegance' },
    { name: 'Tom Ford', description: 'Modern luxury' },
  ];
  for (const item of brands) {
    await Brand.findOneAndUpdate({ name: item.name }, { $set: item }, { upsert: true, new: true });
  }
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

  await Product.init();

  for (const item of catalog) {
    await Product.findOneAndUpdate(
      { name: item.name },
      { $set: item },
      { upsert: true, new: true }
    );
  }
  await Product.updateMany(
    { $or: [{ image: { $exists: false } }, { image: '' }, { image: null }] },
    { $set: { image: '/products/default.png' } }
  );
  console.log('[Seed] Products synced with catalog images');

  if (await Customer.countDocuments() === 0) {
    await Customer.insertMany([
      { name: 'John Smith', email: 'john@example.com', phone: '+1234567890', city: 'New York' },
      { name: 'Sarah Lee', email: 'sarah@example.com', phone: '+1987654321', city: 'London' },
    ]);
    console.log('[Seed] Sample customers created');
  }

  if (!await Settings.findOne()) {
    await Settings.create({
      storeName: 'Scent Yours',
      storeEmail: 'hello@scentyours.com',
      currency: 'PKR',
      taxRate: 5,
      orderPrefix: 'PFM-',
    });
    console.log('[Seed] Settings initialized');
  } else {
    await Settings.updateMany({ currency: { $ne: 'PKR' } }, { $set: { currency: 'PKR' } });
  }

  await mongoose.disconnect();
  console.log('[Seed] Done');
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
