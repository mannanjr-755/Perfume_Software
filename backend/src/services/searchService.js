import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import { escapeRegex } from '../utils/escapeRegex.js';

const DEFAULT_LIMIT = 8;

function searchFilter(query, fields) {
  if (!query) return {};
  const regex = new RegExp(escapeRegex(query), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
}

async function searchCollection(Model, query, fields, limit = DEFAULT_LIMIT) {
  const filter = searchFilter(query, fields);
  return Model.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function searchAll(query) {
  const q = String(query || '').trim();
  if (!q) {
    return { products: [], orders: [], customers: [], categories: [], brands: [] };
  }

  const [products, orders, customers, categories, brands] = await Promise.all([
    searchCollection(Product, q, ['name', 'brand', 'category', 'barcode', 'sku']),
    searchCollection(Order, q, ['orderNumber', 'customerName', 'customerEmail', 'customerPhone']),
    searchCollection(Customer, q, ['name', 'email', 'phone', 'city']),
    searchCollection(Category, q, ['name', 'description']),
    searchCollection(Brand, q, ['name', 'description']),
  ]);

  return { products, orders, customers, categories, brands };
}
