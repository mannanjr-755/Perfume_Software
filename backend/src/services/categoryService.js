import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { createCrudService } from './crudService.js';
import { AppError } from '../utils/AppError.js';

const base = createCrudService(Category, { searchFields: ['name', 'description'] });

async function withCounts(items) {
  const names = items.map((item) => item.name);
  const counts = await Product.aggregate([
    { $match: { category: { $in: names } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  return items.map((item) => ({
    ...item,
    productCount: map[item.name] || 0,
  }));
}

export const categoryService = {
  async list(query = {}) {
    const result = await base.list(query);
    const items = await withCounts(result.items.map((item) => item.toObject()));
    return { ...result, items };
  },
  getById: base.getById,
  create: base.create,
  update: base.update,
  async delete(id) {
    const category = await Category.findById(id);
    if (!category) throw new AppError('Record not found', 404);
    const count = await Product.countDocuments({ category: category.name });
    if (count > 0) {
      throw new AppError(
        `Cannot delete "${category.name}" because ${count} product${count === 1 ? '' : 's'} use it. Reassign those products first.`,
        400
      );
    }
    return base.delete(id);
  },
};
