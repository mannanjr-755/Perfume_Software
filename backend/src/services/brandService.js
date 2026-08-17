import Brand from '../models/Brand.js';
import Product from '../models/Product.js';
import { createCrudService } from './crudService.js';
import { AppError } from '../utils/AppError.js';

const base = createCrudService(Brand, { searchFields: ['name', 'description'] });

async function withCounts(items) {
  const names = items.map((item) => item.name);
  const counts = await Product.aggregate([
    { $match: { brand: { $in: names } } },
    { $group: { _id: '$brand', count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  return items.map((item) => ({
    ...item,
    productCount: map[item.name] || 0,
  }));
}

export const brandService = {
  async list(query = {}) {
    const result = await base.list(query);
    const items = await withCounts(result.items.map((item) => item.toObject()));
    return { ...result, items };
  },
  getById: base.getById,
  create: base.create,
  update: base.update,
  async delete(id) {
    const brand = await Brand.findById(id);
    if (!brand) throw new AppError('Record not found', 404);
    const count = await Product.countDocuments({ brand: brand.name });
    if (count > 0) {
      throw new AppError(
        `Cannot delete "${brand.name}" because ${count} product${count === 1 ? '' : 's'} use it. Reassign those products first.`,
        400
      );
    }
    return base.delete(id);
  },
};
