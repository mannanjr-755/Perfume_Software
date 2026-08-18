import { createCrudService } from './crudService.js';
import { AppError } from '../utils/AppError.js';
import { query } from '../config/database.js';

const base = createCrudService('categories', { searchFields: ['name', 'description'] });

async function withCounts(items) {
  const names = items.map((item) => item.name);
  if (!names.length) return items;
  const res = await query(
    'SELECT category AS name, COUNT(*) AS count FROM products WHERE category = ANY($1) GROUP BY category',
    [names]
  );
  const map = new Map(res.rows.map((row) => [row.name, Number(row.count)]));
  return items.map((item) => ({
    ...item,
    productCount: map.get(item.name) || 0,
  }));
}

export const categoryService = {
  async list(queryParams = {}) {
    const result = await base.list(queryParams);
    const items = await withCounts(result.items);
    return { ...result, items };
  },
  getById: base.getById,
  create: base.create,
  update: base.update,
  async delete(id) {
    const category = await base.getById(id);
    const res = await query('SELECT COUNT(*) AS count FROM products WHERE category = $1', [category.name]);
    const count = Number(res.rows[0].count || 0);
    if (count > 0) {
      throw new AppError(
        `Cannot delete "${category.name}" because ${count} product${count === 1 ? '' : 's'} use it. Reassign those products first.`,
        400
      );
    }
    return base.delete(id);
  },
};